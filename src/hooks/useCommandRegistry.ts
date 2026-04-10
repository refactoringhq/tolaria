import { useMemo } from 'react'
import type { SidebarSelection, VaultEntry } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import type { ViewMode } from './useViewMode'
import { buildNavigationCommands } from './commands/navigationCommands'
import { buildNoteCommands } from './commands/noteCommands'
import { buildGitCommands } from './commands/gitCommands'
import { buildViewCommands } from './commands/viewCommands'
import { buildSettingsCommands } from './commands/settingsCommands'
import { buildTypeCommands, extractVaultTypes } from './commands/typeCommands'
import { buildFilterCommands } from './commands/filterCommands'

// Re-export types and helpers for backward compatibility
export type { CommandAction, CommandGroup } from './commands/types'
export { groupSortKey } from './commands/types'
export { pluralizeType, extractVaultTypes, buildTypeCommands } from './commands/typeCommands'
export { buildViewCommands } from './commands/viewCommands'

interface CommandRegistryConfig {
  activeTabPath: string | null
  entries: VaultEntry[]
  modifiedCount: number
  activeNoteHasIcon?: boolean
  mcpStatus?: string
  onInstallMcp?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
  onSetNoteIcon?: () => void
  onRemoveNoteIcon?: () => void
  onOpenInNewWindow?: () => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onCustomizeInboxColumns?: () => void
  canCustomizeInboxColumns?: boolean
  onRestoreDeletedNote?: () => void
  canRestoreDeletedNote?: boolean
  onQuickOpen: () => void
  onCreateNote: () => void
  onCreateNoteOfType: (type: string) => void
  onSave: () => void
  onOpenSettings: () => void
  onOpenFeedback?: () => void
  onOpenVault?: () => void
  onCreateType?: () => void
  onDeleteNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  onToggleAIChat?: () => void
  activeNoteModified: boolean
  onCheckForUpdates?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  zoomLevel: number
  onSelect: (sel: SidebarSelection) => void
  onOpenDailyNote: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  isGettingStartedHidden?: boolean
  vaultCount?: number
  selection?: SidebarSelection
  noteListFilter?: NoteListFilter
  onSetNoteListFilter?: (filter: NoteListFilter) => void
}

export function useCommandRegistry(config: CommandRegistryConfig): import('./commands/types').CommandAction[] {
  const {
    activeTabPath, entries, modifiedCount,
    onQuickOpen, onCreateNote, onCreateNoteOfType, onSave, onOpenSettings, onOpenFeedback,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onPull, onResolveConflicts, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat, onOpenVault,
    activeNoteModified,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onOpenDailyNote,
    onGoBack, onGoForward, canGoBack, canGoForward,
    onCheckForUpdates, onCreateType,
    onRemoveActiveVault, onRestoreGettingStarted, isGettingStartedHidden, vaultCount,
    mcpStatus, onInstallMcp,
    onReloadVault, onRepairVault,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon,
    onOpenInNewWindow, onToggleFavorite, onToggleOrganized,
    onCustomizeInboxColumns, canCustomizeInboxColumns,
    onRestoreDeletedNote, canRestoreDeletedNote,
    selection, noteListFilter, onSetNoteListFilter,
  } = config

  const hasActiveNote = activeTabPath !== null

  const activeEntry = useMemo(
    () => (hasActiveNote ? entries.find(e => e.path === activeTabPath) : undefined),
    [entries, activeTabPath, hasActiveNote],
  )
  const isArchived = activeEntry?.archived ?? false
  const isFavorite = activeEntry?.favorite ?? false
  const isSectionGroup = selection?.kind === 'sectionGroup'

  const vaultTypes = useMemo(() => extractVaultTypes(entries), [entries])

  return useMemo(() => [
    ...buildNavigationCommands({ onQuickOpen, onSelect, onOpenDailyNote, onGoBack, onGoForward, canGoBack, canGoForward }),
    ...buildNoteCommands({
      hasActiveNote, activeTabPath, isArchived,
      onCreateNote, onCreateType, onOpenDailyNote, onSave,
      onDeleteNote, onArchiveNote, onUnarchiveNote,
      onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon, onOpenInNewWindow, onToggleFavorite, isFavorite,
      onToggleOrganized, isOrganized: activeEntry?.organized ?? false,
      onRestoreDeletedNote, canRestoreDeletedNote,
    }),
    ...buildGitCommands({ modifiedCount, onCommitPush, onPull, onResolveConflicts, onSelect }),
    ...buildViewCommands({
      hasActiveNote, activeNoteModified, onSetViewMode, onToggleInspector,
      onToggleDiff, onToggleRawEditor, onToggleAIChat, zoomLevel, onZoomIn, onZoomOut, onZoomReset,
      onCustomizeInboxColumns, canCustomizeInboxColumns,
    }),
    ...buildSettingsCommands({
      mcpStatus, vaultCount, isGettingStartedHidden,
      onOpenSettings, onOpenFeedback, onOpenVault, onRemoveActiveVault, onRestoreGettingStarted,
      onCheckForUpdates, onInstallMcp, onReloadVault, onRepairVault,
    }),
    ...buildTypeCommands(vaultTypes, onCreateNoteOfType, onSelect),
    ...buildFilterCommands({ isSectionGroup, noteListFilter, onSetNoteListFilter }),
  ], [
    hasActiveNote, activeTabPath, isArchived, modifiedCount, activeNoteModified,
    onQuickOpen, onCreateNote, onCreateNoteOfType, onCreateType, onSave, onOpenSettings, onOpenFeedback,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onPull, onResolveConflicts, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat, onOpenVault,
    onCheckForUpdates,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onOpenDailyNote,
    onGoBack, onGoForward, canGoBack, canGoForward,
    vaultTypes,
    onRemoveActiveVault, onRestoreGettingStarted, isGettingStartedHidden, vaultCount,
    mcpStatus, onInstallMcp,
    onReloadVault, onRepairVault,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon,
    isSectionGroup, noteListFilter, onSetNoteListFilter,
    onOpenInNewWindow, onToggleFavorite, isFavorite,
    onToggleOrganized, onCustomizeInboxColumns, canCustomizeInboxColumns,
    onRestoreDeletedNote, canRestoreDeletedNote, activeEntry,
  ])
}
