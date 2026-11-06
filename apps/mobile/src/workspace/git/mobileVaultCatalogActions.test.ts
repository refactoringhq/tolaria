import { beforeEach, expect, it, vi } from "vitest";
import { FolderOpenFailure } from "../folderOpenFailure";
import { pickNativeWorkspaceDirectory } from "../nativeWorkspacePicker";
import {
	activateManagedGitVault,
	cloneManagedGitVault,
	forgetManagedVault,
	managedGitSelection,
} from "./managedGitStorage";
import {
	activateManagedLocalVault,
	rememberLocalVault,
} from "./managedLocalStorage";
import {
	createMobileVaultCatalogActions,
	type VaultTask,
} from "./mobileVaultCatalogActions";
import { nativeGitHttp } from "./nativeGitHttp";
import type { GitCloneControl } from "./useGitCloneProgress";
import type { ActiveVault } from "./useManagedVaultCatalog";

vi.mock("../nativeWorkspacePicker", () => ({
	pickNativeWorkspaceDirectory: vi.fn(),
}));
vi.mock("./managedGitStorage", () => ({
	activateManagedGitVault: vi.fn(),
	cloneManagedGitVault: vi.fn(),
	forgetManagedVault: vi.fn(),
	managedGitSelection: vi.fn(),
}));
vi.mock("./managedLocalStorage", () => ({
	activateManagedLocalVault: vi.fn(),
	rememberLocalVault: vi.fn(),
}));
vi.mock("./nativeGitHttp", () => ({ nativeGitHttp: { request: vi.fn() } }));

const gitVault = {
	id: "git-vault",
	label: "Git fixture",
	repositoryUrl: "https://github.com/example/fixture",
};
const localVault = {
	id: "local-vault",
	label: "Local fixture",
	directory: "Local Vaults/local-vault",
};
const selection = {
	vaultAlias: "local-vault",
	vaultLabel: "Fixture",
	vaultRootUri: "file:///fixture/",
};

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(pickNativeWorkspaceDirectory).mockResolvedValue(selection);
	vi.mocked(rememberLocalVault).mockResolvedValue(localVault);
	vi.mocked(activateManagedLocalVault).mockResolvedValue(selection);
	vi.mocked(cloneManagedGitVault).mockResolvedValue(gitVault);
	vi.mocked(managedGitSelection).mockResolvedValue(selection);
});

function harness(active: ActiveVault = { selection, git: null }) {
	const controller = new AbortController();
	const control: GitCloneControl = {
		signal: controller.signal,
		onProgress: vi.fn(),
		onPublish: vi.fn(),
	};
	const context = {
		active,
		catalog: { vaults: [gitVault], reload: vi.fn(async () => {}) },
		perform: vi.fn((task: VaultTask) => task()),
		currentSession: vi.fn(async () => ({
			accessToken: "fixture-token",
			login: "fixture",
			userId: 1,
		})),
		runClone: async <T>(task: (options: GitCloneControl) => Promise<T>) =>
			task(control),
		startClone: vi.fn(),
		capture: vi.fn(),
	};
	return {
		...context,
		controller,
		control,
		actions: createMobileVaultCatalogActions(context),
	};
}

it("adds a picked folder through the save barrier, then activates its catalog entry", async () => {
	const h = harness();
	expect(await h.actions.openFolder()).toEqual({ selection, git: null });
	expect(h.perform).toHaveBeenCalledOnce();
	expect(pickNativeWorkspaceDirectory).toHaveBeenCalledWith(
		selection.vaultRootUri,
	);
	expect(rememberLocalVault).toHaveBeenCalledWith(selection);
	expect(h.catalog.reload).toHaveBeenCalledOnce();
	expect(activateManagedLocalVault).toHaveBeenCalledWith(localVault);
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_catalog_used",
		action: "add",
		kind: "local",
	});
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_created",
		kind: "folder",
	});
});

it("does not remember or activate anything when the folder picker is cancelled", async () => {
	const h = harness({ selection: null, git: null });
	vi.mocked(pickNativeWorkspaceDirectory).mockResolvedValue(null);
	expect(await h.actions.openFolder()).toBe("cancelled");
	expect(pickNativeWorkspaceDirectory).toHaveBeenCalledWith(undefined);
	expect(rememberLocalVault).not.toHaveBeenCalled();
	expect(h.capture).not.toHaveBeenCalled();
});

it("cannot execute catalog mutations when the save barrier fails", async () => {
	const h = harness();
	h.perform.mockRejectedValue(new Error("saveFailed"));
	await expect(h.actions.openFolder()).rejects.toThrow("saveFailed");
	await expect(h.actions.clone(gitVault.repositoryUrl)).rejects.toThrow(
		"saveFailed",
	);
	await expect(h.actions.select(gitVault)).rejects.toThrow("saveFailed");
	await expect(h.actions.selectLocal(localVault)).rejects.toThrow("saveFailed");
	await expect(h.actions.forget(localVault.id)).rejects.toThrow("saveFailed");
	expect(pickNativeWorkspaceDirectory).not.toHaveBeenCalled();
	expect(cloneManagedGitVault).not.toHaveBeenCalled();
	expect(activateManagedGitVault).not.toHaveBeenCalled();
	expect(activateManagedLocalVault).not.toHaveBeenCalled();
	expect(forgetManagedVault).not.toHaveBeenCalled();
	expect(h.capture).not.toHaveBeenCalled();
});

it("switches Git vaults only after their working copy is resolved", async () => {
	const h = harness();
	const order: string[] = [];
	vi.mocked(managedGitSelection).mockImplementation(async () => {
		order.push("resolve");
		return selection;
	});
	vi.mocked(activateManagedGitVault).mockImplementation(async () => {
		order.push("activate");
	});
	expect(await h.actions.select(gitVault)).toEqual({
		selection,
		git: gitVault,
	});
	expect(order).toEqual(["resolve", "activate"]);
	expect(h.perform).toHaveBeenCalledOnce();
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_catalog_used",
		action: "switch",
		kind: "git",
	});
});

it("does not change the active catalog entry when a Git working copy is unavailable", async () => {
	const h = harness();
	vi.mocked(managedGitSelection).mockRejectedValue(new Error("unavailable"));
	await expect(h.actions.select(gitVault)).rejects.toThrow("unavailable");
	expect(activateManagedGitVault).not.toHaveBeenCalled();
	expect(h.capture).not.toHaveBeenCalled();
});

it("switches local vaults through the same save barrier", async () => {
	const h = harness();
	expect(await h.actions.selectLocal(localVault)).toEqual({
		selection,
		git: null,
	});
	expect(h.perform).toHaveBeenCalledOnce();
	expect(activateManagedLocalVault).toHaveBeenCalledWith(localVault);
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_catalog_used",
		action: "switch",
		kind: "local",
	});
});

it.each([
	{
		active: { selection, git: null },
		id: localVault.id,
		kind: "local",
		next: { selection: null, git: null },
	},
	{
		active: { selection, git: gitVault },
		id: gitVault.id,
		kind: "git",
		next: { selection: null, git: null },
	},
	{
		active: { selection, git: null },
		id: gitVault.id,
		kind: "git",
		next: "unchanged",
	},
])(
	"forgets $kind catalog metadata without changing unrelated selection",
	async ({ active, id, kind, next }) => {
		const h = harness(active);
		expect(await h.actions.forget(id)).toEqual(next);
		expect(h.perform).toHaveBeenCalledOnce();
		expect(forgetManagedVault).toHaveBeenCalledExactlyOnceWith(id);
		expect(h.catalog.reload).toHaveBeenCalledOnce();
		expect(h.capture).toHaveBeenCalledWith({
			name: "mobile_vault_catalog_used",
			action: "forget",
			kind,
		});
	},
);

it("clones with progress and refreshed credentials before publishing the active selection", async () => {
	const h = harness();
	await h.actions.clone(gitVault.repositoryUrl);
	expect(h.perform).toHaveBeenCalledOnce();
	expect(h.startClone).toHaveBeenCalledOnce();
	expect(cloneManagedGitVault).toHaveBeenCalledWith(
		gitVault.repositoryUrl,
		nativeGitHttp,
		"fixture-token",
		h.control,
	);
	expect(h.catalog.reload).toHaveBeenCalledOnce();
	expect(activateManagedGitVault).toHaveBeenCalledWith(gitVault.id);
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_catalog_used",
		action: "add",
		kind: "git",
	});
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_vault_created",
		kind: "git",
	});
	expect(h.capture).toHaveBeenCalledWith({
		name: "mobile_git_clone_completed",
		outcome: "success",
		duration_bucket: "<10s",
	});
});

it("cancels before transport when authorization returns after cancellation", async () => {
	const h = harness();
	h.controller.abort();
	await h.actions.clone(gitVault.repositoryUrl);
	expect(await h.perform.mock.results[0].value).toBe("cancelled");
	expect(cloneManagedGitVault).not.toHaveBeenCalled();
	expect(h.catalog.reload).not.toHaveBeenCalled();
	expect(h.capture).toHaveBeenCalledExactlyOnceWith({
		name: "mobile_git_clone_completed",
		outcome: "cancelled",
		duration_bucket: "<10s",
	});
});

it("does not report cancellation as a clone failure or publish a partial clone", async () => {
	const h = harness();
	vi.mocked(cloneManagedGitVault).mockImplementation(async () => {
		h.controller.abort();
		throw new Error("cancelled");
	});
	await h.actions.clone(gitVault.repositoryUrl);
	expect(await h.perform.mock.results[0].value).toBe("cancelled");
	expect(h.catalog.reload).not.toHaveBeenCalled();
	expect(activateManagedGitVault).not.toHaveBeenCalled();
	expect(h.capture).toHaveBeenCalledExactlyOnceWith({
		name: "mobile_git_clone_completed",
		outcome: "cancelled",
		duration_bucket: "<10s",
	});
});

it("propagates real clone failures to the recovery owner without activating the clone", async () => {
	const h = harness();
	vi.mocked(cloneManagedGitVault).mockRejectedValue(new Error("offline"));
	await expect(h.actions.clone(gitVault.repositoryUrl)).rejects.toThrow(
		"offline",
	);
	expect(h.catalog.reload).not.toHaveBeenCalled();
	expect(activateManagedGitVault).not.toHaveBeenCalled();
	expect(h.capture).toHaveBeenCalledExactlyOnceWith({
		name: "mobile_git_clone_completed",
		outcome: "failed",
		failure_kind: "network",
		duration_bucket: "<10s",
	});
});

it.each([
	{
		stage: "picker",
		reject: () =>
			vi
				.mocked(pickNativeWorkspaceDirectory)
				.mockRejectedValue(new Error("private")),
	},
	{
		stage: "import",
		reject: () =>
			vi
				.mocked(pickNativeWorkspaceDirectory)
				.mockRejectedValue(new FolderOpenFailure("import", "private")),
	},
	{
		stage: "catalog",
		reject: () =>
			vi.mocked(rememberLocalVault).mockRejectedValue(new Error("private")),
	},
	{
		stage: "prepare",
		reject: () =>
			vi
				.mocked(activateManagedLocalVault)
				.mockRejectedValue(new Error("private")),
	},
])(
	"reports only the $stage failure category, never a successful folder open",
	async ({ stage, reject }) => {
		const h = harness();
		const active = h.active;
		reject();
		await expect(h.actions.openFolder()).rejects.toMatchObject({ stage });
		expect(h.capture).toHaveBeenCalledExactlyOnceWith({
			name: "mobile_folder_open_failed",
			stage,
		});
		expect(h.active).toBe(active);
		expect(forgetManagedVault).not.toHaveBeenCalled();
	},
);
