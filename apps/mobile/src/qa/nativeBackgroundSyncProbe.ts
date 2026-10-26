import { requireNativeModule } from "expo";
import { Directory, File, Paths } from "expo-file-system";
import git, { type HttpClient } from "isomorphic-git";
import { AppState } from "react-native";
import { createExpoGitFileSystem } from "../workspace/git/expoGitFileSystem";
import { gitVirtualRoot } from "../workspace/git/gitFileSystemPaths";
import { cloneGitVault, syncGitVault } from "../workspace/git/gitRemote";
import { createMobileAutoGit } from "../workspace/git/mobileAutoGit";
import { nativeGitHttp } from "../workspace/git/nativeGitHttp";
import { runSavedVaultOperation } from "../workspace/git/savedVaultOperation";
import { withWorkspaceBackgroundSync } from "../workspace/workspaceBackgroundSync";
import { createWorkspaceSyncEditors } from "../workspace/workspaceSyncEditors";
import { createWorkspaceSyncLifecycle } from "../workspace/workspaceSyncLifecycle";
import { postNativeQaEvent, setNativeQaSinkUrl } from "./nativeQaSink";

const author = { name: "Background QA", email: "qa@example.invalid" };

/** Invoked only by the opt-in, loopback-only storage QA route. */
export async function runNativeBackgroundSyncProbe(
	endpoint: string,
	persistProof?: (proof: object) => void | Promise<void>,
): Promise<object> {
	const root = new Directory(
		Paths.cache,
		`tolaria-background-qa-${Date.now()}`,
	);
	root.create();
	let proof: object;
	try {
		const context = await prepareGit(root, endpoint);
		proof = await backgroundRoundTrip(context, endpoint);
	} catch (error) {
		proof = { passed: false, error: String(error) };
	} finally {
		root.delete();
	}
	if (persistProof) {
		try {
			await persistProof(proof);
		} catch (error) {
			proof = { ...proof, proofWriteError: String(error) };
		}
	}
	post(endpoint, "proof", proof);
	return proof;
}

async function prepareGit(root: Directory, endpoint: string) {
	const http: HttpClient = {
		request: (request) => {
			const url = new URL(request.url);
			return nativeGitHttp.request({
				...request,
				url: `${endpoint}${url.pathname}${url.search}`,
			});
		},
	};
	const connection = (name: string) => {
		const directory = new Directory(root, name);
		directory.create();
		return {
			directory,
			fs: createExpoGitFileSystem(directory.uri),
			dir: gitVirtualRoot,
			http,
		};
	};
	const desktop = connection("desktop");
	const tablet = connection("tablet");
	await cloneGitVault(desktop, "https://github.com/team/vault");
	await cloneGitVault(tablet, "https://github.com/team/vault");
	new File(desktop.directory, "desktop.md").write("# Desktop change\n");
	new File(tablet.directory, "tablet.md").write("# Tablet change\n");
	await syncGitVault(desktop, author);
	const merged = await syncGitVault(tablet, author);
	const oid = await git.resolveRef({ ...tablet, ref: "HEAD" });
	const parents = (await git.readCommit({ ...tablet, oid })).commit.parent;
	if (merged.kind !== "synced" || parents.length !== 2)
		throw new Error("nativeMergeFailed");
	return { ...tablet, mergeParentCount: parents.length };
}

async function backgroundRoundTrip(
	context: Awaited<ReturnType<typeof prepareGit>>,
	endpoint: string,
) {
	const native = requireNativeModule<{
		runLinkedBackgroundProbe: () => Promise<boolean>;
	}>("TolariaWorkspaceAccess");
	const editors = createWorkspaceSyncEditors();
	let prepared = false;
	const evidence: Record<string, unknown> = {
		phases: [] as string[],
		syncCallbackStarted: false,
		appStateAtProbeStart: AppState.currentState,
		appStateChanges: [] as string[],
	};
	editors.register(async () => {
		const draft = new File(context.directory, "background.md");
		draft.write("---\ncustom: preserved\n---\n# Background draft\n");
		prepared = true;
		evidence.draftExistsAfterPrepare = draft.exists;
		evidence.draftReadbackAfterPrepare = draft.exists
			? await draft.text()
			: null;
		return () => {};
	});
	let folderPassed = false;
	const scheduler = createMobileAutoGit((signal) =>
		runSavedVaultOperation({
			editors,
			rootUri: context.directory.uri,
			refresh: () => {},
			run: async () => {
				evidence.syncCallbackStarted = true;
				evidence.backgroundStateObserved = await waitForBackground();
				try {
					const result = await syncGitVault(
						{
							...context,
							signal,
							onPhase: (phase) => (evidence.phases as string[]).push(phase),
						},
						author,
					);
					evidence.syncResult = result;
					evidence.mergeParentCount = context.mergeParentCount;
					const head = await git.resolveRef({ ...context, ref: "HEAD" });
					try {
						await git.readBlob({
							...context,
							oid: head,
							filepath: "background.md",
						});
						evidence.localHeadContainsDraft = true;
					} catch {
						evidence.localHeadContainsDraft = false;
					}
					if (result.kind !== "synced") throw new Error("backgroundPushFailed");
					folderPassed = await native.runLinkedBackgroundProbe();
					return "unchanged";
				} catch (error) {
					evidence.syncError = String(error);
					throw error;
				}
			},
		}),
	);
	const proof = await observeDeparture(
		scheduler,
		endpoint,
		(state) => {
			(evidence.appStateChanges as string[]).push(state);
		},
		() => ({
			passed: prepared && folderPassed,
			prepared,
			folderPassed,
			state: AppState.currentState,
			merged: context.mergeParentCount === 2,
			...evidence,
		}),
	);
	return proof;
}

async function observeDeparture(
	scheduler: ReturnType<typeof createMobileAutoGit>,
	endpoint: string,
	recordState: (state: string) => void,
	proof: () => object,
) {
	let complete: () => void = () => {};
	let fail: (error: unknown) => void = () => {};
	const done = new Promise<void>((resolve, reject) => {
		complete = resolve;
		fail = reject;
	});
	const lifecycle = createWorkspaceSyncLifecycle(
		scheduler,
		() => ({ enabled: true, blocked: false }),
		AppState.currentState,
		async (run) => {
			try {
				await withWorkspaceBackgroundSync(run);
				complete();
			} catch (error) {
				fail(error);
			}
		},
	);
	const subscription = AppState.addEventListener("change", (state) => {
		recordState(state);
		lifecycle.change(state);
	});
	const timeout = setTimeout(
		() => fail(new Error("backgroundDepartureTimedOut")),
		90_000,
	);
	try {
		post(endpoint, "ready", { ready: true });
		await done;
		return proof();
	} finally {
		clearTimeout(timeout);
		subscription.remove();
		scheduler.dispose();
	}
}

function waitForBackground() {
	if (AppState.currentState === "background")
		return Promise.resolve(AppState.currentState);
	return new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			subscription.remove();
			reject(new Error("notBackgrounded"));
		}, 5000);
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "background") {
				clearTimeout(timer);
				subscription.remove();
				resolve(state);
			}
		});
	});
}

function post(endpoint: string, path: "ready" | "proof", proof: object) {
	setNativeQaSinkUrl(new URL(path, `${endpoint}/`).toString());
	postNativeQaEvent(proof);
}
