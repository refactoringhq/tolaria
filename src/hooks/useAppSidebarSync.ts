import { useCallback } from 'react'
import { trackEvent } from '../lib/telemetry'
import type { useAppWorkspaceRuntime } from './useAppWorkspaceRuntime'
import type { useAutoSync } from './useAutoSync'

interface AppSidebarSyncOptions {
  autoSync: Pick<ReturnType<typeof useAutoSync>, 'conflictVaultPath' | 'syncStatus' | 'pullAndPush'>
  gitSurfaces: Pick<ReturnType<typeof useAppWorkspaceRuntime>['gitSurfaces'], 'syncRepositoryPath' | 'remoteStatusForRepository'>
  graphDefaultWorkspacePath: string
  gitFeaturesEnabled: boolean
  isGitVault: boolean
  offline: boolean
  openConflictResolver: (repositoryPath?: string) => void
}

function canSyncRepository({ gitFeaturesEnabled, isGitVault, offline, autoSync }: AppSidebarSyncOptions, {
  hasConflict, hasRemote,
}: { hasConflict: boolean; hasRemote: boolean }) {
  if (!gitFeaturesEnabled || !isGitVault) return false
  if (hasConflict) return true
  return autoSync.syncStatus !== 'conflict' && !offline && hasRemote
}

export function useAppSidebarSync(options: AppSidebarSyncOptions) {
  const { autoSync, gitSurfaces, graphDefaultWorkspacePath, openConflictResolver } = options
  const syncRepositoryPath = gitSurfaces.syncRepositoryPath
  const selectedSyncRemote = gitSurfaces.remoteStatusForRepository(syncRepositoryPath)
  const activeConflictPath = autoSync.conflictVaultPath ?? graphDefaultWorkspacePath
  const selectedRepositoryHasConflict = autoSync.syncStatus === 'conflict' && activeConflictPath === syncRepositoryPath
  const sidebarSyncStatus = autoSync.syncStatus === 'conflict' && !selectedRepositoryHasConflict
    ? 'idle'
    : autoSync.syncStatus
  const canSyncFromSidebar = canSyncRepository(options, {
    hasConflict: selectedRepositoryHasConflict,
    hasRemote: selectedSyncRemote?.hasRemote === true,
  })

  const { pullAndPush } = autoSync
  const handleSyncNow = useCallback(() => {
    if (!canSyncFromSidebar || sidebarSyncStatus === 'syncing') return
    if (selectedRepositoryHasConflict) {
      openConflictResolver()
      return
    }
    trackEvent('sync_triggered')
    void pullAndPush(syncRepositoryPath)
  }, [canSyncFromSidebar, openConflictResolver, pullAndPush, selectedRepositoryHasConflict, sidebarSyncStatus, syncRepositoryPath])

  const handleManageConflicts = useCallback(() => {
    openConflictResolver(syncRepositoryPath)
  }, [openConflictResolver, syncRepositoryPath])

  return { handleManageConflicts, syncRepositoryPath, selectedSyncRemote, selectedRepositoryHasConflict, sidebarSyncStatus, canSyncFromSidebar, handleSyncNow }
}
