import type { CommandAction } from './types'
import type { SidebarSelection } from '../../types'

interface GitCommandsConfig {
  isGitVault?: boolean
  modifiedCount: number
  canAddRemote: boolean
  onAddRemote?: () => void
  onCommitPush: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onSelect: (sel: SidebarSelection) => void
  onEnableGit?: () => void
}

export function buildGitCommands(config: GitCommandsConfig): CommandAction[] {
  const { isGitVault = true, modifiedCount, canAddRemote, onAddRemote, onCommitPush, onPull, onResolveConflicts, onSelect, onEnableGit } = config

  if (!isGitVault) {
    return [
      { id: 'enable-git', label: 'Enable Git for This Vault', group: 'Git', keywords: ['git', 'enable', 'init', 'version control'], enabled: true, execute: () => onEnableGit?.() },
    ]
  }

  return [
    { id: 'commit-push', label: 'Commit & Push', group: 'Git', keywords: ['git', 'save', 'sync'], enabled: modifiedCount > 0, execute: onCommitPush },
    { id: 'add-remote', label: 'Add Remote to Current Vault', group: 'Git', keywords: ['git', 'remote', 'connect', 'origin', 'no remote'], enabled: canAddRemote && !!onAddRemote, execute: () => onAddRemote?.() },
    { id: 'git-pull', label: 'Pull from Remote', group: 'Git', keywords: ['git', 'pull', 'fetch', 'download', 'sync', 'remote'], enabled: true, execute: () => onPull?.() },
    { id: 'resolve-conflicts', label: 'Resolve Conflicts', group: 'Git', keywords: ['conflict', 'merge', 'git', 'sync'], enabled: true, execute: () => onResolveConflicts?.() },
    { id: 'view-changes', label: 'View Pending Changes', group: 'Git', keywords: ['modified', 'diff'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
  ]
}
