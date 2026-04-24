import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback } from 'react'

const NO_DRAG_SELECTOR = 'button, input, select, a, [data-no-drag]'

function isDragDisabledTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NO_DRAG_SELECTOR) !== null
}

function performCurrentWindowTitlebarDoubleClick(): Promise<void> {
  return invoke<void>('perform_current_window_titlebar_double_click')
}

/**
 * Returns a mousedown handler that triggers Tauri window drag via startDragging().
 * More reliable than data-tauri-drag-region with titleBarStyle: Overlay in Tauri v2.
 */
export function useDragRegion() {
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (isDragDisabledTarget(e.target)) return
    e.preventDefault()
    if (e.detail === 2) {
      void performCurrentWindowTitlebarDoubleClick().catch(() => {})
      return
    }
    void getCurrentWindow().startDragging().catch(() => {})
  }, [])

  return { onMouseDown }
}
