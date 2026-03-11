import { useState, useCallback } from 'react'

interface UseRawModeParams {
  activeTabPath: string | null
  /** Flush pending WYSIWYG edits to disk before entering raw mode. */
  onFlushPending?: () => Promise<boolean>
  /** Called synchronously before raw mode is deactivated, so the caller can
   *  flush any debounced raw-editor content into tab state. */
  onBeforeRawEnd?: () => void
}

/**
 * Manages raw editor mode state.
 * Raw mode is automatically inactive when the active tab changes,
 * because rawMode is derived from whether the stored path matches the current tab.
 */
export function useRawMode({ activeTabPath, onFlushPending, onBeforeRawEnd }: UseRawModeParams) {
  // Track which path has raw mode active — automatically deactivates on tab switch
  const [rawActivePath, setRawActivePath] = useState<string | null>(null)
  const rawMode = rawActivePath !== null && rawActivePath === activeTabPath

  const handleToggleRaw = useCallback(async () => {
    if (rawMode) {
      onBeforeRawEnd?.()
      setRawActivePath(null)
    } else {
      await onFlushPending?.()
      setRawActivePath(activeTabPath)
    }
  }, [rawMode, activeTabPath, onFlushPending, onBeforeRawEnd])

  return { rawMode, handleToggleRaw }
}
