import { useCallback, useEffect, useRef } from 'react'

interface HeadingTitleSyncConfig {
  activeTabPath: string | null
  currentTitle: string | null
  onTitleSync: (path: string, newTitle: string) => void
}

const DEBOUNCE_MS = 500

/**
 * Syncs the note title with the editor's first H1 heading.
 *
 * - On every editor change, the caller passes the current H1 text via onH1Changed.
 * - After a 500ms debounce, VaultEntry.title is updated to match.
 * - If the user manually renames the title (via tab) to something different from
 *   the H1, sync breaks and stops updating until the tab is switched.
 * - If the H1 is deleted, the last synced title is kept (no clear).
 */
export function useHeadingTitleSync({
  activeTabPath,
  currentTitle,
  onTitleSync,
}: HeadingTitleSyncConfig) {
  const syncActiveRef = useRef(true)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const activeTabPathRef = useRef(activeTabPath)
  // eslint-disable-next-line react-hooks/refs
  activeTabPathRef.current = activeTabPath
  const onTitleSyncRef = useRef(onTitleSync)
  // eslint-disable-next-line react-hooks/refs
  onTitleSyncRef.current = onTitleSync
  const currentTitleRef = useRef(currentTitle)
  // eslint-disable-next-line react-hooks/refs
  currentTitleRef.current = currentTitle

  // Reset sync state when switching tabs
  useEffect(() => {
    syncActiveRef.current = true
    clearTimeout(debounceTimerRef.current)
  }, [activeTabPath])

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(debounceTimerRef.current), [])

  /** Called on every editor change with the H1 text (null if no H1 first block). */
  const onH1Changed = useCallback((h1Text: string | null) => {
    if (!h1Text || !activeTabPathRef.current || !syncActiveRef.current) return
    if (h1Text === currentTitleRef.current) return

    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (syncActiveRef.current && activeTabPathRef.current) {
        onTitleSyncRef.current(activeTabPathRef.current, h1Text)
      }
    }, DEBOUNCE_MS)
  }, [])

  /** Called when the user manually renames via tab double-click.
   *  Breaks sync if the new title differs from the current H1. */
  const onManualRename = useCallback((newTitle: string, currentH1: string | null) => {
    if (currentH1 && currentH1 !== newTitle) {
      syncActiveRef.current = false
    }
  }, [])

  return { syncActiveRef, onH1Changed, onManualRename }
}
