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
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
  activeTabPath: string | null
}

const VIEW_MODE_MAP: Record<string, ViewMode> = {
  'view-editor-only': 'editor-only',
  'view-editor-list': 'editor-list',
  'view-all': 'all',
}

/** Dispatch a Tauri menu event ID to the matching handler. Exported for testing. */
export function dispatchMenuEvent(id: string, h: MenuEventHandlers): void {
  const viewMode = VIEW_MODE_MAP[id]
  if (viewMode) { h.onSetViewMode(viewMode); return }

  switch (id) {
    case 'file-new-note': h.onCreateNote(); break
    case 'file-quick-open': h.onQuickOpen(); break
    case 'file-save': h.onSave(); break
    case 'file-close-tab': {
      const path = h.activeTabPathRef.current
      if (path) h.handleCloseTabRef.current(path)
      break
    }
    case 'app-settings': h.onOpenSettings(); break
    case 'view-toggle-inspector': h.onToggleInspector(); break
    case 'view-command-palette': h.onCommandPalette(); break
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
