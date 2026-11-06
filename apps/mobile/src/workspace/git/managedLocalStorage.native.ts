import { randomUUID } from "expo-crypto";
import { Directory, Paths } from "expo-file-system";
import { mobileWorkspaceAlias } from "../mobileWorkspaceAlias";
import {
	type NativeWorkspaceSelection,
	restoreNativeWorkspaceDirectory,
} from "../nativeWorkspacePicker";
import {
	readManagedGitCatalog,
	updateManagedGitCatalog,
} from "./managedGitStorage.native";
import {
	isManagedLocalDirectory,
	type ManagedLocalVault,
} from "./managedLocalVaults";

export async function initializeLocalVaultCatalog(
	onStarterCreated?: () => void,
) {
	const catalog = await readManagedGitCatalog();
	if (catalog.localVaults !== undefined) return catalog;
	const legacy = await restoreNativeWorkspaceDirectory();
	const localVaults = legacy
		? [
				{
					id: "local-legacy",
					label: legacy.vaultLabel,
					directory: "Tolaria Vault",
				},
			]
		: await initialStarterVaults();
	return registerLocalVaultCatalog(localVaults, !legacy, onStarterCreated);
}

async function registerLocalVaultCatalog(
	localVaults: ManagedLocalVault[],
	mayReportStarter: boolean,
	onStarterCreated?: () => void,
) {
	let starterCreated = false;
	const registered = await updateManagedGitCatalog((current) => {
		if (current.localVaults !== undefined) return current;
		starterCreated =
			mayReportStarter &&
			localVaults.some((vault) => vault.id === "getting-started");
		return {
			...current,
			localVaults,
			activeLocalId: current.activeId ? null : (localVaults[0]?.id ?? null),
		};
	});
	if (starterCreated) onStarterCreated?.();
	return registered;
}

async function initialStarterVaults(): Promise<ManagedLocalVault[]> {
	const { prepareBundledStarterVault } = await import(
		"./bundledStarterVault.native"
	);
	const starter = await prepareBundledStarterVault();
	return starter ? [starter] : [];
}

export async function rememberLocalVault(
	selection: NativeWorkspaceSelection,
): Promise<ManagedLocalVault> {
	const vault = await importedVaultRecord(selection);
	await updateManagedGitCatalog((catalog) => ({
		...catalog,
		localVaults: [
			...(catalog.localVaults ?? []).filter(
				(entry) => entry.directory !== vault.directory,
			),
			vault,
		],
		activeId: null,
		activeLocalId: vault.id,
	}));
	return vault;
}

export async function activateManagedLocalVault(vault: ManagedLocalVault) {
	const selection = await managedLocalSelection(vault);
	await updateManagedGitCatalog((catalog) => {
		if (!catalog.localVaults?.some((entry) => entry.id === vault.id))
			throw new Error("vaultNotFound");
		return { ...catalog, activeId: null, activeLocalId: vault.id };
	});
	return selection;
}

export async function managedLocalSelection(
	vault: ManagedLocalVault,
): Promise<NativeWorkspaceSelection> {
	if (!isManagedLocalDirectory(vault.directory))
		throw new Error("vaultNotFound");
	const directory = new Directory(Paths.document, vault.directory);
	if (!directory.exists) throw new Error("vaultNotFound");
	return {
		catalogVaultId: vault.id,
		vaultAlias: mobileWorkspaceAlias({
			alias: vault.alias,
			label: vault.label,
		}),
		vaultLabel: vault.label,
		vaultRootUri: directory.uri,
	};
}

async function importedVaultRecord(
	selection: NativeWorkspaceSelection,
): Promise<ManagedLocalVault> {
	const root = Paths.document.uri;
	const relative = selection.vaultRootUri.startsWith(root)
		? decodeURIComponent(selection.vaultRootUri.slice(root.length)).replace(
				/\/$/u,
				"",
			)
		: "";
	const id = `local-${randomUUID()}`;
	if (isManagedLocalDirectory(relative)) {
		const catalog = await readManagedGitCatalog();
		return (
			catalog.localVaults?.find((vault) => vault.directory === relative) ?? {
				id,
				label: selection.vaultLabel,
				directory: relative,
			}
		);
	}
	// Session-scoped providers are copied while picker access is still available.
	const directory = `Local Vaults/${id}`;
	const destination = new Directory(Paths.document, directory);
	destination.parentDirectory.create({ intermediates: true, idempotent: true });
	new Directory(selection.vaultRootUri).copy(destination);
	return { id, label: selection.vaultLabel, directory };
}
