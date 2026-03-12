import { useCallback, useRef } from 'react'
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
  onRestoreNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onResolveConflicts?: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  activeNoteModified: boolean
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
  onOpenTheme?: (themeId: string) => void
  onOpenVault?: () => void
  onCreateType?: () => void
  onToggleAIChat?: () => void
  onCheckForUpdates?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onRestoreDefaultThemes?: () => void
  isGettingStartedHidden?: boolean
  vaultCount?: number
  mcpStatus?: string
  onInstallMcp?: () => void
  onEmptyTrash?: () => void
  trashedCount?: number
  onReopenClosedTab?: () => void
  onReindexVault?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
}

/** Sets up keyboard shortcuts, command registry, menu events, and keyboard navigation. */
export function useAppCommands(config: AppCommandsConfig): CommandAction[] {
  const entriesRef = useRef(config.entries)
  // eslint-disable-next-line react-hooks/refs
  entriesRef.current = config.entries

  const toggleArchive = useCallback((path: string) => {
    const entry = entriesRef.current.find(e => e.path === path)
    ;(entry?.archived ? config.onUnarchiveNote : config.onArchiveNote)(path)
  }, [config.onArchiveNote, config.onUnarchiveNote])

  const toggleTrash = useCallback((path: string) => {
    const entry = entriesRef.current.find(e => e.path === path)
    ;(entry?.trashed ? config.onRestoreNote : config.onTrashNote)(path)
  }, [config.onTrashNote, config.onRestoreNote])

  const { onSelect } = config

  const selectFilter = useCallback((filter: 'all' | 'archived' | 'trash' | 'changes' | 'pulse') => {
    onSelect({ kind: 'filter', filter })
  }, [onSelect])

  const viewChanges = useCallback(() => {
    onSelect({ kind: 'filter', filter: 'changes' })
  }, [onSelect])

  useAppKeyboard({
    onQuickOpen: config.onQuickOpen,
    onCommandPalette: config.onCommandPalette,
    onSearch: config.onSearch,
    onCreateNote: config.onCreateNote,
    onOpenDailyNote: config.onOpenDailyNote,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onTrashNote: toggleTrash,
    onArchiveNote: toggleArchive,
    onSetViewMode: config.onSetViewMode,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    onToggleAIChat: config.onToggleAIChat,
    onToggleRawEditor: config.onToggleRawEditor,
    onReopenClosedTab: config.onReopenClosedTab,
    activeTabPathRef: config.activeTabPathRef,
    handleCloseTabRef: config.handleCloseTabRef,
  })

  useMenuEvents({
    onSetViewMode: config.onSetViewMode,
    onCreateNote: config.onCreateNote,
    onCreateType: config.onCreateType,
    onOpenDailyNote: config.onOpenDailyNote,
    onQuickOpen: config.onQuickOpen,
    onSave: config.onSave,
    onOpenSettings: config.onOpenSettings,
    onToggleInspector: config.onToggleInspector,
    onCommandPalette: config.onCommandPalette,
    onZoomIn: config.onZoomIn,
    onZoomOut: config.onZoomOut,
    onZoomReset: config.onZoomReset,
    onArchiveNote: toggleArchive,
    onTrashNote: toggleTrash,
    onSearch: config.onSearch,
    onToggleRawEditor: config.onToggleRawEditor,
    onToggleDiff: config.onToggleDiff,
    onToggleAIChat: config.onToggleAIChat,
    onGoBack: config.onGoBack,
    onGoForward: config.onGoForward,
    onCheckForUpdates: config.onCheckForUpdates,
    onSelectFilter: selectFilter,
    onOpenVault: config.onOpenVault,
    onRemoveActiveVault: config.onRemoveActiveVault,
    onRestoreGettingStarted: config.onRestoreGettingStarted,
    onCreateTheme: config.onCreateTheme,
    onRestoreDefaultThemes: config.onRestoreDefaultThemes,
    onCommitPush: config.onCommitPush,
    onResolveConflicts: config.onResolveConflicts,
    onViewChanges: viewChanges,
    onInstallMcp: config.onInstallMcp,
    onReindexVault: config.onReindexVault,
    onReloadVault: config.onReloadVault,
    onRepairVault: config.onRepairVault,
    onEmptyTrash: config.onEmptyTrash,
    onReopenClosedTab: config.onReopenClosedTab,
    activeTabPathRef: config.activeTabPathRef,
    handleCloseTabRef: config.handleCloseTabRef,
    activeTabPath: config.activeTabPath,
    modifiedCount: config.modifiedCount,
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
    onRestoreNote: config.onRestoreNote,
    onArchiveNote: config.onArchiveNote,
    onUnarchiveNote: config.onUnarchiveNote,
    onCommitPush: config.onCommitPush,
    onResolveConflicts: config.onResolveConflicts,
    onSetViewMode: config.onSetViewMode,
    onToggleInspector: config.onToggleInspector,
    onToggleDiff: config.onToggleDiff,
    onToggleRawEditor: config.onToggleRawEditor,
    onToggleAIChat: config.onToggleAIChat,
    onOpenVault: config.onOpenVault,
    activeNoteModified: config.activeNoteModified,
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
    onOpenTheme: config.onOpenTheme,
    onCheckForUpdates: config.onCheckForUpdates,
    onCreateType: config.onCreateType,
    onRemoveActiveVault: config.onRemoveActiveVault,
    onRestoreGettingStarted: config.onRestoreGettingStarted,
    onRestoreDefaultThemes: config.onRestoreDefaultThemes,
    isGettingStartedHidden: config.isGettingStartedHidden,
    vaultCount: config.vaultCount,
    mcpStatus: config.mcpStatus,
    onInstallMcp: config.onInstallMcp,
    onEmptyTrash: config.onEmptyTrash,
    trashedCount: config.trashedCount,
    onReindexVault: config.onReindexVault,
    onReloadVault: config.onReloadVault,
    onRepairVault: config.onRepairVault,
  })

  useKeyboardNavigation({
    tabs: config.tabs,
    activeTabPath: config.activeTabPath,
    entries: config.entries,
    selection: config.selection,
    onSwitchTab: config.onSwitchTab,
    onReplaceActiveTab: config.onReplaceActiveTab,
    onSelectNote: config.onSelectNote,
  })

  return commands
}
