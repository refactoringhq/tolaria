import { type MutableRefObject, useCallback, useEffect, useRef } from "react";
import type { VaultOption } from "../components/status-bar/types";
import { entryAtStoredPath, newNotePath } from "../lib/remoteNotes";
import { trackEvent } from "../lib/telemetry";
import type { VaultEntry } from "../types";
import {
	NOTE_FORMAT_SHEET,
	type NoteFormat,
	normalizeNoteFormat,
} from "../utils/noteFormat";
import { normalizeVaultRelativePath } from "../utils/notePathIdentity";
import { slugifyNoteStem as slugify } from "../utils/noteSlug";
import type { ResolvedEntry } from "./noteCreationCore";
import type { TypeInstanceDefault } from "./noteCreationDefaults";
import {
	addEntryWithMock,
	applyTypeDefaults,
	buildNewEntry,
	buildNoteContent,
	createPersistFailureMessage,
	persistNewNote,
	RAPID_CREATE_NOTE_SETTLE_MS,
	resolveCreationVaultPath,
	resolveTemplate,
	resolveTypeInstanceDefaults,
	slug_to_title,
	workspaceForVaultPath,
} from "./noteCreationCore";
import { requestEditorFocus } from "./useEditorFocus";
import { cacheNoteContent } from "./useTabManagement";

interface ImmediateCreateDeps {
	addPendingSave?: (path: string) => void;
	defaultWorkspacePath?: string | null;
	entries: VaultEntry[];
	vaultPath: string;
	vaults?: readonly VaultOption[];
	pendingSlugs: Set<string>;
	openTabWithContent: (entry: VaultEntry, content: string) => void;
	addEntry: (entry: VaultEntry) => void;
	onNewNotePersisted?: (path: string) => void;
	removePendingSave?: (path: string) => void;
	setToastMessage: (msg: string | null) => void;
}

type ImmediateCreationPath =
	| "calendar_day"
	| "cmd_n"
	| "cmd_sheet"
	| "folder_command_palette"
	| "folder_context_menu"
	| "folder_header"
	| "type_section";

export interface ImmediateCreateOptions {
	creationPath?: ImmediateCreationPath;
	format?: NoteFormat;
	folderPath?: string;
	vaultPath?: string;
	/** Frontmatter the new note starts with; it wins over the type's instance defaults. */
	properties?: Record<string, string>;
}

interface ImmediateCreateRequest extends ImmediateCreateOptions {
	type?: string;
}

interface ImmediateCreateQueueConfig {
	addPendingSave?: (path: string) => void;
	defaultWorkspacePath?: string | null;
	entries: VaultEntry[];
	vaultPath: string;
	vaults?: readonly VaultOption[];
	addEntry: (entry: VaultEntry) => void;
	openTabWithContent: (entry: VaultEntry, content: string) => void;
	onNewNotePersisted?: (path: string) => void;
	removePendingSave?: (path: string) => void;
	setToastMessage: (msg: string | null) => void;
}

/** Generate a unique untitled filename using a timestamp. */
function generateUntitledFilename(
	entries: VaultEntry[],
	label: string,
	pendingSlugs?: Set<string>,
): string {
	const ts = Math.floor(Date.now() / 1000);
	const typeSlug = label === "Note" ? "note" : slugify(label);
	const base = `untitled-${typeSlug}-${ts}`;
	const existingSlugs = new Set(
		entries.map((entry) => entry.filename.replace(/\.md$/, "")),
	);

	let candidate = base;
	let suffix = 2;
	while (existingSlugs.has(candidate) || pendingSlugs?.has(candidate)) {
		candidate = `${base}-${suffix}`;
		suffix += 1;
	}

	pendingSlugs?.add(candidate);
	return candidate;
}

async function persistImmediateEntry(
	deps: ImmediateCreateDeps,
	entry: VaultEntry,
	content: string,
): Promise<string | null> {
	deps.addPendingSave?.(entry.path);
	try {
		const storedPath = await persistNewNote({
			path: entry.path,
			content,
			vaultPath: entry.workspace?.path,
		});
		deps.onNewNotePersisted?.(storedPath);
		return storedPath;
	} catch (error) {
		deps.setToastMessage(createPersistFailureMessage(entry, error));
		return null;
	} finally {
		deps.removePendingSave?.(entry.path);
	}
}

/** Create an untitled note and write its backing file before opening it. */
function resolveImmediateCreationVaultPath(
	deps: ImmediateCreateDeps,
	request: ImmediateCreateRequest,
): string {
	return (
		request.vaultPath ??
		resolveCreationVaultPath(
			deps.vaultPath,
			deps.defaultWorkspacePath,
			deps.vaults,
		)
	);
}

function immediateNoteRelativePath(slug: string, folderPath?: string): string {
	const folder = normalizeVaultRelativePath(folderPath ?? "");
	return folder ? `${folder}/${slug}.md` : `${slug}.md`;
}

/** Prefilled properties (a calendar day, for example) replace the type's default for the same key. */
function withInitialProperties(
	typeDefaults: TypeInstanceDefault[],
	properties: Record<string, string> = {},
): TypeInstanceDefault[] {
	const initial = Object.entries(properties).map(
		([key, value]): TypeInstanceDefault => ({ key, value, kind: "property" }),
	);
	const keys = new Set(Object.keys(properties));
	return [
		...initial,
		...typeDefaults.filter((defaultValue) => !keys.has(defaultValue.key)),
	];
}

function resolveImmediateEntry(
	deps: ImmediateCreateDeps,
	request: ImmediateCreateRequest,
): ResolvedEntry {
	const noteType = request.type || "Note";
	const noteFormat = normalizeNoteFormat(request.format);
	const untitledLabel = noteFormat === NOTE_FORMAT_SHEET ? "Sheet" : noteType;
	const slug = generateUntitledFilename(
		deps.entries,
		untitledLabel,
		deps.pendingSlugs,
	);
	const title = slug_to_title(slug);
	const template =
		noteFormat === NOTE_FORMAT_SHEET
			? null
			: resolveTemplate({ entries: deps.entries, typeName: noteType });
	const defaults = withInitialProperties(
		resolveTypeInstanceDefaults({ entries: deps.entries, typeName: noteType }),
		request.properties,
	);
	const creationVaultPath = resolveImmediateCreationVaultPath(deps, request);
	const entry = {
		...buildNewEntry({
			path: newNotePath(
				creationVaultPath,
				immediateNoteRelativePath(slug, request.folderPath),
			),
			slug,
			title,
			type: noteType,
			status: null,
		}),
		workspace: workspaceForVaultPath(
			creationVaultPath,
			deps.vaults,
			deps.defaultWorkspacePath,
		),
	};
	const content = buildNoteContent({
		title: null,
		type: noteType,
		status: null,
		format: noteFormat,
		template,
		initialEmptyHeading: noteFormat !== NOTE_FORMAT_SHEET,
		defaults,
	});
	return applyTypeDefaults({ entry, content, defaults });
}

async function createNoteImmediate(
	deps: ImmediateCreateDeps,
	request: ImmediateCreateRequest,
): Promise<boolean> {
	const resolved = resolveImmediateEntry(deps, request);
	const storedPath = await persistImmediateEntry(
		deps,
		resolved.entry,
		resolved.content,
	);
	if (storedPath === null) return false;
	const created = entryAtStoredPath(resolved.entry, storedPath);
	cacheNoteContent(created.path, resolved.content, created);
	deps.openTabWithContent(created, resolved.content);
	addEntryWithMock(created, resolved.content, deps.addEntry);
	requestEditorFocus({
		t0: performance.now(),
		selectTitle: true,
		path: created.path,
	});
	return true;
}

function trackImmediateCreate(
	request: ImmediateCreateRequest,
	didCreate: boolean,
): void {
	if (!didCreate) return;
	trackEvent("note_created", {
		has_type: request.type ? 1 : 0,
		creation_path:
			request.creationPath ?? (request.type ? "type_section" : "cmd_n"),
		format: normalizeNoteFormat(request.format),
	});
}

function useLatestImmediateCreateDeps(
	config: ImmediateCreateQueueConfig,
	pendingSlugsRef: MutableRefObject<Set<string>>,
) {
	const {
		defaultWorkspacePath,
		entries,
		vaultPath,
		vaults,
		openTabWithContent,
		addEntry,
		addPendingSave,
		onNewNotePersisted,
		removePendingSave,
		setToastMessage,
	} = config;
	const latestDepsRef = useRef<ImmediateCreateDeps | null>(null);
	const syncDeps = useCallback(() => {
		latestDepsRef.current = {
			entries,
			defaultWorkspacePath,
			vaultPath,
			vaults,
			pendingSlugs: pendingSlugsRef.current,
			openTabWithContent,
			addEntry,
			addPendingSave,
			onNewNotePersisted,
			removePendingSave,
			setToastMessage,
		};
	}, [
		entries,
		defaultWorkspacePath,
		vaultPath,
		vaults,
		openTabWithContent,
		addEntry,
		addPendingSave,
		onNewNotePersisted,
		removePendingSave,
		setToastMessage,
		pendingSlugsRef,
	]);

	useEffect(() => {
		syncDeps();
	}, [syncDeps]);

	return { latestDepsRef, syncDeps };
}

export function useImmediateCreateQueue(
	config: ImmediateCreateQueueConfig,
): (type?: string, options?: ImmediateCreateOptions) => void {
	const pendingSlugsRef = useRef<Set<string>>(new Set());
	const queuedImmediateCreatesRef = useRef<ImmediateCreateRequest[]>([]);
	const immediateCreateLockedRef = useRef(false);
	const immediateCreateTimerRef = useRef<number | null>(null);
	const queueMountedRef = useRef(true);
	const { latestDepsRef, syncDeps } = useLatestImmediateCreateDeps(
		config,
		pendingSlugsRef,
	);

	const executeRequest = useCallback(
		async (request: ImmediateCreateRequest): Promise<void> => {
			const deps = latestDepsRef.current;
			if (!deps) return;

			try {
				const didCreate = await createNoteImmediate(deps, request);
				trackImmediateCreate(request, didCreate);
			} catch (error) {
				console.warn("Failed to create immediate note:", error);
			}
		},
		[latestDepsRef],
	);

	const scheduleQueuedBurst = useCallback(
		function scheduleQueuedBurst() {
			if (!queueMountedRef.current) return;
			if (immediateCreateTimerRef.current !== null) return;

			immediateCreateTimerRef.current = window.setTimeout(async () => {
				immediateCreateTimerRef.current = null;
				const next = queuedImmediateCreatesRef.current.shift();
				if (!next) {
					immediateCreateLockedRef.current = false;
					return;
				}

				await executeRequest(next);
				scheduleQueuedBurst();
			}, RAPID_CREATE_NOTE_SETTLE_MS);
		},
		[executeRequest],
	);

	useEffect(() => {
		queueMountedRef.current = true;
		return () => {
			queueMountedRef.current = false;
			if (immediateCreateTimerRef.current !== null) {
				window.clearTimeout(immediateCreateTimerRef.current);
			}
		};
	}, []);

	return useCallback(
		(type?: string, options: ImmediateCreateOptions = {}) => {
			syncDeps();
			const request = { ...options, type };
			if (immediateCreateLockedRef.current) {
				queuedImmediateCreatesRef.current.push(request);
				return;
			}

			immediateCreateLockedRef.current = true;
			void executeRequest(request).then(scheduleQueuedBurst);
		},
		[syncDeps, executeRequest, scheduleQueuedBurst],
	);
}
