import { useEffect, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import type { SidebarFilter } from '../types'
import type { ViewMode } from './useViewMode'

export interface MenuEventHandlers {
  onSetViewMode: (mode: ViewMode) => void
  onCreateNote: () => void
  onCreateType?: () => void
  onOpenDailyNote: () => void
  onQuickOpen: () => void
  onSave: () => void
  onOpenSettings: () => void
  onToggleInspector: () => void
  onCommandPalette: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onArchiveNote: (path: string) => void
  onTrashNote: (path: string) => void
  onSearch: () => void
  onToggleRawEditor?: () => void
  onToggleDiff?: () => void
  onToggleAIChat?: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onCheckForUpdates?: () => void
  onSelectFilter?: (filter: SidebarFilter) => void
  onOpenVault?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onCreateTheme?: () => void
  onRestoreDefaultThemes?: () => void
  onCommitPush?: () => void
  onResolveConflicts?: () => void
  onViewChanges?: () => void
  onInstallMcp?: () => void
  onReopenClosedTab?: () => void
  onReindexVault?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
  onEmptyTrash?: () => void
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
  activeTabPath: string | null
  modifiedCount?: number
  conflictCount?: number
}

const VIEW_MODE_MAP: Record<string, ViewMode> = {
  'view-editor-only': 'editor-only',
  'view-editor-list': 'editor-list',
  'view-all': 'all',
}

type SimpleHandler = 'onCreateNote' | 'onOpenDailyNote' | 'onQuickOpen' | 'onSave' | 'onOpenSettings' | 'onToggleInspector' | 'onCommandPalette' | 'onZoomIn' | 'onZoomOut' | 'onZoomReset' | 'onSearch'

const SIMPLE_EVENT_MAP: Record<string, SimpleHandler> = {
  'file-new-note': 'onCreateNote',
  'file-daily-note': 'onOpenDailyNote',
  'file-quick-open': 'onQuickOpen',
  'file-save': 'onSave',
  'app-settings': 'onOpenSettings',
  'view-toggle-properties': 'onToggleInspector',
  'view-toggle-backlinks': 'onToggleInspector',
  'view-command-palette': 'onCommandPalette',
  'view-zoom-in': 'onZoomIn',
  'view-zoom-out': 'onZoomOut',
  'view-zoom-reset': 'onZoomReset',
  'edit-find-in-vault': 'onSearch',
}

const FILTER_MAP: Record<string, SidebarFilter> = {
  'go-all-notes': 'all',
  'go-archived': 'archived',
  'go-trash': 'trash',
  'go-changes': 'changes',
}

type OptionalHandler =
  | 'onGoBack' | 'onGoForward' | 'onCheckForUpdates'
  | 'onCreateType' | 'onToggleRawEditor' | 'onToggleDiff' | 'onToggleAIChat'
  | 'onOpenVault' | 'onRemoveActiveVault' | 'onRestoreGettingStarted'
  | 'onCreateTheme' | 'onRestoreDefaultThemes'
  | 'onCommitPush' | 'onResolveConflicts' | 'onViewChanges' | 'onInstallMcp' | 'onReindexVault' | 'onReloadVault' | 'onRepairVault'
  | 'onEmptyTrash'
  | 'onReopenClosedTab'

const OPTIONAL_EVENT_MAP: Record<string, OptionalHandler> = {
  'view-go-back': 'onGoBack',
  'view-go-forward': 'onGoForward',
  'app-check-for-updates': 'onCheckForUpdates',
  'file-new-type': 'onCreateType',
  'edit-toggle-raw-editor': 'onToggleRawEditor',
  'edit-toggle-diff': 'onToggleDiff',
  'view-toggle-ai-chat': 'onToggleAIChat',
  'vault-open': 'onOpenVault',
  'vault-remove': 'onRemoveActiveVault',
  'vault-restore-getting-started': 'onRestoreGettingStarted',
  'vault-new-theme': 'onCreateTheme',
  'vault-restore-default-themes': 'onRestoreDefaultThemes',
  'vault-commit-push': 'onCommitPush',
  'vault-resolve-conflicts': 'onResolveConflicts',
  'vault-view-changes': 'onViewChanges',
  'vault-install-mcp': 'onInstallMcp',
  'vault-reindex': 'onReindexVault',
  'vault-reload': 'onReloadVault',
  'vault-repair': 'onRepairVault',
  'note-empty-trash': 'onEmptyTrash',
  'file-reopen-closed-tab': 'onReopenClosedTab',
}

function dispatchActiveTabEvent(id: string, h: MenuEventHandlers): boolean {
  const path = h.activeTabPathRef.current
  if (!path) return id === 'note-archive' || id === 'note-trash' || id === 'file-close-tab'
  if (id === 'note-archive') { h.onArchiveNote(path); return true }
  if (id === 'note-trash') { h.onTrashNote(path); return true }
  if (id === 'file-close-tab') { h.handleCloseTabRef.current(path); return true }
  return false
}

function dispatchOptionalEvent(id: string, h: MenuEventHandlers): boolean {
  const handler = OPTIONAL_EVENT_MAP[id]
  if (handler) { h[handler]?.(); return true }
  return false
}

function dispatchFilterEvent(id: string, h: MenuEventHandlers): boolean {
  const filter = FILTER_MAP[id]
  if (filter) { h.onSelectFilter?.(filter); return true }
  return false
}

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  const viewMode = VIEW_MODE_MAP[id]
  if (viewMode) { h.onSetViewMode(viewMode); return }

  const simple = SIMPLE_EVENT_MAP[id]
  if (simple) { h[simple](); return }

  if (dispatchActiveTabEvent(id, h)) return
  if (dispatchFilterEvent(id, h)) return
  dispatchOptionalEvent(id, h)
}

/** Listen for native macOS menu events and dispatch them to the appropriate handlers. */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  // Subscribe once to Tauri menu events
  useEffect(() => {
    if (!isTauri()) return

    let cleanup: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisten = listen<string>('menu-event', (event) => {
        dispatchMenuEvent(event.payload, ref.current)
      })
      cleanup = () => { unlisten.then(fn => fn()) }
    }).catch(() => { /* not in Tauri */ })

    return () => cleanup?.()
  }, [])

  // Sync menu item enabled state when active tab or git state changes
  useEffect(() => {
    if (!isTauri()) return
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('update_menu_state', {
        hasActiveNote: handlers.activeTabPath !== null,
        hasModifiedFiles: handlers.modifiedCount != null ? handlers.modifiedCount > 0 : undefined,
        hasConflicts: handlers.conflictCount != null ? handlers.conflictCount > 0 : undefined,
      })
    }).catch(() => {})
  }, [handlers.activeTabPath, handlers.modifiedCount, handlers.conflictCount])
}
