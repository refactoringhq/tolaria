import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../appCommandCatalog'
import type { CommandAction } from './types'
import type { SidebarSelection } from '../../types'

interface NavigationCommandsConfig {
  onQuickOpen: () => void
  onSelect: (sel: SidebarSelection) => void
  selection?: SidebarSelection
  onRenameFolder?: () => void
  onDeleteFolder?: () => void
  showInbox?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

function buildFolderCommands(
  folderSelected: boolean,
  onRenameFolder?: () => void,
  onDeleteFolder?: () => void,
): CommandAction[] {
  return [
    {
      id: 'rename-folder',
      label: 'Rename Folder',
      group: 'Navigation',
      keywords: ['folder', 'directory', 'sidebar', 'rename'],
      enabled: folderSelected && !!onRenameFolder,
      execute: () => onRenameFolder?.(),
    },
    {
      id: 'delete-folder',
      label: 'Delete Folder',
      group: 'Navigation',
      keywords: ['folder', 'directory', 'sidebar', 'delete', 'remove'],
      enabled: folderSelected && !!onDeleteFolder,
      execute: () => onDeleteFolder?.(),
    },
  ]
}

function buildBaseCommands(config: NavigationCommandsConfig): CommandAction[] {
  const {
    onQuickOpen,
    onSelect,
    onGoBack,
    onGoForward,
    canGoBack,
    canGoForward,
  } = config

  return [
    { id: 'search-notes', label: 'Search Notes', group: 'Navigation', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.fileQuickOpen), keywords: ['find', 'open', 'quick'], enabled: true, execute: onQuickOpen },
    { id: 'go-all', label: 'Go to All Notes', group: 'Navigation', keywords: ['filter'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'all' }) },
    { id: 'go-archived', label: 'Go to Archived', group: 'Navigation', keywords: [], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'archived' }) },
    { id: 'go-changes', label: 'Go to Changes', group: 'Navigation', keywords: ['git', 'modified', 'pending'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
    { id: 'go-pulse', label: 'Go to History', group: 'Navigation', keywords: ['activity', 'history', 'commits', 'git', 'feed'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'pulse' }) },
    { id: 'go-back', label: 'Go Back', group: 'Navigation', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewGoBack), keywords: ['previous', 'history', 'back'], enabled: !!canGoBack, execute: () => onGoBack?.() },
    { id: 'go-forward', label: 'Go Forward', group: 'Navigation', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewGoForward), keywords: ['next', 'history', 'forward'], enabled: !!canGoForward, execute: () => onGoForward?.() },
  ]
}

function insertInboxCommand(commands: CommandAction[], showInbox: boolean, onSelect: (sel: SidebarSelection) => void) {
  if (!showInbox) return commands

  commands.splice(5, 0, {
    id: 'go-inbox',
    label: 'Go to Inbox',
    group: 'Navigation',
    keywords: ['inbox', 'unlinked', 'orphan', 'unorganized', 'triage'],
    enabled: true,
    execute: () => onSelect({ kind: 'filter', filter: 'inbox' }),
  })
  return commands
}

export function buildNavigationCommands(config: NavigationCommandsConfig): CommandAction[] {
  const {
    onSelect,
    selection,
    onRenameFolder,
    onDeleteFolder,
    showInbox = true,
  } = config
  const folderSelected = selection?.kind === 'folder'
  const commands = [
    ...buildBaseCommands(config),
    ...buildFolderCommands(folderSelected, onRenameFolder, onDeleteFolder),
  ]
  return insertInboxCommand(commands, showInbox, onSelect)
}
