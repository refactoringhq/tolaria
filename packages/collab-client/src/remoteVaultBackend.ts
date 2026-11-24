import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
	VAULT_BACKEND_INTERFACE_VERSION,
	type VaultBackend,
	type VaultChromeOps,
	type VaultCollabBindings,
	type VaultCollabDoc,
	type VaultCollabOpenOptions,
	type VaultFile,
	type VaultFileOps,
	type VaultSearchOptions,
	type VaultSearchResponse,
	type VaultWriteOptions,
	type VaultWriteResult,
} from "../../../src/lib/vaultBackend/types";
import type {
	SearchResult as AppSearchResult,
	VaultEntry as AppVaultEntry,
} from "../../../src/types";
import {
	COLLAB_TICKET_PARAM,
	type CollabTicketResponse,
	DOC_BLOCKS_FRAGMENT,
	DOC_ID_HEADER,
	type EntriesDeltaResponse,
	type EntriesResponse,
	type SearchResult as ProtocolSearchResult,
	type VaultEntry as ProtocolVaultEntry,
	ROUTES,
	type SearchResponse,
	type WriteResult,
} from "../../protocol/src/index.ts";
import { BROWSER_PRESENCE_PACING } from "./awarenessPacing.ts";
import { CollabProvider, type SocketLike } from "./collabProvider.ts";
import { type RemoteAttachments, remoteAttachments } from "./remoteAttachments.ts";
import {
	createFolder,
	deleteFolder,
	listFolders,
	renameFolder,
} from "./remoteFolders.ts";
import {
	DEFAULT_CACHE_KEY,
	entriesCacheKey,
	writeCache,
} from "./entriesCache.ts";
import { takeCache } from "./entriesCachePrefetch.ts";
import {
	assertVaultPath,
	encoded,
	etagOf,
	jsonWithStrings,
	malformed,
	ok,
	RemoteError,
	type Request,
	released,
} from "./remoteHttp.ts";
import {
	followRenames,
	renameNote,
	trackCreate,
	whenCreated,
} from "./remoteNoteLifecycle.ts";

export { RemoteError };

/**
 * The Tolaria remote behind the `VaultBackend` seam: files over the HTTP protocol, and notes
 * as live documents over the collaboration channel. Notes are listed, read, created, written,
 * renamed and deleted; the operations the server does not offer yet are refused by name.
 */

export interface RemoteBindings extends VaultCollabBindings {
	doc: Y.Doc;
	fragment: Y.XmlFragment;
	provider: CollabProvider;
	awareness: Awareness;
}

export interface RemoteOptions {
	/** Origin of the server, or empty when it is served from the page's own origin. */
	baseUrl: string;
	token: string;
	fetch?: typeof fetch;
	/** Opens a websocket; the browser's `WebSocket` by default. */
	createSocket?: (url: string) => SocketLike;
}

function precondition({
	baseRevision,
}: VaultWriteOptions): Record<string, string> {
	if (baseRevision === undefined) return { "if-match": "*" };
	if (baseRevision === null) return { "if-none-match": "*" };
	return { "if-match": `"${baseRevision}"` };
}

function unsupported(operation: string): () => Promise<never> {
	return () =>
		Promise.reject(
			new Error(`${operation} is not available on the Tolaria remote yet`),
		);
}

/** What the app's entry holds for fields the server's index leaves out. */
type AppEntryDefaults = Omit<
	AppVaultEntry,
	"path" | "filename" | "title" | "fileSize" | "snippet" | "wordCount" | "hasH1"
>;

function appEntryDefaults(): AppEntryDefaults {
	return {
		isA: null,
		aliases: [],
		belongsTo: [],
		relatedTo: [],
		status: null,
		archived: false,
		modifiedAt: null,
		createdAt: null,
		relationships: {},
		icon: null,
		color: null,
		order: null,
		sidebarLabel: null,
		template: null,
		sort: null,
		view: null,
		visible: true,
		organized: false,
		favorite: false,
		favoriteIndex: null,
		listPropertiesDisplay: [],
		outgoingLinks: [],
		properties: {},
		fileKind: "markdown",
	};
}

/** The fields that are set: an index entry omits what a note does not have. */
function definedFields<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, field]) => field !== undefined),
	) as Partial<T>;
}

/** The desktop's vault scan leaves dot files out (`is_visible_vault_file`), a folder's `.keep` among them. */
function visibleEntries(entries: AppVaultEntry[]): AppVaultEntry[] {
	return entries.filter((entry) => !entry.filename.startsWith("."));
}

function mapProtocolEntryToApp(entry: ProtocolVaultEntry): AppVaultEntry {
	return { ...appEntryDefaults(), ...definedFields(entry) } as AppVaultEntry;
}

/** Empty lists, maps and nulls are left out of the cached index, as the server does. */
function presentOrUndefined<T>(value: T | null): T | undefined {
	if (value === null) return undefined;
	const empty = Array.isArray(value)
		? value.length === 0
		: typeof value === "object" && Object.keys(value as object).length === 0;
	return empty ? undefined : value;
}

function mapAppEntryToProtocol(entry: AppVaultEntry): ProtocolVaultEntry {
	return {
		path: entry.path,
		filename: entry.filename,
		title: entry.title,
		isA: presentOrUndefined(entry.isA),
		aliases: presentOrUndefined(entry.aliases),
		belongsTo: presentOrUndefined(entry.belongsTo),
		status: presentOrUndefined(entry.status),
		fileSize: entry.fileSize,
		snippet: entry.snippet,
		wordCount: entry.wordCount,
		relationships: presentOrUndefined(entry.relationships),
		outgoingLinks: presentOrUndefined(entry.outgoingLinks),
		hasH1: entry.hasH1,
		fileKind: entry.fileKind ?? "markdown",
	};
}

function mapProtocolSearchResult(
	result: ProtocolSearchResult,
): AppSearchResult {
	return {
		path: result.path,
		title: result.path.split("/").pop()?.replace(/\.md$/, "") ?? "",
		snippet: result.matches[0]?.text ?? "",
		score: result.pathMatch ? 10 : 1,
		noteType: null,
	};
}

// Module-level cache state for web-only cache-first loading; one vault per page, under its key.
let cacheKey = DEFAULT_CACHE_KEY;
let cachedEntries: Map<string, AppVaultEntry> = new Map();
let revalidating = false;
// Startup lists the vault more than once at the same time: they share one cache read.
let pendingCacheList: Promise<AppVaultEntry[] | null> | null = null;

async function listFromCache(request: Request): Promise<AppVaultEntry[] | null> {
	const cached = await takeCache(cacheKey);
	if (!cached) return null;
	cachedEntries = new Map(
		cached.entries.map((e) => [e.path, mapProtocolEntryToApp(e)]),
	);
	// Start background revalidation
	if (!revalidating) {
		revalidateInBackground(request, cached.head);
	}
	return visibleEntries(Array.from(cachedEntries.values()));
}

function sharedCacheList(request: Request): Promise<AppVaultEntry[] | null> {
	pendingCacheList ??= listFromCache(request).finally(() => {
		pendingCacheList = null;
	});
	return pendingCacheList;
}

async function listEntries(request: Request): Promise<AppVaultEntry[]> {
	// Web-only: try cache-first loading
	if (typeof indexedDB !== "undefined" && cachedEntries.size === 0) {
		const fromCache = await sharedCacheList(request);
		if (fromCache) return fromCache;
	}

	// No cache or cache unavailable: fetch full list
	const response = await ok(await request(ROUTES.entries));
	const body = (await response.json()) as EntriesResponse;
	const entries = body.entries.map(mapProtocolEntryToApp);

	// Update cache for next time (web only)
	if (typeof indexedDB !== "undefined") {
		cachedEntries = new Map(entries.map((e) => [e.path, e]));
		writeCache(body.head, body.entries, cacheKey).catch(() => {
			// Cache write failures are silent
		});
	}

	return visibleEntries(entries);
}

const DELTA_CHUNK_SIZE = 50;

function yieldToMainThread(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Applies `apply` to every item, yielding to the main thread between chunks to avoid long tasks. */
async function applyInChunks<T>(
	items: T[],
	apply: (item: T) => void,
): Promise<void> {
	for (let start = 0; start < items.length; start += DELTA_CHUNK_SIZE) {
		if (start > 0) await yieldToMainThread();
		items.slice(start, start + DELTA_CHUNK_SIZE).forEach(apply);
	}
}

/** Nothing changed since the cached HEAD: the snapshot is already current. */
function isUnchanged(delta: EntriesDeltaResponse, since: string): boolean {
	return (
		delta.head === since &&
		delta.changed.length === 0 &&
		delta.deleted.length === 0
	);
}

/**
 * Revalidates cached entries in the background by fetching deltas since the cached HEAD.
 * Chunks the work to avoid blocking the main thread.
 */
async function revalidateInBackground(
	request: Request,
	since: string,
): Promise<void> {
	if (revalidating) return;
	revalidating = true;

	try {
		const url = `${ROUTES.entries}?since=${encodeURIComponent(since)}`;
		const response = await ok(await request(url));
		const delta = (await response.json()) as EntriesDeltaResponse;

		await yieldToMainThread();
		await applyInChunks(delta.changed, (entry) => {
			cachedEntries.set(entry.path, mapProtocolEntryToApp(entry));
		});
		await applyInChunks(delta.deleted, (path) => {
			cachedEntries.delete(path);
		});
		if (isUnchanged(delta, since)) return;

		// Update cache with new HEAD and entries
		const protocolEntries = Array.from(cachedEntries.values()).map(
			mapAppEntryToProtocol,
		);
		await writeCache(delta.head, protocolEntries, cacheKey);
	} catch {
		// Revalidation failures are silent; the cached data remains valid
	} finally {
		revalidating = false;
	}
}

async function searchFiles(
	request: Request,
	query: string,
	options: VaultSearchOptions,
): Promise<VaultSearchResponse> {
	const limit = options.limit ?? 50;
	const url = `${ROUTES.search}?${new URLSearchParams({ q: query, limit: String(limit) })}`;
	const response = await ok(await request(url));
	const body = (await response.json()) as SearchResponse;
	const start = performance.now();
	return {
		results: body.results.map(mapProtocolSearchResult),
		elapsedMs: performance.now() - start,
	};
}

async function deleteFiles(
	request: Request,
	paths: string[],
): Promise<string[]> {
	const deleted: string[] = [];
	for (const path of paths) {
		try {
			assertVaultPath(path);
			const file = await readFile(request, path);
			const init = {
				method: "DELETE",
				headers: { "if-match": `"${file.revision}"` },
			};
			await released(
				await ok(await request(`${ROUTES.files}/${encoded(path)}`, init)),
			);
			deleted.push(path);
		} catch {
			// File doesn't exist or delete failed - skip it and continue
		}
	}
	return deleted;
}

function requester({
	baseUrl,
	token,
	fetch: send = fetch,
}: RemoteOptions): Request {
	return (path, init = {}) =>
		send(`${baseUrl}${path}`, {
			...init,
			headers: { ...init.headers, authorization: `Bearer ${token}` },
		});
}

async function readFile(request: Request, path: string): Promise<VaultFile> {
	const response = await ok(await request(`${ROUTES.files}/${encoded(path)}`));
	return { path, content: await response.text(), revision: etagOf(response) };
}

async function conflictCopyPath(
	response: Response,
): Promise<string | undefined> {
	try {
		return ((await response.json()) as WriteResult).path;
	} catch {
		return undefined;
	}
}

async function writeFile(
	request: Request,
	file: { path: string; content: string },
	options: VaultWriteOptions,
): Promise<VaultWriteResult> {
	assertVaultPath(file.path);
	const init = {
		method: "PUT",
		body: file.content,
		headers: precondition(options),
	};
	const response = await request(`${ROUTES.files}/${encoded(file.path)}`, init);
	// The server kept the bytes as a conflict copy; the file that won is what the caller needs.
	if (response.status === 409)
		return {
			status: "conflict",
			copyPath: await conflictCopyPath(response),
			current: await readFile(request, file.path).catch(() => null),
		};
	return {
		status: "written",
		revision: etagOf(await released(await ok(response))),
	};
}

/** A create is tracked, so the note's live document waits for its file to exist. */
function writeOrCreate(
	request: Request,
	file: { path: string; content: string },
	options: VaultWriteOptions,
): Promise<VaultWriteResult> {
	const write = writeFile(request, file, options);
	return options.baseRevision === null ? trackCreate(file.path, write) : write;
}

async function reloadEntries(request: Request): Promise<AppVaultEntry[]> {
	// Force a fresh fetch, bypassing cache
	const response = await ok(await request(ROUTES.entries));
	const body = (await response.json()) as EntriesResponse;
	const entries = body.entries.map(mapProtocolEntryToApp);

	// Update cache (web only)
	if (typeof indexedDB !== "undefined") {
		cachedEntries = new Map(entries.map((e) => [e.path, e]));
		writeCache(body.head, body.entries, cacheKey).catch(() => {
			// Cache write failures are silent
		});
	}

	return visibleEntries(entries);
}

function fileOps(request: Request): VaultFileOps {
	return {
		read: (path) => readFile(request, path),
		write: (path, content, options = {}) =>
			writeOrCreate(request, { path, content }, options),
		list: () => listEntries(request),
		reload: () => reloadEntries(request),
		reloadEntry: unsupported("reloading a single entry"),
		rename: (renameRequest) => renameNote(request, renameRequest),
		renameFolder: (folderRequest) => renameFolder(request, folderRequest),
		createFolder: (folderRequest) => createFolder(request, folderRequest),
		deleteFolder: (folderPath) => deleteFolder(request, folderPath),
		delete: (paths) => deleteFiles(request, paths),
		search: (query, options = {}) => searchFiles(request, query, options),
		saveAttachment: (upload) => remoteAttachments(request).save(upload),
	};
}

function chromeOps(request: Request): VaultChromeOps {
	return {
		listFolders: () => listFolders(request),
		listViews: unsupported("listing views"),
	};
}

/** The server's origin: a ticket's `path` already carries any prefix the vault is served under. */
function socketOrigin(baseUrl: string): string {
	return new URL(baseUrl || globalThis.location.origin).origin.replace(
		/^http/u,
		"ws",
	);
}

async function docIdOf(request: Request, path: string): Promise<string> {
	assertVaultPath(path);
	await whenCreated(path);
	const response = await released(
		await ok(await request(`${ROUTES.files}/${encoded(path)}`)),
	);
	const docId = response.headers.get(DOC_ID_HEADER);
	if (!docId) throw new RemoteError(404, `${path} is not a note`);
	return docId;
}

/** A fresh ticket for every connection: a ticket opens one websocket. */
async function ticketUrl(
	request: Request,
	options: RemoteOptions,
	grant: { docId: string; access: string },
): Promise<string> {
	const response = await ok(
		await request(ROUTES.collabTickets, {
			method: "POST",
			body: JSON.stringify(grant),
		}),
	);
	const { path, ticket } = await jsonWithStrings<keyof CollabTicketResponse>(
		response,
		["path", "ticket"],
		"collaboration ticket",
	);
	// A server-relative path only: the socket must go to the server's own origin.
	if (!path.startsWith("/") || path.startsWith("//"))
		throw malformed("collaboration ticket");
	return `${socketOrigin(options.baseUrl)}${path}?${COLLAB_TICKET_PARAM}=${encodeURIComponent(ticket)}`;
}

async function openDoc(
	options: RemoteOptions,
	path: string,
	{ user, readOnly = false }: VaultCollabOpenOptions = {},
): Promise<VaultCollabDoc<RemoteBindings>> {
	const request = requester(options);
	const createSocket =
		options.createSocket ??
		((url: string) => new WebSocket(url) as unknown as SocketLike);
	const grant = {
		docId: await docIdOf(request, path),
		access: readOnly ? "read" : "write",
	};
	const doc = new Y.Doc();
	const provider = new CollabProvider({
		doc,
		...BROWSER_PRESENCE_PACING,
		openSocket: async () =>
			createSocket(await ticketUrl(request, options, grant)),
	});
	if (user) provider.awareness.setLocalStateField("user", user);
	const opened: VaultCollabDoc<RemoteBindings> = {
		path,
		doc,
		provider,
		fragment: doc.getXmlFragment(DOC_BLOCKS_FRAGMENT),
		awareness: provider.awareness,
		synced: provider.whenSynced(),
		close: () => {
			release();
			provider.destroy();
			doc.destroy();
		},
	};
	const release = followRenames(opened);
	return opened;
}

/** Attachment transfers with the server's credentials, for the shell's image handling. */
export function createRemoteAttachments(
	options: RemoteOptions & { now?: () => number },
): RemoteAttachments {
	return remoteAttachments(requester(options), options.now);
}

export function createRemoteVaultBackend(
	options: RemoteOptions,
): VaultBackend<RemoteBindings> {
	const request = requester(options);
	cacheKey = entriesCacheKey(options.baseUrl);
	return {
		kind: "remote",
		interfaceVersion: VAULT_BACKEND_INTERFACE_VERSION,
		capabilities: {
			collaboration: true,
			atomicRevisions: true,
			attachments: true,
		},
		files: fileOps(request),
		chrome: chromeOps(request),
		collab: {
			openDoc: (path, openOptions) => openDoc(options, path, openOptions),
		},
	};
}
