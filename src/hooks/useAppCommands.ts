import { useAppKeyboard } from './useAppKeyboard'
import { useCommandRegistry } from './useCommandRegistry'
import type { CommandAction } from './useCommandRegistry'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import type { SidebarSelection, VaultEntry } from '../types'
import type { ViewMode } from './useViewMode'

interface Tab { entry: VaultEntry; content: string }

interface AppCommandsConfig {
  activeTabPath: string | null
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
  tabs: Tab[]
  entries: VaultEntry[]
  allContent: Record<string, string>
  modifiedCount: number
  selection: SidebarSelection
  onQuickOpen: () => void
  onCommandPalette: () => void
  onCreateNote: () => void
  onSave: () => void
  onOpenSettings: () => void
  onTrashNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onSelect: (sel: SidebarSelection) => void
  onCloseTab: (path: string) => void
  onSwitchTab: (path: string) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
}

/** Sets up keyboard shortcuts, command registry, and keyboard navigation. */
export function useAppCommands(config: AppCommandsConfig): CommandAction[] {
  useAppKeyboard({
    onQuickOpen: config.onQuickOpen,
    onCommandPalette: config.onCommandPalette,
    onCreateNote: config.onCreateNote,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onTrashNote: config.onTrashNote,
    onArchiveNote: config.onArchiveNote,
    onSetViewMode: config.onSetViewMode,
    activeTabPathRef: config.activeTabPathRef,
    handleCloseTabRef: config.handleCloseTabRef,
  })

  const commands = useCommandRegistry({
    activeTabPath: config.activeTabPath,
    entries: config.entries,
    modifiedCount: config.modifiedCount,
    onQuickOpen: config.onQuickOpen,
    onCreateNote: config.onCreateNote,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onTrashNote: config.onTrashNote,
    onArchiveNote: config.onArchiveNote,
    onUnarchiveNote: config.onUnarchiveNote,
    onCommitPush: config.onCommitPush,
    onSetViewMode: config.onSetViewMode,
    onToggleInspector: config.onToggleInspector,
    onSelect: config.onSelect,
    onCloseTab: config.onCloseTab,
  })

  useKeyboardNavigation({
    tabs: config.tabs,
    activeTabPath: config.activeTabPath,
    entries: config.entries,
    selection: config.selection,
    allContent: config.allContent,
    onSwitchTab: config.onSwitchTab,
    onReplaceActiveTab: config.onReplaceActiveTab,
    onSelectNote: config.onSelectNote,
  })

  return commands
}
