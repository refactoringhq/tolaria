import { useMemo, type ReactNode } from 'react'
import { MobileVaultManager } from '../components/vaults/MobileVaultManager'
import { MobileWorkspaceLoadFailure } from '../components/vaults/MobileWorkspaceLoadFailure'
import { NativeWorkspaceContext } from './NativeWorkspaceContext'
import { MobileVaultControlsContext } from './MobileVaultContext'
import { WorkspaceSyncEditorsContext } from './workspaceSyncEditors'
import { useMobileVaults } from './git/useMobileVaults'
import { WorkspaceLoadBoundary } from './WorkspaceLoadBoundary'

export function MobileVaultProvider({ children }: { children: ReactNode }) {
  const manager = useMobileVaults()
  const { active, open, restorePending, revision, editors } = manager
  // Sync progress must not make the workspace re-index a large vault.
  const workspace = useMemo(() => ({ selection: active.selection, open, restorePending }), [active.selection, open, restorePending])
  const controls = {
    rootUri: active.selection?.vaultRootUri,
    git: Boolean(active.git),
    busy: manager.busy,
    status: manager.status,
    open,
    sync: manager.sync,
  }
  return <WorkspaceSyncEditorsContext.Provider value={editors}>
    <NativeWorkspaceContext.Provider value={workspace}>
      <MobileVaultControlsContext.Provider value={controls}>
        <WorkspaceLoadBoundary key={revision} fallback={<MobileWorkspaceLoadFailure onManage={open} />}>
          {children}
        </WorkspaceLoadBoundary>
        <MobileVaultManager manager={manager} />
      </MobileVaultControlsContext.Provider>
    </NativeWorkspaceContext.Provider>
  </WorkspaceSyncEditorsContext.Provider>
}
