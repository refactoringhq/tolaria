import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import {
  beginNoteOpenTrace,
  failNoteOpenTrace,
  finishNoteOpenTrace,
  markNoteOpenTrace,
} from '../utils/noteOpenPerformance'

interface Tab {
  entry: VaultEntry
  content: string
}

type NotePath = VaultEntry['path']

// --- Content prefetch cache ---
// Stores in-flight or recently loaded note content promises, keyed by path.
// Cleared on vault reload to prevent stale content after external edits.
// Latency profile: deduplicates rapid note switches and keeps revisits instant.
interface NoteContentCacheEntry {
  path: NotePath
  promise: Promise<string>
  value: string | null
}

const prefetchCache = new Map<string, NoteContentCacheEntry>()
const NOTE_CONTENT_CACHE_LIMIT = 48

function trimPrefetchCache(): void {
  while (prefetchCache.size > NOTE_CONTENT_CACHE_LIMIT) {
    const oldestPath = prefetchCache.keys().next().value
    if (!oldestPath) return
    prefetchCache.delete(oldestPath)
  }
}

function rememberNoteContent(entry: NoteContentCacheEntry): NoteContentCacheEntry {
  const { path } = entry
  if (prefetchCache.has(path)) prefetchCache.delete(path)
  prefetchCache.set(path, entry)
  trimPrefetchCache()
  return entry
}

function requestNoteContent({ path }: Pick<NoteContentCacheEntry, 'path'>): NoteContentCacheEntry {
  const cacheEntry: NoteContentCacheEntry = {
    path,
    promise: Promise.resolve(''),
    value: null,
  }
  const promise = (isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
  )
    .then((content) => {
      cacheEntry.value = content
      return content
    })
    .catch((err) => {
      prefetchCache.delete(path)
      throw err
    })

  cacheEntry.promise = promise
  return rememberNoteContent(cacheEntry)
}

/** Prefetch a note's content into the in-memory cache.
 *  Safe to call multiple times — deduplicates concurrent requests for the same path.
 *  Cache is short-lived: cleared on vault reload via clearPrefetchCache(). */
export function prefetchNoteContent(path: string): void {
  if (prefetchCache.has(path)) return
  void requestNoteContent({ path }).promise.catch((error) => {
    if (isNoActiveVaultSelectedError(error)) return
    console.warn('Failed to prefetch note content:', error)
  })
}

export function cacheNoteContent(path: string, content: string): void {
  rememberNoteContent({
    path,
    promise: Promise.resolve(content),
    value: content,
  })
}

/** Clear the prefetch cache. Call on vault reload to prevent stale content. */
export function clearPrefetchCache(): void {
  prefetchCache.clear()
}

function getCachedNoteContent(path: string): string | null {
  return prefetchCache.get(path)?.value ?? null
}

async function loadNoteContent(path: string, forceFresh = false): Promise<string> {
  if (forceFresh) return requestNoteContent({ path }).promise
  return prefetchCache.get(path)?.promise ?? requestNoteContent({ path }).promise
}

export type { Tab }

interface TabManagementOptions {
  beforeNavigate?: (fromPath: string, toPath: string) => Promise<void>
  onMissingNotePath?: (entry: VaultEntry, error: unknown) => void | Promise<void>
}

function syncActiveTabPath(
  activeTabPathRef: React.MutableRefObject<string | null>,
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>,
  path: string | null,
) {
  activeTabPathRef.current = path
  setActiveTabPath(path)
}

function normalizeComparablePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^\/private\/tmp(?=\/|$)/u, '/tmp')
    .replace(/\/+$/u, '')
}

function pathsMatch(leftPath: string | null, rightPath: string | null): boolean {
  if (!leftPath || !rightPath) return false
  return normalizeComparablePath(leftPath) === normalizeComparablePath(rightPath)
}

function setSingleTab(
  tabsRef: React.MutableRefObject<Tab[]>,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  nextTab: Tab,
) {
  tabsRef.current = [nextTab]
  setTabs([nextTab])
}

function clearTabs(
  tabsRef: React.MutableRefObject<Tab[]>,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
) {
  tabsRef.current = []
  setTabs([])
}

function isAlreadyViewingPath(
  tabsRef: React.MutableRefObject<Tab[]>,
  activeTabPathRef: React.MutableRefObject<string | null>,
  path: string,
) {
  return pathsMatch(activeTabPathRef.current, path)
    || tabsRef.current.some((tab) => pathsMatch(tab.entry.path, path))
}

function startEntryNavigation(options: {
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

  const seq = ++navSeqRef.current
  const cachedContent = getCachedNoteContent(entry.path)
  syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
  if (cachedContent !== null) {
    markNoteOpenTrace(entry.path, 'cacheReady')
    setSingleTab(tabsRef, setTabs, { entry, content: cachedContent })
  }

  return { seq, cachedContent }
}

function isMissingNotePathError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : String(error)
  return /does not exist|not found|enoent/i.test(message)
}

function isNoActiveVaultSelectedError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : String(error)
  return /no active vault selected/i.test(message)
}

function shouldApplyLoadedEntry(options: {
  seq: number
  navSeqRef: React.MutableRefObject<number>
  cachedContent: string | null
  content: string
  forceReload: boolean
  activeTabPathRef: React.MutableRefObject<string | null>
  path: string
}) {
  const {
    seq,
    navSeqRef,
    cachedContent,
    content,
    forceReload,
    activeTabPathRef,
    path,
  } = options

  if (navSeqRef.current !== seq) return false
  if (forceReload) return true
  return cachedContent !== content || !pathsMatch(activeTabPathRef.current, path)
}

function handleEntryLoadFailure(options: {
  entry: VaultEntry
  seq: number
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  activeTabPathRef: React.MutableRefObject<string | null>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>
  error: unknown
  onMissingNotePath?: (entry: VaultEntry, error: unknown) => void | Promise<void>
}) {
  const {
    entry,
    seq,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
    error,
    onMissingNotePath,
  } = options

  console.warn('Failed to load note content:', error)
  if (navSeqRef.current !== seq) return
  if (isNoActiveVaultSelectedError(error)) {
    clearPrefetchCache()
    clearTabs(tabsRef, setTabs)
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, null)
    failNoteOpenTrace(entry.path, 'missing-active-vault')
    return
  }
  if (isMissingNotePathError(error)) {
    clearTabs(tabsRef, setTabs)
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, null)
    failNoteOpenTrace(entry.path, 'missing-path')
    Promise.resolve(onMissingNotePath?.(entry, error)).catch((callbackError) => {
      console.warn('Failed to handle missing note path:', callbackError)
    })
    return
  }
  setSingleTab(tabsRef, setTabs, { entry, content: '' })
  failNoteOpenTrace(entry.path, 'load-failed')
}

async function navigateToEntry(options: {
  entry: VaultEntry
  forceReload?: boolean
  navSeqRef: React.MutableRefObject<number>
  tabsRef: React.MutableRefObject<Tab[]>
  activeTabPathRef: React.MutableRefObject<string | null>
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>
  setActiveTabPath: React.Dispatch<React.SetStateAction<string | null>>
  onMissingNotePath?: (entry: VaultEntry, error: unknown) => void | Promise<void>
}) {
  const {
    entry,
    forceReload = false,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
    onMissingNotePath,
  } = options

  if (entry.fileKind === 'binary') {
    failNoteOpenTrace(entry.path, 'binary-entry')
    return
  }
  if (!forceReload && isAlreadyViewingPath(tabsRef, activeTabPathRef, entry.path)) {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
    finishNoteOpenTrace(entry.path)
    return
  }

  const { seq, cachedContent } = startEntryNavigation({
    entry,
    navSeqRef,
    tabsRef,
    activeTabPathRef,
    setTabs,
    setActiveTabPath,
  })

  try {
    markNoteOpenTrace(entry.path, 'contentLoadStart')
    // Cached content keeps note switches instant, but synced vaults can make
    // the underlying path disappear between opens. Reopened notes still need a
    // fresh disk read so missing-file recovery can run.
    const content = await loadNoteContent(entry.path, forceReload || cachedContent !== null)
    markNoteOpenTrace(entry.path, 'contentLoadEnd')
    if (!shouldApplyLoadedEntry({
      seq,
      navSeqRef,
      cachedContent,
      content,
      forceReload,
      activeTabPathRef,
      path: entry.path,
    })) return
    setSingleTab(tabsRef, setTabs, { entry, content })
  } catch (err) {
    handleEntryLoadFailure({
      entry,
      seq,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
      error: err,
      onMissingNotePath,
    })
  }
}

export function useTabManagement(options: TabManagementOptions = {}) {
  // Single-note model: tabs has 0 or 1 elements.
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const activeTabPathRef = useRef(activeTabPath)
  useEffect(() => { activeTabPathRef.current = activeTabPath })
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs })

  // Sequence counter for rapid-switch safety: only the latest navigation wins.
  const navSeqRef = useRef(0)
  const beforeNavigateSeqRef = useRef(0)
  const beforeNavigate = options.beforeNavigate
  const onMissingNotePath = options.onMissingNotePath

  const executeNavigationWithBoundary = useCallback(async (
    targetPath: string,
    navigate: () => void | Promise<void>,
  ) => {
    const seq = ++beforeNavigateSeqRef.current
    const currentPath = activeTabPathRef.current
    if (beforeNavigate && currentPath && !pathsMatch(currentPath, targetPath)) {
      try {
        markNoteOpenTrace(targetPath, 'beforeNavigateStart')
        await beforeNavigate(currentPath, targetPath)
        markNoteOpenTrace(targetPath, 'beforeNavigateEnd')
      } catch (err) {
        console.warn('Failed to persist note before navigation:', err)
        failNoteOpenTrace(targetPath, 'before-navigate-failed')
        return
      }
      if (beforeNavigateSeqRef.current !== seq) return
    }
    await navigate()
  }, [beforeNavigate])

  /** Open a note — replaces the current note (single-note model). */
  const handleSelectNote = useCallback(async (entry: VaultEntry) => {
    if (!pathsMatch(entry.path, activeTabPathRef.current)) {
      beginNoteOpenTrace(entry.path, 'select-note')
    }
    await executeNavigationWithBoundary(entry.path, () => navigateToEntry({
      entry,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
      onMissingNotePath,
    }))
  }, [executeNavigationWithBoundary, onMissingNotePath])

  const handleSwitchTab = useCallback((path: string) => {
    syncActiveTabPath(activeTabPathRef, setActiveTabPath, path)
  }, [])

  /** Open a tab with known content — no IPC round-trip. Used for newly created notes. */
  const openTabWithContent = useCallback((entry: VaultEntry, content: string) => {
    void executeNavigationWithBoundary(entry.path, () => {
      setSingleTab(tabsRef, setTabs, { entry, content })
      syncActiveTabPath(activeTabPathRef, setActiveTabPath, entry.path)
    })
  }, [executeNavigationWithBoundary])

  const handleReplaceActiveTab = useCallback(async (entry: VaultEntry) => {
    if (!pathsMatch(entry.path, activeTabPathRef.current)) {
      beginNoteOpenTrace(entry.path, 'replace-active-tab')
    }
    await executeNavigationWithBoundary(entry.path, () => navigateToEntry({
      entry,
      forceReload: true,
      navSeqRef,
      tabsRef,
      activeTabPathRef,
      setTabs,
      setActiveTabPath,
      onMissingNotePath,
    }))
  }, [executeNavigationWithBoundary, onMissingNotePath])

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
