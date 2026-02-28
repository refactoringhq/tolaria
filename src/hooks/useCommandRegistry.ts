import { useMemo } from 'react'
import type { SidebarSelection, VaultEntry } from '../types'
import type { ViewMode } from './useViewMode'

export type CommandGroup = 'Navigation' | 'Note' | 'Git' | 'View' | 'Settings'

export interface CommandAction {
  id: string
  label: string
  group: CommandGroup
  shortcut?: string
  keywords?: string[]
  enabled: boolean
  execute: () => void
}

interface CommandRegistryConfig {
  activeTabPath: string | null
  entries: VaultEntry[]
  modifiedCount: number

  onQuickOpen: () => void
  onCreateNote: () => void
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
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

const GROUP_ORDER: CommandGroup[] = ['Navigation', 'Note', 'Git', 'View', 'Settings']

export function groupSortKey(group: CommandGroup): number {
  return GROUP_ORDER.indexOf(group)
}

export function useCommandRegistry(config: CommandRegistryConfig): CommandAction[] {
  const {
    activeTabPath, entries, modifiedCount,
    onQuickOpen, onCreateNote, onSave, onOpenSettings,
    onTrashNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onSetViewMode, onToggleInspector,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onCloseTab,
    onGoBack, onGoForward, canGoBack, canGoForward,
  } = config

  const hasActiveNote = activeTabPath !== null

  const activeEntry = useMemo(
    () => (hasActiveNote ? entries.find(e => e.path === activeTabPath) : undefined),
    [entries, activeTabPath, hasActiveNote],
  )
  const isArchived = activeEntry?.archived ?? false

  return useMemo(() => {
    const cmds: CommandAction[] = [
      // Navigation
      { id: 'search-notes', label: 'Search Notes', group: 'Navigation', shortcut: '⌘P', keywords: ['find', 'open', 'quick'], enabled: true, execute: onQuickOpen },
      { id: 'go-all', label: 'Go to All Notes', group: 'Navigation', keywords: ['filter'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'all' }) },
      { id: 'go-favorites', label: 'Go to Favorites', group: 'Navigation', keywords: ['starred'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'favorites' }) },
      { id: 'go-archived', label: 'Go to Archived', group: 'Navigation', keywords: [], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'archived' }) },
      { id: 'go-trash', label: 'Go to Trash', group: 'Navigation', keywords: ['deleted'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'trash' }) },
      { id: 'go-changes', label: 'Go to Changes', group: 'Navigation', keywords: ['git', 'modified', 'pending'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
      { id: 'go-back', label: 'Go Back', group: 'Navigation', shortcut: '⌘[', keywords: ['previous', 'history', 'back'], enabled: !!canGoBack, execute: () => onGoBack?.() },
      { id: 'go-forward', label: 'Go Forward', group: 'Navigation', shortcut: '⌘]', keywords: ['next', 'history', 'forward'], enabled: !!canGoForward, execute: () => onGoForward?.() },

      // Note actions (contextual)
      { id: 'create-note', label: 'Create New Note', group: 'Note', shortcut: '⌘N', keywords: ['new', 'add'], enabled: true, execute: onCreateNote },
      { id: 'save-note', label: 'Save Note', group: 'Note', shortcut: '⌘S', keywords: ['write'], enabled: hasActiveNote, execute: onSave },
      { id: 'close-tab', label: 'Close Tab', group: 'Note', shortcut: '⌘W', keywords: [], enabled: hasActiveNote, execute: () => { if (activeTabPath) onCloseTab(activeTabPath) } },
      { id: 'trash-note', label: 'Trash Note', group: 'Note', shortcut: '⌘⌫', keywords: ['delete', 'remove'], enabled: hasActiveNote, execute: () => { if (activeTabPath) onTrashNote(activeTabPath) } },
      {
        id: 'archive-note', label: isArchived ? 'Unarchive Note' : 'Archive Note', group: 'Note', shortcut: '⌘E',
        keywords: ['archive'], enabled: hasActiveNote,
        execute: () => { if (activeTabPath) (isArchived ? onUnarchiveNote : onArchiveNote)(activeTabPath) },
      },

      // Git
      { id: 'commit-push', label: 'Commit & Push', group: 'Git', keywords: ['git', 'save', 'sync'], enabled: modifiedCount > 0, execute: onCommitPush },
      { id: 'view-changes', label: 'View Pending Changes', group: 'Git', keywords: ['modified', 'diff'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },

      // View
      { id: 'view-editor', label: 'Editor Only', group: 'View', shortcut: '⌘1', keywords: ['layout', 'focus'], enabled: true, execute: () => onSetViewMode('editor-only') },
      { id: 'view-editor-list', label: 'Editor + Note List', group: 'View', shortcut: '⌘2', keywords: ['layout'], enabled: true, execute: () => onSetViewMode('editor-list') },
      { id: 'view-all', label: 'Full Layout', group: 'View', shortcut: '⌘3', keywords: ['layout', 'sidebar'], enabled: true, execute: () => onSetViewMode('all') },
      { id: 'toggle-inspector', label: 'Toggle Inspector', group: 'View', keywords: ['properties', 'panel', 'right'], enabled: true, execute: onToggleInspector },
      { id: 'zoom-in', label: `Zoom In (${zoomLevel}%)`, group: 'View', shortcut: '⌘=', keywords: ['zoom', 'bigger', 'larger', 'scale'], enabled: zoomLevel < 150, execute: onZoomIn },
      { id: 'zoom-out', label: `Zoom Out (${zoomLevel}%)`, group: 'View', shortcut: '⌘-', keywords: ['zoom', 'smaller', 'scale'], enabled: zoomLevel > 80, execute: onZoomOut },
      { id: 'zoom-reset', label: 'Reset Zoom', group: 'View', shortcut: '⌘0', keywords: ['zoom', 'actual', 'default', '100'], enabled: zoomLevel !== 100, execute: onZoomReset },

      // Settings
      { id: 'open-settings', label: 'Open Settings', group: 'Settings', shortcut: '⌘,', keywords: ['preferences', 'config'], enabled: true, execute: onOpenSettings },
    ]

    return cmds
  }, [
    hasActiveNote, activeTabPath, isArchived, modifiedCount,
    onQuickOpen, onCreateNote, onSave, onOpenSettings,
    onTrashNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onSetViewMode, onToggleInspector,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onCloseTab,
    onGoBack, onGoForward, canGoBack, canGoForward,
  ])
}
