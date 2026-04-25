import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const MAIN_WINDOW_MIN_HEIGHT = 400
const EDITOR_ONLY_MAIN_WINDOW_MIN_WIDTH = 480
const MAIN_WINDOW_SIDEBAR_MIN_WIDTH = 180
const MAIN_WINDOW_NOTE_LIST_MIN_WIDTH = 220
const MAIN_WINDOW_INSPECTOR_MIN_WIDTH = 240

export type MainWindowPaneVisibility = {
  sidebarVisible: boolean
  noteListVisible: boolean
  inspectorCollapsed: boolean
}

export function getMainWindowMinWidth({
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
}: MainWindowPaneVisibility): number {
  let minWidth = EDITOR_ONLY_MAIN_WINDOW_MIN_WIDTH

  if (sidebarVisible) minWidth += MAIN_WINDOW_SIDEBAR_MIN_WIDTH
  if (noteListVisible) minWidth += MAIN_WINDOW_NOTE_LIST_MIN_WIDTH
  if (!inspectorCollapsed) minWidth += MAIN_WINDOW_INSPECTOR_MIN_WIDTH

  return minWidth
}

type MainWindowSizeConstraintsOptions = MainWindowPaneVisibility & {
  enabled?: boolean
}

export async function applyMainWindowSizeConstraints(
  minWidth: number,
): Promise<void> {
  await invoke('update_current_window_min_size', {
    minWidth,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    growToFit: true,
  })
}

export function useMainWindowSizeConstraints({
  enabled = true,
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
}: MainWindowSizeConstraintsOptions): void {
  const minWidth = getMainWindowMinWidth({
    sidebarVisible,
    noteListVisible,
    inspectorCollapsed,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    void (async () => {
      if (cancelled) return
      await applyMainWindowSizeConstraints(minWidth)
    })().catch((err) => console.warn('[window] Size constraints failed:', err))

    return () => {
      cancelled = true
    }
  }, [enabled, minWidth])
}
