import { useState, useCallback } from 'react'

export type ViewMode = 'editor-only' | 'editor-list' | 'all'

const STORAGE_KEY = 'laputa-view-mode'

function loadViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'editor-only' || stored === 'editor-list' || stored === 'all') return stored
  } catch { /* ignore */ }
  return 'all'
}

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode)

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
  }, [])

  const sidebarVisible = viewMode === 'all'
  const noteListVisible = viewMode === 'all' || viewMode === 'editor-list'

  return { viewMode, setViewMode, sidebarVisible, noteListVisible }
}
