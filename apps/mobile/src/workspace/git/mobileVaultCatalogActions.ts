import type { MobileAnalyticsEvent } from "../../analytics/mobileAnalytics";
import { FolderOpenFailure, folderOpenStep } from "../folderOpenFailure";
import { pickNativeWorkspaceDirectory } from "../nativeWorkspacePicker";
import { prepareNativeWorkspace } from "../prepareNativeWorkspace";
import { requireActiveSync } from "../syncCancellation";
import type { GitHubSession } from "./githubAuth";
import {
	activateManagedGitVault,
	cloneManagedGitVault,
	forgetManagedVault,
	managedGitSelection,
} from "./managedGitStorage";
import type { ManagedGitVault } from "./managedGitVaults";
import {
	activateManagedLocalVault,
	rememberLocalVault,
} from "./managedLocalStorage";
import type { ManagedLocalVault } from "./managedLocalVaults";
import { nativeGitHttp } from "./nativeGitHttp";
import type { GitCloneControl } from "./useGitCloneProgress";
import type { ActiveVault } from "./useManagedVaultCatalog";

export type VaultTask = () => Promise<
	ActiveVault | null | "cancelled" | "unchanged"
>;
type CatalogActionsContext<Result> = {
	active: ActiveVault;
	catalog: { vaults: readonly ManagedGitVault[]; reload: () => Promise<void> };
	perform: (task: VaultTask) => Promise<Result>;
	currentSession: () => Promise<GitHubSession | null>;
	runClone: <T>(task: (control: GitCloneControl) => Promise<T>) => Promise<T>;
	startClone: () => void;
	capture: (event: MobileAnalyticsEvent) => void;
};

export function createMobileVaultCatalogActions<Result>(
	context: CatalogActionsContext<Result>,
) {
	const { active, catalog, perform, capture } = context;
	const openFolder = () => perform(() => openLocalFolder(context));
	const select = (vault: ManagedGitVault) =>
		perform(async () => {
			const next = await activateGit(vault);
			capture({
				name: "mobile_vault_catalog_used",
				action: "switch",
				kind: "git",
			});
			return next;
		});
	const selectLocal = (vault: ManagedLocalVault) =>
		perform(async () => {
			const selection = await activateManagedLocalVault(vault);
			capture({
				name: "mobile_vault_catalog_used",
				action: "switch",
				kind: "local",
			});
			return { selection: await prepareNativeWorkspace(selection), git: null };
		});
	const forget = (id: string) =>
		perform(async () => {
			const kind = catalog.vaults.some((vault) => vault.id === id)
				? "git"
				: "local";
			const isActive =
				active.git?.id === id ||
				active.selection?.catalogVaultId === id ||
				active.selection?.vaultAlias === id;
			await forgetManagedVault(id);
			await catalog.reload();
			capture({ name: "mobile_vault_catalog_used", action: "forget", kind });
			return isActive ? { selection: null, git: null } : "unchanged";
		});
	const clone = async (url: string) => {
		await perform(() =>
			context.runClone((control) => cloneVault(context, url, control)),
		);
	};
	return { openFolder, select, selectLocal, forget, clone };
}

async function openLocalFolder<Result>(context: CatalogActionsContext<Result>) {
	try {
		const selection = await folderOpenStep("picker", () =>
			pickNativeWorkspaceDirectory(context.active.selection?.vaultRootUri),
		);
		if (!selection) return "cancelled" as const;
		const vault = await folderOpenStep("catalog", () =>
			rememberLocalVault(selection),
		);
		await folderOpenStep("catalog", () => context.catalog.reload());
		const prepared = await folderOpenStep("prepare", async () =>
			prepareNativeWorkspace(await activateManagedLocalVault(vault)),
		);
		context.capture({
			name: "mobile_vault_catalog_used",
			action: "add",
			kind: "local",
		});
		context.capture({ name: "mobile_vault_created", kind: "folder" });
		return { selection: prepared, git: null };
	} catch (failure) {
		if (failure instanceof FolderOpenFailure)
			context.capture({
				name: "mobile_folder_open_failed",
				stage: failure.stage,
			});
		throw failure;
	}
}

async function activateGit(vault: ManagedGitVault): Promise<ActiveVault> {
	const selection = await managedGitSelection(vault);
	await activateManagedGitVault(vault.id);
	return { git: vault, selection: await prepareNativeWorkspace(selection) };
}

async function cloneVault<Result>(
	context: CatalogActionsContext<Result>,
	url: string,
	control: GitCloneControl,
) {
	const startedAt = Date.now();
	context.startClone();
	try {
		const session = await context.currentSession();
		requireActiveSync(control.signal);
		const vault = await cloneManagedGitVault(
			url,
			nativeGitHttp,
			session?.accessToken,
			control,
		);
		await context.catalog.reload();
		const active = await activateGit(vault);
		context.capture({
			name: "mobile_vault_catalog_used",
			action: "add",
			kind: "git",
		});
		context.capture({ name: "mobile_vault_created", kind: "git" });
		context.capture({
			name: "mobile_git_clone_completed",
			outcome: "success",
			duration_bucket: cloneDurationBucket(Date.now() - startedAt),
		});
		return active;
	} catch (failure) {
		const duration_bucket = cloneDurationBucket(Date.now() - startedAt);
		if (control.signal.aborted) {
			context.capture({
				name: "mobile_git_clone_completed",
				outcome: "cancelled",
				duration_bucket,
			});
			return "cancelled" as const;
		}
		context.capture({
			name: "mobile_git_clone_completed",
			outcome: "failed",
			failure_kind: cloneFailureKind(failure),
			duration_bucket,
		});
		throw failure;
	}
}

function cloneDurationBucket(
	durationMs: number,
): "<10s" | "10-30s" | "30-120s" | "2-10m" | ">10m" {
	if (durationMs < 10_000) return "<10s";
	if (durationMs < 30_000) return "10-30s";
	if (durationMs < 120_000) return "30-120s";
	if (durationMs < 600_000) return "2-10m";
	return ">10m";
}

const failureMatchers = [
	{ kind: "timeout", tokens: ["timeout", "timed out"] },
	{ kind: "denied", tokens: ["auth", "denied", "401", "403"] },
	{ kind: "network", tokens: ["network", "offline", "fetch"] },
] as const;

function cloneFailureKind(
	failure: unknown,
): "network" | "denied" | "timeout" | "unknown" {
	const message = failure instanceof Error ? failure.message.toLowerCase() : "";
	return (
		failureMatchers.find(({ tokens }) =>
			tokens.some((token) => message.includes(token)),
		)?.kind ?? "unknown"
	);
}
