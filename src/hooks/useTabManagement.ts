import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'

interface Tab {
  entry: VaultEntry
  content: string
}

// --- Content prefetch cache ---
// Stores in-flight or resolved note content promises, keyed by path.
// Cleared on vault reload to prevent stale content after external edits.
// Latency profile: eliminates 50-200ms IPC round-trip for hover/keyboard-prefetched notes.
const prefetchCache = new Map<string, Promise<string>>()

/** Prefetch a note's content into the in-memory cache.
 *  Safe to call multiple times — deduplicates concurrent requests for the same path.
 *  Cache is short-lived: cleared on vault reload via clearPrefetchCache(). */
export function prefetchNoteContent(path: string): void {
  if (prefetchCache.has(path)) return
  const promise = (isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
  ).catch((err) => {
    // Remove failed prefetch so a retry can occur
    prefetchCache.delete(path)
    throw err
  })
  prefetchCache.set(path, promise)
}

/** Clear the prefetch cache. Call on vault reload to prevent stale content. */
export function clearPrefetchCache(): void {
  prefetchCache.clear()
}

async function loadNoteContent(path: string): Promise<string> {
  // Check prefetch cache first — eliminates IPC round-trip for prefetched notes
  const cached = prefetchCache.get(path)
  if (cached) {
    prefetchCache.delete(path)
    return cached
  }
  return isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
}

export type { Tab }

function syncActiveTabPath(
  activeTabPathRef: React.MutableRefObject<string | null>,
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>,
  path: string | null,
) {
  activeTabPathRef.current = path
  setActiveTabPath(path)
}

function setSingleTab(
  tabsRef: React.MutableRefObject<Tab[]>,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  nextTab: Tab,
) {
  tabsRef.current = [nextTab]
  setTabs([nextTab])
}

function isAlreadyViewingPath(
  tabsRef: React.MutableRefObject<Tab[]>,
  activeTabPathRef: React.MutableRefObject<string | null>,
  path: string,
) {
  return activeTabPathRef.current === path || tabsRef.current.some((tab) => tab.entry.path === path)
}

async function navigateToEntry(options: {
  entry: VaultEntry
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  activeTabPathRef: React.MutableRefObject<string | null>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const {
    entry,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
  } = options

  if (entry.fileKind === 'binary') return
  if (isAlreadyViewingPath(tabsRef, activeTabPathRef, entry.path)) {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
    return
  }

  const seq = ++navSeqRef.current
  syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)

  try {
    const content = await loadNoteContent(entry.path)
    if (navSeqRef.current !== seq) return
    setSingleTab(tabsRef, setTabs, { entry, content })
  } catch (err) {
    console.warn('Failed to load note content:', err)
    if (navSeqRef.current !== seq) return
    setSingleTab(tabsRef, setTabs, { entry, content: '' })
  }
}

export function useTabManagement() {
  // Single-note model: tabs has 0 or 1 elements.
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const activeTabPathRef = useRef(activeTabPath)
  useEffect(() => { activeTabPathRef.current = activeTabPath })
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs })

  // Sequence counter for rapid-switch safety: only the latest navigation wins.
  const navSeqRef = useRef(0)

  /** Open a note — replaces the current note (single-note model). */
  const handleSelectNote = useCallback(async (entry: VaultEntry) => {
    await navigateToEntry({
      entry,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
    })
  }, [])

  const handleSwitchTab = useCallback((path: string) => {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, path)
  }, [])

  /** Open a tab with known content — no IPC round-trip. Used for newly created notes. */
  const openTabWithContent = useCallback((entry: VaultEntry, content: string) => {
    setSingleTab(tabsRef, setTabs, { entry, content })
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
  }, [])

  const handleReplaceActiveTab = useCallback(async (entry: VaultEntry) => {
    await navigateToEntry({
      entry,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
    })
  }, [])

  const closeAllTabs = useCallback(() => {
    tabsRef.current = []
    setTabs([])
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, null)
  }, [])

  return {
    tabs,
    setTabs,
    activeTabPath,
    activeTabPathRef,
    handleSelectNote,
    openTabWithContent,
    handleSwitchTab,
    handleReplaceActiveTab,
    closeAllTabs,
  }
}
