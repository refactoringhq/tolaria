import { buildCooperativeWorkspaceSnapshot } from "./cooperativeWorkspaceSnapshot";
import { expoWorkspaceFileSystem } from "./expoWorkspaceFileSystem";
import type { LocalVaultFile } from "./localVaultSnapshot";
import type { MobileVaultConfig } from "./mobileWorkspaceModel";
import type { NativeWorkspaceSelection } from "./nativeWorkspacePicker";
import { preloadNativeWorkspace } from "./preloadNativeWorkspace";
import { rememberPreparedWorkspaceSnapshot } from "./preparedWorkspaceSnapshot";
import { beginWorkspacePathIndex } from "./workspacePathGenerations";

type PreparationDependencies = {
	preload: (
		selection: NativeWorkspaceSelection | null,
	) => Promise<NativeWorkspaceSelection | null>;
	readVaultConfig: (root: string) => MobileVaultConfig | null;
	readVaultIndex?: (root: string) => {
		directories: string[];
		files: LocalVaultFile[];
	};
};

/** Prepare before publishing a vault selection, while the existing save barrier is active. */
export async function prepareNativeWorkspace(
	selection: NativeWorkspaceSelection | null,
	signal?: AbortSignal,
	dependencies: PreparationDependencies = {
		preload: preloadNativeWorkspace,
		readVaultConfig: (root) =>
			expoWorkspaceFileSystem.readVaultConfig?.(root) ?? null,
		readVaultIndex: (root) => expoWorkspaceFileSystem.readVaultIndex(root),
	},
) {
	if (!selection) return dependencies.preload(selection);
	const generation = beginWorkspacePathIndex(selection.vaultRootUri);
	try {
		let candidate = selection;
		while (true) {
			candidate = (await dependencies.preload(candidate)) ?? candidate;
			const index =
				candidate.index ??
				(dependencies.readVaultIndex ?? expoWorkspaceFileSystem.readVaultIndex)(
					candidate.vaultRootUri,
				);
			if (!candidate.index) candidate = { ...candidate, index };
			const { vaultAlias, vaultLabel, vaultRootUri } = candidate;
			const options = {
				files: index.files,
				folderPaths: index.directories,
				vaultAlias,
				vaultLabel,
				vaultPath: vaultRootUri,
				vaultConfig: dependencies.readVaultConfig(vaultRootUri),
			};
			const snapshot = await buildCooperativeWorkspaceSnapshot(options, signal);
			if (generation.takeChangedPaths().length > 0) {
				candidate = { ...candidate, index: undefined };
				continue;
			}
			rememberPreparedWorkspaceSnapshot(index, options, snapshot);
			return candidate;
		}
	} finally {
		generation.finish();
	}
}
