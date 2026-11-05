import git, { type GitProgressEvent, type HttpClient } from "isomorphic-git";
import { requireActiveSync } from "../syncCancellation";
import { fetchTrackedGitBranch } from "./fetchTrackedGitBranch";
import { ensureGitMergeHistory } from "./gitHistory";
import { createGitTaskRunner } from "./gitTaskRunner";
import {
	createGitVault,
	type GitAuthor,
	type GitVaultContext,
	githubRepositoryUrl,
} from "./gitVault";
import { withWorkspaceOperation } from "./workspaceOperationQueue";
import { withSavedWorkspace } from "./workspaceWriteQueue";

export type GitSyncPhase = "checkpoint" | "fetch" | "checkout" | "push";
export type GitLocalAccess = <T>(
	operation: () => Promise<{ value: T; workspaceChanged: boolean }>,
) => Promise<T>;
export type GitRemoteOptions = GitVaultContext & {
	checkpoint?: boolean;
	http: HttpClient;
	token?: string;
	getToken?: () => Promise<string | undefined>;
	signal?: AbortSignal;
	onPhase?: (phase: GitSyncPhase) => void;
	onProgress?: (progress: GitProgressEvent) => void;
	operationKey?: string;
	withLocalAccess?: GitLocalAccess;
	onCheckpoint?: (oid: string) => void;
};

export function cloneGitVault(
	options: GitRemoteOptions,
	repositoryUrl: string,
) {
	const url = githubRepositoryUrl(repositoryUrl);
	return withWorkspaceOperation(
		options.operationKey ?? options.dir,
		async () => {
			requireActiveSync(options.signal);
			await git.clone({
				...transport(options, url),
				url,
				singleBranch: true,
				depth: 1,
				noTags: true,
				nonBlocking: true,
				batchSize: 20,
			});
			requireActiveSync(options.signal);
		},
	);
}

export function syncGitVault(options: GitRemoteOptions, author: GitAuthor) {
	return withWorkspaceOperation(
		`git-sync:${options.operationKey ?? options.dir}`,
		() => syncUnlocked(options, author),
	);
}

async function syncUnlocked(options: GitRemoteOptions, author: GitAuthor) {
	const { fs, dir } = options;
	const context = { fs, dir, cache: {} };
	const url = githubRepositoryUrl(
		String(await git.getConfig({ ...context, path: "remote.origin.url" })),
	);
	const ref = await git.currentBranch(context);
	if (!ref) throw new Error("detachedHead");
	emitPhase(options, "checkpoint");
	const checkpoint = await localAccess(options, async () => {
		const value = await checkpointLocal(options, context, author);
		return { value, workspaceChanged: value.workspaceChanged };
	});
	requireActiveSync(options.signal);
	const token = options.getToken ? await options.getToken() : options.token;
	const connection = transport(
		{ ...options, token, cache: context.cache },
		url,
	);
	const result = await syncHeads(options, { ...connection, url, ref }, author);
	return {
		...result,
		workspaceChanged: checkpoint.workspaceChanged || result.workspaceChanged,
		changedFiles: checkpoint.changedFiles,
	};
}

type GitConnection = ReturnType<typeof transport> & {
	url: string;
	ref: string;
};

async function syncHeads(
	options: GitRemoteOptions,
	connection: GitConnection,
	author: GitAuthor,
) {
	let workspaceChanged = false;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const integrated = await fetchAndIntegrate(options, connection, author);
		workspaceChanged ||= integrated.workspaceChanged;
		if (integrated.kind === "diverged")
			return { kind: "diverged" as const, workspaceChanged };
		const needsPush = ["ahead", "merged"].includes(integrated.kind);
		if (!needsPush || (await pushCurrentHead(options, connection))) {
			return { kind: "synced" as const, workspaceChanged };
		}
	}
	throw new Error("pushRejected");
}

async function fetchAndIntegrate(
	options: GitRemoteOptions,
	connection: GitConnection,
	author: GitAuthor,
) {
	emitPhase(options, "fetch");
	await fetchTrackedGitBranch(connection);
	const remoteHead = () =>
		git.resolveRef({
			...connection,
			ref: `refs/remotes/origin/${connection.ref}`,
		});
	const remoteOid = await ensureGitMergeHistory(
		connection,
		await remoteHead(),
		async (boundaries) => {
			for (const oid of boundaries) {
				requireActiveSync(options.signal);
				await git.fetch({
					...connection,
					ref: oid,
					remoteRef: oid,
					singleBranch: true,
					tags: false,
					relative: true,
					depth: 16,
				});
			}
			return remoteHead();
		},
	);
	emitPhase(options, "checkout");
	return localAccess(options, async () => {
		requireActiveSync(options.signal);
		// Edits may have arrived while fetching; checkpoint them before replacement.
		const checkpoint = await checkpointLocal(options, connection, author);
		// Recovery can replace files even when the fresh checkpoint now matches remote.
		const kind =
			checkpoint.oid === remoteOid
				? "equal"
				: await createGitVault(connection).integrateVerifiedCleanWorkspace(
						remoteOid,
						author,
					);
		const workspaceChanged =
			checkpoint.workspaceChanged || ["updated", "merged"].includes(kind);
		return { value: { kind, workspaceChanged }, workspaceChanged };
	});
}

async function checkpointLocal(
	options: GitRemoteOptions,
	context: GitVaultContext,
	author: GitAuthor,
) {
	const vault = createGitVault(context);
	const checkpoint = await (options.checkpoint === false
		? vault.requireClean()
		: vault.checkpoint(author));
	options.onCheckpoint?.(checkpoint.oid);
	return checkpoint;
}

async function localAccess<T>(
	options: GitRemoteOptions,
	operation: () => Promise<{ value: T; workspaceChanged: boolean }>,
) {
	const run = () =>
		withSavedWorkspace(options.operationKey ?? options.dir, operation);
	return options.withLocalAccess
		? options.withLocalAccess(run)
		: (await run()).value;
}

async function pushCurrentHead(
	options: GitRemoteOptions,
	connection: GitConnection,
) {
	emitPhase(options, "push");
	try {
		const ref = `refs/heads/${connection.ref}`;
		return (
			await git.push({ ...connection, ref, remoteRef: ref, force: false })
		).ok;
	} catch (error) {
		if (
			error instanceof git.Errors.PushRejectedError &&
			error.data.reason === "not-fast-forward"
		)
			return false;
		throw error;
	}
}

function emitPhase(options: GitRemoteOptions, phase: GitSyncPhase) {
	requireActiveSync(options.signal);
	options.onPhase?.(phase);
	requireActiveSync(options.signal);
}

function transport(
	{ fs, dir, http, token, cache, signal, onProgress }: GitRemoteOptions,
	repositoryUrl: string,
) {
	const { run } = createGitTaskRunner();
	return {
		fs,
		dir,
		http: {
			request: (request: Parameters<HttpClient["request"]>[0]) => {
				requireActiveSync(signal);
				return http.request({ ...request, signal });
			},
		},
		cache,
		onProgress: (progress: GitProgressEvent) =>
			run(() => {
				requireActiveSync(signal);
				onProgress?.(progress);
				requireActiveSync(signal);
			}),
		onAuth: (url: string) => {
			if (githubRepositoryUrl(url) !== repositoryUrl || !token)
				return { cancel: true as const };
			return { username: "x-access-token", password: token };
		},
		onAuthFailure: () => ({ cancel: true as const }),
	};
}
