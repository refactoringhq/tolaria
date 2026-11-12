import { type ReactNode, useEffect, useMemo } from "react";
import { MobileVaultNotice } from "../components/vaults/MobileVaultNotice";
import { MobileWorkspaceLoadFailure } from "../components/vaults/MobileWorkspaceLoadFailure";
import { MobileWorkspaceStartup } from "../components/workspace/MobileWorkspaceStartup";
import { MobileSettingsSheet } from "../settings/MobileSettingsSheet";
import { useMobileSettings } from "../settings/useMobileSettings";
import { useMobileVaults } from "./git/useMobileVaults";
import {
	MobileVaultControlsContext,
	MobileVaultPickerContext,
} from "./MobileVaultContext";
import {
	initialWorkspacePending,
	vaultControls,
	workspaceRecovery,
} from "./mobileVaultPresentation";
import { mobileWorkspaceDeepLinkSlug } from "./mobileWorkspaceAlias";
import { NativeWorkspaceContext } from "./NativeWorkspaceContext";
import { WorkspaceLoadBoundary } from "./WorkspaceLoadBoundary";
import {
	WorkspaceSnapshotRevisionContext,
	WorkspaceSyncEditorsContext,
} from "./workspaceSyncEditors";

export function MobileVaultProvider({ children }: { children: ReactNode }) {
	const manager = useMobileVaults();
	const preferences = useMobileSettings();
	const { active, open, revision, editors } = manager;
	const recovery = workspaceRecovery(manager);
	useCachedFailureNotice(manager);
	const blockingRestore =
		initialWorkspacePending(manager) && !manager.catalog.preview;
	// Sync progress must not make the workspace re-index a large vault.
	const workspace = useMemo(
		() => ({
			selection: active.selection,
			open,
			restorePending: blockingRestore,
		}),
		[active.selection, open, blockingRestore],
	);
	const pending = manager.syncHistory.record.pendingPaths;
	const pendingNotePaths = useMemo(
		() => new Set((pending ?? []).map((change) => change.path)),
		[pending],
	);
	const controls = vaultControls(manager, pendingNotePaths);
	const picker = vaultPicker(manager, preferences.open);
	return (
		<MobileVaultPickerContext.Provider value={picker}>
			<WorkspaceSyncEditorsContext.Provider value={editors}>
				<NativeWorkspaceContext.Provider value={workspace}>
					<MobileVaultControlsContext.Provider value={controls}>
						<WorkspaceLoadBoundary
							resetKey={revision}
							fallback={<MobileWorkspaceLoadFailure onManage={open} />}
						>
							<WorkspaceSnapshotRevisionContext.Provider value={revision}>
								{recovery?.reason ? (
									<MobileWorkspaceLoadFailure
										onManage={open}
										onRetry={recovery.retry}
										reason={recovery.reason}
									/>
								) : (
									<MobileWorkspaceStartup preview={manager.catalog.preview}>
										{children}
									</MobileWorkspaceStartup>
								)}
							</WorkspaceSnapshotRevisionContext.Provider>
						</WorkspaceLoadBoundary>
						<MobileVaultProviderOverlays manager={manager} open={open} />
					</MobileVaultControlsContext.Provider>
				</NativeWorkspaceContext.Provider>
			</WorkspaceSyncEditorsContext.Provider>
		</MobileVaultPickerContext.Provider>
	);
}

function MobileVaultProviderOverlays({
	manager,
	open,
}: {
	manager: ReturnType<typeof useMobileVaults>;
	open: () => void;
}) {
	return (
		<>
			<MobileSettingsSheet manager={manager} />
			{!manager.opened && manager.notices.current && (
				<MobileVaultNotice
					notice={manager.notices.current}
					dismiss={manager.notices.dismiss}
					onManage={open}
				/>
			)}
		</>
	);
}

function useCachedFailureNotice(manager: ReturnType<typeof useMobileVaults>) {
	const show = manager.notices.show;
	const failed = Boolean(manager.catalog.error && manager.catalog.preview);
	useEffect(() => {
		if (failed) show("local");
	}, [failed, show]);
}

function vaultPicker(
	manager: ReturnType<typeof useMobileVaults>,
	manage: () => void,
) {
	const { active, restorePending } = manager;
	const vaults = [...manager.catalog.localVaults, ...manager.catalog.vaults];
	return {
		disabled: manager.busy || restorePending,
		manage,
		choices: [
			...manager.catalog.localVaults.map((vault) => ({
				id: mobileWorkspaceDeepLinkSlug(vault, vaults),
				label: vault.label,
				selected: active.selection?.catalogVaultId === vault.id,
				select: () => manager.selectLocal(vault, false),
			})),
			...manager.catalog.vaults.map((vault) => ({
				id: mobileWorkspaceDeepLinkSlug(vault, vaults),
				label: vault.label,
				selected: active.git?.id === vault.id,
				select: () => manager.select(vault, false),
			})),
		],
	};
}
