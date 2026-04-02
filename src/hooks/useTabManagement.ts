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

/** Sync title frontmatter with filename on note open.
 *  Returns true if the file was modified. */
export async function syncNoteTitle(path: string): Promise<boolean> {
  try {
    return isTauri()
      ? await invoke<boolean>('sync_note_title', { path })
      : false // mock: no-op
  } catch { return false }
}

export type { Tab }

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
    // Binary files cannot be opened
    if (entry.fileKind === 'binary') return
    // Already viewing this note — no-op
    if (tabsRef.current.some(t => t.entry.path === entry.path)) {
      setActiveTabPath(entry.path)
      return
    }
    const seq = ++navSeqRef.current
    if (!entry.fileKind || entry.fileKind === 'markdown') await syncNoteTitle(entry.path)
    try {
      const content = await loadNoteContent(entry.path)
      if (navSeqRef.current === seq) {
        setTabs([{ entry, content }])
        setActiveTabPath(entry.path)
      }
    } catch (err) {
      console.warn('Failed to load note content:', err)
      if (navSeqRef.current === seq) {
        setTabs([{ entry, content: '' }])
        setActiveTabPath(entry.path)
      }
    }
  }, [])

  const handleSwitchTab = useCallback((path: string) => { setActiveTabPath(path) }, [])

  /** Open a tab with known content — no IPC round-trip. Used for newly created notes. */
  const openTabWithContent = useCallback((entry: VaultEntry, content: string) => {
    setTabs([{ entry, content }])
    setActiveTabPath(entry.path)
  }, [])

  const handleReplaceActiveTab = useCallback(async (entry: VaultEntry) => {
    // Binary files cannot be opened
    if (entry.fileKind === 'binary') return
    // In single-note model, replace is the same as select
    if (tabsRef.current.some(t => t.entry.path === entry.path)) {
      setActiveTabPath(entry.path)
      return
    }
    const seq = ++navSeqRef.current
    try {
      const content = await loadNoteContent(entry.path)
      if (navSeqRef.current === seq) {
        setTabs([{ entry, content }])
        setActiveTabPath(entry.path)
      }
    } catch (err) {
      console.warn('Failed to load note content:', err)
      if (navSeqRef.current === seq) {
        setTabs([{ entry, content: '' }])
        setActiveTabPath(entry.path)
      }
    }
  }, [])

  const closeAllTabs = useCallback(() => {
    setTabs([])
    setActiveTabPath(null)
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
