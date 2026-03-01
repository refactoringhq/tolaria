import { useEffect, useRef } from 'react'
import { isTauri } from '../mock-tauri'
import type { ViewMode } from './useViewMode'

export interface MenuEventHandlers {
  onSetViewMode: (mode: ViewMode) => void
  onCreateNote: () => void
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
  onGoBack?: () => void
  onGoForward?: () => void
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
  activeTabPath: string | null
}

const VIEW_MODE_MAP: Record<string, ViewMode> = {
  'view-editor-only': 'editor-only',
  'view-editor-list': 'editor-list',
  'view-all': 'all',
}

type SimpleHandler = 'onCreateNote' | 'onQuickOpen' | 'onSave' | 'onOpenSettings' | 'onToggleInspector' | 'onCommandPalette' | 'onZoomIn' | 'onZoomOut' | 'onZoomReset' | 'onSearch'

const SIMPLE_EVENT_MAP: Record<string, SimpleHandler> = {
  'file-new-note': 'onCreateNote',
  'file-quick-open': 'onQuickOpen',
  'file-save': 'onSave',
  'app-settings': 'onOpenSettings',
  'view-toggle-inspector': 'onToggleInspector',
  'view-command-palette': 'onCommandPalette',
  'view-zoom-in': 'onZoomIn',
  'view-zoom-out': 'onZoomOut',
  'view-zoom-reset': 'onZoomReset',
  'edit-find-in-vault': 'onSearch',
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
  if (id === 'view-go-back') { h.onGoBack?.(); return true }
  if (id === 'view-go-forward') { h.onGoForward?.(); return true }
  return false
}

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  const viewMode = VIEW_MODE_MAP[id]
  if (viewMode) { h.onSetViewMode(viewMode); return }

  const simple = SIMPLE_EVENT_MAP[id]
  if (simple) { h[simple](); return }

  if (dispatchActiveTabEvent(id, h)) return
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

  // Sync menu item enabled state when active tab changes
  useEffect(() => {
    if (!isTauri()) return
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('update_menu_state', { hasActiveNote: handlers.activeTabPath !== null })
    }).catch(() => {})
  }, [handlers.activeTabPath])
}
