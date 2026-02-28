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
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
  activeTabPath: string | null
}

const VIEW_MODE_MAP: Record<string, ViewMode> = {
  'view-editor-only': 'editor-only',
  'view-editor-list': 'editor-list',
  'view-all': 'all',
}

type SimpleHandler = 'onCreateNote' | 'onQuickOpen' | 'onSave' | 'onOpenSettings' | 'onToggleInspector' | 'onCommandPalette' | 'onZoomIn' | 'onZoomOut' | 'onZoomReset'

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
}

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  const viewMode = VIEW_MODE_MAP[id]
  if (viewMode) { h.onSetViewMode(viewMode); return }

  const simple = SIMPLE_EVENT_MAP[id]
  if (simple) { h[simple](); return }

  if (id === 'file-close-tab') {
    const path = h.activeTabPathRef.current
    if (path) h.handleCloseTabRef.current(path)
  }
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
