import { useAppKeyboard } from './useAppKeyboard'
import { useCommandRegistry } from './useCommandRegistry'
import type { CommandAction } from './useCommandRegistry'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useMenuEvents } from './useMenuEvents'
import type { SidebarSelection, ThemeFile, VaultEntry } from '../types'
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
  onSearch: () => void
  onCreateNote: () => void
  onOpenDailyNote: () => void
  onCreateNoteOfType: (type: string) => void
  onSave: () => void
  onOpenSettings: () => void
  onTrashNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  zoomLevel: number
  onSelect: (sel: SidebarSelection) => void
  onCloseTab: (path: string) => void
  onSwitchTab: (path: string) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onSelectNote: (entry: VaultEntry) => void
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  themes?: ThemeFile[]
  activeThemeId?: string | null
  onSwitchTheme?: (themeId: string) => void
  onCreateTheme?: () => void
  onOpenVault?: () => void
  onToggleAIChat?: () => void
}

/** Sets up keyboard shortcuts, command registry, menu events, and keyboard navigation. */
export function useAppCommands(config: AppCommandsConfig): CommandAction[] {
  useAppKeyboard({
    onQuickOpen: config.onQuickOpen,
    onCommandPalette: config.onCommandPalette,
    onSearch: config.onSearch,
    onCreateNote: config.onCreateNote,
    onOpenDailyNote: config.onOpenDailyNote,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onTrashNote: config.onTrashNote,
    onArchiveNote: config.onArchiveNote,
    onSetViewMode: config.onSetViewMode,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    onToggleAIChat: config.onToggleAIChat,
    activeTabPathRef: config.activeTabPathRef,
    handleCloseTabRef: config.handleCloseTabRef,
  })

  useMenuEvents({
    onSetViewMode: config.onSetViewMode,
    onCreateNote: config.onCreateNote,
    onOpenDailyNote: config.onOpenDailyNote,
    onQuickOpen: config.onQuickOpen,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onToggleInspector: config.onToggleInspector,
    onCommandPalette: config.onCommandPalette,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onArchiveNote: config.onArchiveNote,
    onTrashNote: config.onTrashNote,
    onSearch: config.onSearch,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    activeTabPathRef: config.activeTabPathRef,
    handleCloseTabRef: config.handleCloseTabRef,
    activeTabPath: config.activeTabPath,
  })

  const commands = useCommandRegistry({
    activeTabPath: config.activeTabPath,
    entries: config.entries,
    modifiedCount: config.modifiedCount,
    onQuickOpen: config.onQuickOpen,
    onCreateNote: config.onCreateNote,
    onCreateNoteOfType: config.onCreateNoteOfType,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onTrashNote: config.onTrashNote,
    onArchiveNote: config.onArchiveNote,
    onUnarchiveNote: config.onUnarchiveNote,
    onCommitPush: config.onCommitPush,
    onSetViewMode: config.onSetViewMode,
    onToggleInspector: config.onToggleInspector,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    zoomLevel: config.zoomLevel,
    onSelect: config.onSelect,
    onOpenDailyNote: config.onOpenDailyNote,
    onCloseTab: config.onCloseTab,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    canGoBack: config.canGoBack,
    canGoForward: config.canGoForward,
    themes: config.themes,
    activeThemeId: config.activeThemeId,
    onSwitchTheme: config.onSwitchTheme,
    onCreateTheme: config.onCreateTheme,
    onOpenVault: config.onOpenVault,
    onToggleAIChat: config.onToggleAIChat,
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
