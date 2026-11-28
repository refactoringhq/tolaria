import type { ComponentProps } from 'react'
import type { useAppSidebarSync } from '../hooks/useAppSidebarSync'
import type { useAppWorkspaceRuntime } from '../hooks/useAppWorkspaceRuntime'
import type { AutoSyncState } from '../hooks/useAutoSync'
import type { SidebarSelection } from '../types'
import { SidebarUtilities } from './sidebar/SidebarChrome'

type SidebarUtilitiesProps = ComponentProps<typeof SidebarUtilities>
type SidebarSyncMenu = SidebarUtilitiesProps['sync']
type SyncRepositoryActions = Pick<
  ReturnType<typeof useAppWorkspaceRuntime>['gitSurfaces'],
  'setSyncRepositoryPath' | 'setChangesRepositoryPath' | 'setHistoryRepositoryPath'
>

interface WorkspaceSidebarUtilitiesProps extends Omit<SidebarUtilitiesProps, 'sync'> {
  sidebarSync: ReturnType<typeof useAppSidebarSync>
  autoSync: Pick<AutoSyncState, 'lastSyncTime' | 'conflictFiles'>
  syncMenu: Pick<SidebarSyncMenu, 'locale' | 'count' | 'canViewGit' | 'offline' | 'repositories'>
  repositoryActions: SyncRepositoryActions
  onSelect: (selection: SidebarSelection) => void
}

export function WorkspaceSidebarUtilities({
  sidebarSync,
  autoSync,
  syncMenu,
  repositoryActions,
  onSelect,
  ...actions
}: WorkspaceSidebarUtilitiesProps) {
  const { syncRepositoryPath, selectedSyncRemote, selectedRepositoryHasConflict } = sidebarSync
  return (
    <SidebarUtilities
      {...actions}
      sync={{
        ...syncMenu,
        status: sidebarSync.sidebarSyncStatus,
        lastSyncTime: selectedSyncRemote?.hasRemote ? autoSync.lastSyncTime : null,
        canSync: sidebarSync.canSyncFromSidebar,
        conflictCount: selectedRepositoryHasConflict ? autoSync.conflictFiles.length : 0,
        selectedRepositoryPath: syncRepositoryPath,
        onRepositoryChange: repositoryActions.setSyncRepositoryPath,
        onViewChanges: () => {
          repositoryActions.setChangesRepositoryPath(syncRepositoryPath)
          onSelect({ kind: 'filter', filter: 'changes' })
        },
        onSyncNow: sidebarSync.handleSyncNow,
        onViewHistory: () => {
          repositoryActions.setHistoryRepositoryPath(syncRepositoryPath)
          onSelect({ kind: 'filter', filter: 'pulse' })
        },
      }}
    />
  )
}
