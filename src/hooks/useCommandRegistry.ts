import { useMemo } from 'react'
import type { SidebarSelection, ThemeFile, VaultEntry } from '../types'
import type { ViewMode } from './useViewMode'

export type CommandGroup = 'Navigation' | 'Note' | 'Git' | 'View' | 'Appearance' | 'Settings'

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
  mcpStatus?: string
  onInstallMcp?: () => void
  onEmptyTrash?: () => void
  trashedCount?: number
  onReindexVault?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void

  onQuickOpen: () => void
  onCreateNote: () => void
  onCreateNoteOfType: (type: string) => void
  onSave: () => void
  onOpenSettings: () => void
  onOpenVault?: () => void
  onCreateType?: () => void
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
  onToggleAIChat?: () => void
  activeNoteModified: boolean
  onCheckForUpdates?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  zoomLevel: number
  onSelect: (sel: SidebarSelection) => void
  onOpenDailyNote: () => void
  onCloseTab: (path: string) => void
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  themes?: ThemeFile[]
  activeThemeId?: string | null
  onSwitchTheme?: (themeId: string) => void
  onCreateTheme?: () => void
  onOpenTheme?: (themeId: string) => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onRestoreDefaultThemes?: () => void
  isGettingStartedHidden?: boolean
  vaultCount?: number
}

const PLURAL_OVERRIDES: Record<string, string> = {
  Person: 'People',
  Responsibility: 'Responsibilities',
}

const DEFAULT_TYPES = ['Event', 'Person', 'Project', 'Note']

export function pluralizeType(type: string): string {
  if (PLURAL_OVERRIDES[type]) return PLURAL_OVERRIDES[type]
  if (type.endsWith('s') || type.endsWith('x') || type.endsWith('ch') || type.endsWith('sh')) return `${type}es`
  if (type.endsWith('y') && !/[aeiou]y$/i.test(type)) return `${type.slice(0, -1)}ies`
  return `${type}s`
}

export function extractVaultTypes(entries: VaultEntry[]): string[] {
  const typeSet = new Set<string>()
  for (const e of entries) {
    if (e.isA && e.isA !== 'Type' && !e.trashed) typeSet.add(e.isA)
  }
  if (typeSet.size === 0) return DEFAULT_TYPES
  return Array.from(typeSet).sort()
}

const GROUP_ORDER: CommandGroup[] = ['Navigation', 'Note', 'Git', 'View', 'Appearance', 'Settings']

export function groupSortKey(group: CommandGroup): number {
  return GROUP_ORDER.indexOf(group)
}

export function buildTypeCommands(
  types: string[],
  onCreateNoteOfType: (type: string) => void,
  onSelect: (sel: SidebarSelection) => void,
): CommandAction[] {
  return types.flatMap((type) => {
    const slug = type.toLowerCase().replace(/\s+/g, '-')
    const plural = pluralizeType(type)
    return [
      {
        id: `new-${slug}`, label: `New ${type}`, group: 'Note' as CommandGroup,
        keywords: ['new', 'create', type.toLowerCase()],
        enabled: true, execute: () => onCreateNoteOfType(type),
      },
      {
        id: `list-${slug}`, label: `List ${plural}`, group: 'Navigation' as CommandGroup,
        keywords: ['list', 'show', 'filter', type.toLowerCase(), plural.toLowerCase()],
        enabled: true, execute: () => onSelect({ kind: 'sectionGroup', type }),
      },
    ]
  })
}

export function buildViewCommands(
  hasActiveNote: boolean,
  activeNoteModified: boolean,
  onSetViewMode: (mode: ViewMode) => void,
  onToggleInspector: () => void,
  onToggleDiff: (() => void) | undefined,
  onToggleRawEditor: (() => void) | undefined,
  onToggleAIChat: (() => void) | undefined,
  zoomLevel: number,
  onZoomIn: () => void,
  onZoomOut: () => void,
  onZoomReset: () => void,
): CommandAction[] {
  return [
    { id: 'view-editor', label: 'Editor Only', group: 'View', shortcut: '⌘1', keywords: ['layout', 'focus'], enabled: true, execute: () => onSetViewMode('editor-only') },
    { id: 'view-editor-list', label: 'Editor + Note List', group: 'View', shortcut: '⌘2', keywords: ['layout'], enabled: true, execute: () => onSetViewMode('editor-list') },
    { id: 'view-all', label: 'Full Layout', group: 'View', shortcut: '⌘3', keywords: ['layout', 'sidebar'], enabled: true, execute: () => onSetViewMode('all') },
    { id: 'toggle-inspector', label: 'Toggle Properties Panel', group: 'View', keywords: ['properties', 'inspector', 'panel', 'right', 'sidebar'], enabled: true, execute: onToggleInspector },
    { id: 'toggle-diff', label: 'Toggle Diff Mode', group: 'View', keywords: ['diff', 'changes', 'git', 'compare', 'version'], enabled: hasActiveNote && activeNoteModified, execute: () => onToggleDiff?.() },
    { id: 'toggle-raw-editor', label: 'Toggle Raw Editor', group: 'View', keywords: ['raw', 'source', 'markdown', 'frontmatter', 'code', 'textarea'], enabled: hasActiveNote, execute: () => onToggleRawEditor?.() },
    { id: 'toggle-ai-chat', label: 'Toggle AI Chat', group: 'View', shortcut: '⌘I', keywords: ['ai', 'agent', 'chat', 'assistant', 'contextual'], enabled: true, execute: () => onToggleAIChat?.() },
    { id: 'toggle-backlinks', label: 'Toggle Backlinks', group: 'View', keywords: ['backlinks', 'references', 'links', 'mentions', 'incoming'], enabled: hasActiveNote, execute: onToggleInspector },
    { id: 'zoom-in', label: `Zoom In (${zoomLevel}%)`, group: 'View', shortcut: '⌘=', keywords: ['zoom', 'bigger', 'larger', 'scale'], enabled: zoomLevel < 150, execute: onZoomIn },
    { id: 'zoom-out', label: `Zoom Out (${zoomLevel}%)`, group: 'View', shortcut: '⌘-', keywords: ['zoom', 'smaller', 'scale'], enabled: zoomLevel > 80, execute: onZoomOut },
    { id: 'zoom-reset', label: 'Reset Zoom', group: 'View', shortcut: '⌘0', keywords: ['zoom', 'actual', 'default', '100'], enabled: zoomLevel !== 100, execute: onZoomReset },
  ]
}

export function buildThemeCommands(
  themes: ThemeFile[] | undefined,
  activeThemeId: string | null | undefined,
  onSwitchTheme: ((themeId: string) => void) | undefined,
  onCreateTheme: (() => void) | undefined,
  onOpenTheme: ((themeId: string) => void) | undefined,
): CommandAction[] {
  const cmds: CommandAction[] = []
  for (const t of (themes ?? [])) {
    cmds.push({
      id: `switch-theme-${t.id}`,
      label: `Switch to ${t.name} Theme`,
      group: 'Appearance' as CommandGroup,
      keywords: ['theme', 'appearance', 'color', t.name.toLowerCase()],
      enabled: t.id !== activeThemeId,
      execute: () => onSwitchTheme?.(t.id),
    })
    if (onOpenTheme) {
      cmds.push({
        id: `open-theme-${t.id}`,
        label: `Edit ${t.name} Theme`,
        group: 'Appearance' as CommandGroup,
        keywords: ['theme', 'edit', 'open', 'appearance', t.name.toLowerCase()],
        enabled: true,
        execute: () => onOpenTheme(t.id),
      })
    }
  }
  if (onCreateTheme) {
    cmds.push({
      id: 'new-theme', label: 'New Theme', group: 'Appearance' as CommandGroup,
      keywords: ['theme', 'create', 'appearance'], enabled: true, execute: onCreateTheme,
    })
  }
  return cmds
}

export function useCommandRegistry(config: CommandRegistryConfig): CommandAction[] {
  const {
    activeTabPath, entries, modifiedCount,
    onQuickOpen, onCreateNote, onCreateNoteOfType, onSave, onOpenSettings,
    onTrashNote, onRestoreNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onResolveConflicts, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat, onOpenVault,
    activeNoteModified,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onOpenDailyNote, onCloseTab,
    onGoBack, onGoForward, canGoBack, canGoForward,
    themes, activeThemeId, onSwitchTheme, onCreateTheme, onOpenTheme,
    onCheckForUpdates,
    onCreateType,
    onRemoveActiveVault, onRestoreGettingStarted, onRestoreDefaultThemes, isGettingStartedHidden, vaultCount,
    mcpStatus, onInstallMcp,
    onEmptyTrash, trashedCount,
    onReindexVault,
    onReloadVault,
    onRepairVault,
  } = config

  const hasActiveNote = activeTabPath !== null

  const activeEntry = useMemo(
    () => (hasActiveNote ? entries.find(e => e.path === activeTabPath) : undefined),
    [entries, activeTabPath, hasActiveNote],
  )
  const isArchived = activeEntry?.archived ?? false
  const isTrashed = activeEntry?.trashed ?? false

  const vaultTypes = useMemo(() => extractVaultTypes(entries), [entries])

  return useMemo(() => {
    const cmds: CommandAction[] = [
      // Navigation
      { id: 'search-notes', label: 'Search Notes', group: 'Navigation', shortcut: '⌘P', keywords: ['find', 'open', 'quick'], enabled: true, execute: onQuickOpen },
      { id: 'go-all', label: 'Go to All Notes', group: 'Navigation', keywords: ['filter'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'all' }) },
      { id: 'go-archived', label: 'Go to Archived', group: 'Navigation', keywords: [], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'archived' }) },
      { id: 'go-trash', label: 'Go to Trash', group: 'Navigation', keywords: ['deleted'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'trash' }) },
      { id: 'empty-trash', label: 'Empty Trash', group: 'Note', keywords: ['delete', 'permanently', 'purge', 'clear', 'trash'], enabled: (trashedCount ?? 0) > 0, execute: () => onEmptyTrash?.() },
      { id: 'go-changes', label: 'Go to Changes', group: 'Navigation', keywords: ['git', 'modified', 'pending'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
      { id: 'go-pulse', label: 'Go to Pulse', group: 'Navigation', keywords: ['activity', 'history', 'commits', 'git', 'feed'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'pulse' }) },
      { id: 'go-back', label: 'Go Back', group: 'Navigation', shortcut: '⌘[', keywords: ['previous', 'history', 'back'], enabled: !!canGoBack, execute: () => onGoBack?.() },
      { id: 'go-forward', label: 'Go Forward', group: 'Navigation', shortcut: '⌘]', keywords: ['next', 'history', 'forward'], enabled: !!canGoForward, execute: () => onGoForward?.() },

      // Note actions (contextual)
      { id: 'create-note', label: 'Create New Note', group: 'Note', shortcut: '⌘N', keywords: ['new', 'add'], enabled: true, execute: onCreateNote },
      { id: 'create-type', label: 'New Type', group: 'Note', keywords: ['new', 'create', 'type', 'template'], enabled: !!onCreateType, execute: () => onCreateType?.() },
      { id: 'open-daily-note', label: "Open Today's Note", group: 'Note', shortcut: '⌘J', keywords: ['daily', 'journal', 'today'], enabled: true, execute: onOpenDailyNote },
      { id: 'save-note', label: 'Save Note', group: 'Note', shortcut: '⌘S', keywords: ['write'], enabled: hasActiveNote, execute: onSave },
      { id: 'close-tab', label: 'Close Tab', group: 'Note', shortcut: '⌘W', keywords: [], enabled: hasActiveNote, execute: () => { if (activeTabPath) onCloseTab(activeTabPath) } },
      {
        id: 'trash-note', label: isTrashed ? 'Restore Note' : 'Trash Note', group: 'Note', shortcut: '⌘⌫',
        keywords: ['delete', 'remove', 'restore', 'trash'], enabled: hasActiveNote,
        execute: () => { if (activeTabPath) (isTrashed ? onRestoreNote : onTrashNote)(activeTabPath) },
      },
      {
        id: 'archive-note', label: isArchived ? 'Unarchive Note' : 'Archive Note', group: 'Note', shortcut: '⌘E',
        keywords: ['archive'], enabled: hasActiveNote,
        execute: () => { if (activeTabPath) (isArchived ? onUnarchiveNote : onArchiveNote)(activeTabPath) },
      },

      // Git
      { id: 'commit-push', label: 'Commit & Push', group: 'Git', keywords: ['git', 'save', 'sync'], enabled: modifiedCount > 0, execute: onCommitPush },
      { id: 'resolve-conflicts', label: 'Resolve Conflicts', group: 'Git', keywords: ['conflict', 'merge', 'git', 'sync'], enabled: true, execute: () => onResolveConflicts?.() },
      { id: 'view-changes', label: 'View Pending Changes', group: 'Git', keywords: ['modified', 'diff'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },

      // View
      ...buildViewCommands(hasActiveNote, activeNoteModified, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat, zoomLevel, onZoomIn, onZoomOut, onZoomReset),

      // Appearance
      ...buildThemeCommands(themes, activeThemeId, onSwitchTheme, onCreateTheme, onOpenTheme),
      { id: 'restore-default-themes', label: 'Restore Default Themes', group: 'Appearance', keywords: ['theme', 'reset', 'restore', 'default', 'fix', 'missing'], enabled: true, execute: () => onRestoreDefaultThemes?.() },

      // Settings
      { id: 'open-settings', label: 'Open Settings', group: 'Settings', shortcut: '⌘,', keywords: ['preferences', 'config'], enabled: true, execute: onOpenSettings },
      { id: 'open-vault', label: 'Open Vault…', group: 'Settings', keywords: ['vault', 'folder', 'switch', 'open', 'workspace'], enabled: true, execute: () => onOpenVault?.() },
      { id: 'remove-vault', label: 'Remove Vault from List', group: 'Settings', keywords: ['vault', 'remove', 'disconnect', 'hide'], enabled: (vaultCount ?? 0) > 1 && !!onRemoveActiveVault, execute: () => onRemoveActiveVault?.() },
      { id: 'restore-getting-started', label: 'Restore Getting Started Vault', group: 'Settings', keywords: ['vault', 'restore', 'demo', 'getting started', 'reset'], enabled: !!isGettingStartedHidden && !!onRestoreGettingStarted, execute: () => onRestoreGettingStarted?.() },
      { id: 'check-updates', label: 'Check for Updates', group: 'Settings', keywords: ['update', 'version', 'upgrade', 'release'], enabled: true, execute: () => onCheckForUpdates?.() },
      { id: 'install-mcp', label: mcpStatus === 'installed' ? 'Restore MCP Server' : 'Install MCP Server', group: 'Settings', keywords: ['mcp', 'claude', 'ai', 'tools', 'install', 'restore', 'fix', 'repair'], enabled: true, execute: () => onInstallMcp?.() },
      { id: 'reindex-vault', label: 'Reindex Vault', group: 'Settings', keywords: ['reindex', 'index', 'search', 'rebuild', 'refresh'], enabled: !!onReindexVault, execute: () => onReindexVault?.() },
      { id: 'reload-vault', label: 'Reload Vault', group: 'Settings', keywords: ['reload', 'refresh', 'rescan', 'sync', 'filesystem', 'cache'], enabled: !!onReloadVault, execute: () => onReloadVault?.() },
      { id: 'repair-vault', label: 'Repair Vault', group: 'Settings', keywords: ['repair', 'fix', 'restore', 'config', 'agents', 'themes', 'missing', 'reset'], enabled: !!onRepairVault, execute: () => onRepairVault?.() },

      // Type-aware: "New [Type]" and "List [Type]"
      ...buildTypeCommands(vaultTypes, onCreateNoteOfType, onSelect),
    ]

    return cmds
  }, [
    hasActiveNote, activeTabPath, isArchived, isTrashed, modifiedCount, activeNoteModified,
    onQuickOpen, onCreateNote, onCreateNoteOfType, onCreateType, onSave, onOpenSettings,
    onTrashNote, onRestoreNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onResolveConflicts, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat, onOpenVault,
    onCheckForUpdates,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onOpenDailyNote, onCloseTab,
    onGoBack, onGoForward, canGoBack, canGoForward,
    vaultTypes, themes, activeThemeId, onSwitchTheme, onCreateTheme, onOpenTheme, onRestoreDefaultThemes,
    onRemoveActiveVault, onRestoreGettingStarted, isGettingStartedHidden, vaultCount,
    mcpStatus, onInstallMcp,
    onEmptyTrash, trashedCount,
    onReindexVault, onReloadVault, onRepairVault,
  ])
}
