import { beforeEach, expect, it, vi } from "vitest";
import type { ManagedGitVaultCatalog } from "./managedGitVaults";
import { initializeLocalVaultCatalog } from "./managedLocalStorage.native";

const state = vi.hoisted(() => ({
	catalog: { vaults: [], activeId: null } as ManagedGitVaultCatalog,
	read: vi.fn(),
	write: vi.fn(),
	legacy: vi.fn(),
	starter: vi.fn(),
}));
vi.mock("expo-file-system", () => ({ Directory: class {}, Paths: {} }));
vi.mock("expo-crypto", () => ({ randomUUID: vi.fn() }));
vi.mock("../nativeWorkspacePicker", () => ({
	restoreNativeWorkspaceDirectory: state.legacy,
}));
vi.mock("./bundledStarterVault.native", () => ({
	prepareBundledStarterVault: state.starter,
}));
vi.mock("./managedGitStorage.native", () => ({
	readManagedGitCatalog: state.read,
	updateManagedGitCatalog: state.write,
}));

const starter = {
	id: "getting-started",
	label: "Getting Started",
	directory: "Local Vaults/getting-started",
};

beforeEach(() => {
	vi.resetAllMocks();
	state.catalog = { vaults: [], activeId: null };
	state.read.mockImplementation(async () => structuredClone(state.catalog));
	state.write.mockImplementation(
		async (
			update: (catalog: ManagedGitVaultCatalog) => ManagedGitVaultCatalog,
		) => {
			state.catalog = update(state.catalog);
			return state.catalog;
		},
	);
	state.legacy.mockResolvedValue(null);
	state.starter.mockResolvedValue(starter);
});

it("registers the verified local starter and activates it once on first launch", async () => {
	const onCreated = vi.fn();
	expect(await initializeLocalVaultCatalog(onCreated)).toEqual({
		vaults: [],
		activeId: null,
		localVaults: [starter],
		activeLocalId: starter.id,
	});
	expect(onCreated).toHaveBeenCalledOnce();
	await initializeLocalVaultCatalog(onCreated);
	expect(onCreated).toHaveBeenCalledOnce();
	await initializeLocalVaultCatalog();
	expect(state.starter).toHaveBeenCalledOnce();
	expect(state.write).toHaveBeenCalledOnce();
});

it.each([{ localVaults: [] }, { localVaults: [starter] }])(
	"preserves an existing local catalog including an intentionally empty one",
	async ({ localVaults }) => {
		state.catalog = {
			vaults: [],
			activeId: null,
			localVaults,
			activeLocalId: null,
		};
		const before = structuredClone(state.catalog);
		expect(await initializeLocalVaultCatalog()).toEqual(before);
		expect(state.starter).not.toHaveBeenCalled();
		expect(state.legacy).not.toHaveBeenCalled();
		expect(state.write).not.toHaveBeenCalled();
	},
);

it("migrates a legacy folder instead of creating the starter", async () => {
	state.legacy.mockResolvedValue({ vaultLabel: "Legacy" });
	const result = await initializeLocalVaultCatalog();
	expect(result.localVaults).toEqual([
		{ id: "local-legacy", label: "Legacy", directory: "Tolaria Vault" },
	]);
	expect(state.starter).not.toHaveBeenCalled();
});

it("keeps Git selection and does not seed an existing installation without local entries", async () => {
	state.catalog = {
		vaults: [
			{
				id: "remote",
				label: "Remote",
				repositoryUrl: "https://github.com/team/vault.git",
			},
		],
		activeId: "remote",
	};
	state.starter.mockResolvedValue(null);
	const result = await initializeLocalVaultCatalog();
	expect(result.activeId).toBe("remote");
	expect(result.localVaults).toEqual([]);
	expect(result.activeLocalId).toBeNull();
});

it("leaves an unreadable catalog untouched instead of bootstrapping over it", async () => {
	state.read.mockRejectedValue(new Error("catalogInvalid"));
	await expect(initializeLocalVaultCatalog()).rejects.toThrow("catalogInvalid");
	expect(state.starter).not.toHaveBeenCalled();
	expect(state.write).not.toHaveBeenCalled();
});

it("does not publish an empty catalog if starter preparation fails", async () => {
	state.starter.mockRejectedValue(new Error("starterVaultRecoveryRequired"));
	await expect(initializeLocalVaultCatalog()).rejects.toThrow(
		"starterVaultRecoveryRequired",
	);
	expect(state.write).not.toHaveBeenCalled();
	expect(state.catalog.localVaults).toBeUndefined();
});

it("retries registration after publication without discarding the prepared vault", async () => {
	state.write.mockRejectedValueOnce(new Error("diskFull"));
	await expect(initializeLocalVaultCatalog()).rejects.toThrow("diskFull");
	expect(state.catalog.localVaults).toBeUndefined();
	expect((await initializeLocalVaultCatalog()).localVaults).toEqual([starter]);
});

it("does not overwrite a local catalog registered while preparation was running", async () => {
	state.starter.mockImplementation(async () => {
		state.catalog = {
			vaults: [],
			activeId: null,
			localVaults: [],
			activeLocalId: null,
		};
		return starter;
	});
	expect((await initializeLocalVaultCatalog()).localVaults).toEqual([]);
});
