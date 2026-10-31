import { startTransition, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { createVaultBackend } from '../lib/vaultBackend'
import { autoRenameRemoteNote, hasRemoteVault } from '../lib/remoteNotes'
import { onLiveNoteTitle } from '../lib/liveNoteTitle'
import { useEditorSaveWithLinks } from './useEditorSaveWithLinks'
import { attachmentCleanup, vaultRootForNote } from './attachmentCleanup'
import { flushEditorContent } from '../utils/autoSave'
import { extractH1TitleFromContent } from '../utils/noteTitle'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { canWritePathToVault } from '../utils/vaultPathContainment'
import { vaultPathForEntry } from '../utils/workspaces'
import { notePathFilename, notePathsMatch } from '../utils/notePathIdentity'

interface TabState {
  entry: VaultEntry
  content: string
}

const UNTITLED_RENAME_DEBOUNCE_MS = 2500

interface PendingUntitledRename {
  path: string
  title: string
  timer: ReturnType<typeof setTimeout>
}

type RenamedPathMap = Map<string, string>
type InFlightRenameMap = Map<string, Promise<string>>

function findRenamedPath(renamedPaths: RenamedPathMap, path: string): string | undefined {
  for (const [oldPath, newPath] of renamedPaths) {
    if (notePathsMatch(oldPath, path)) return newPath
  }
  return undefined
}

function resolveLatestPath(renamedPaths: RenamedPathMap, path: string): string {
  let current = path
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const next = findRenamedPath(renamedPaths, current)
    if (!next || next === current) break
    current = next
  }

  return current
}

function trackRenamedPath(renamedPaths: RenamedPathMap, oldPath: string, newPath: string): void {
  if (notePathsMatch(oldPath, newPath)) return
  const latestPath = resolveLatestPath(renamedPaths, newPath)
  for (const [trackedOldPath, trackedNewPath] of renamedPaths) {
    if (notePathsMatch(trackedNewPath, oldPath)) renamedPaths.set(trackedOldPath, latestPath)
  }
  for (const trackedOldPath of renamedPaths.keys()) {
    if (notePathsMatch(trackedOldPath, oldPath)) {
      renamedPaths.set(trackedOldPath, latestPath)
      return
    }
  }
  renamedPaths.set(oldPath, latestPath)
}

function vaultPathForTabPath(tabs: TabState[], path: string, fallbackVaultPath: string): string {
  const tab = tabs.find((candidate) => notePathsMatch(candidate.entry.path, path))
  return tab ? vaultPathForEntry(tab.entry, fallbackVaultPath) : fallbackVaultPath
}

async function waitForSettledPath({
  path,
  renamedPaths,
  inFlightRenames,
}: {
  path: string
  renamedPaths: RenamedPathMap
  inFlightRenames: InFlightRenameMap
}): Promise<string> {
  let current = resolveLatestPath(renamedPaths, path)
  const visited = new Set<string>()

  while (!visited.has(current)) {
    visited.add(current)
    const inFlightRename = inFlightRenames.get(current)
    if (!inFlightRename) return resolveLatestPath(renamedPaths, current)
    current = resolveLatestPath(renamedPaths, await inFlightRename)
  }

  return current
}

function findUnsavedFallback({
  tabs,
  activeTabPath,
  unsavedPaths,
}: {
  tabs: TabState[]
  activeTabPath: string | null
  unsavedPaths: Set<string>
}): { path: string; content: string } | undefined {
  const activeTab = tabs.find((t) => t.entry.path === activeTabPath)
  if (!activeTab || !unsavedPaths.has(activeTab.entry.path)) return undefined
  return { path: activeTab.entry.path, content: activeTab.content }
}

function isUntitledRenameCandidate(path: string): boolean {
  const filename = notePathFilename(path)
  const stem = filename.replace(/\.md$/, '')
  return stem.startsWith('untitled-') && /\d+$/.test(stem)
}

function canAutoRenameUntitled(path: string, initialH1AutoRenameEnabled: boolean): boolean {
  const hasVaultFiles = isTauri() || hasRemoteVault()
  return hasVaultFiles && initialH1AutoRenameEnabled && isUntitledRenameCandidate(path)
}

interface AutoRenamedNote {
  newPath: string
  /** The renamed entry when the backend already knows it, instead of reloading it. */
  entry?: Partial<VaultEntry> & { path: string }
}

/** Renames an untitled note after its first H1. Null when the note keeps its name. */
async function renameUntitledNote(options: { vaultPath: string; path: string; title: string }): Promise<AutoRenamedNote | null> {
  const { vaultPath, path, title } = options
  if (hasRemoteVault()) return autoRenameRemoteNote(path, title)
  const result = await invoke<{
    new_path: string
    updated_files: number
  } | null>('auto_rename_untitled', {
    args: { vaultPath, notePath: path },
  })
  return result ? { newPath: result.new_path } : null
}

function matchingPendingRename({
  pending,
  path,
}: {
  pending: PendingUntitledRename | null
  path?: string
}): PendingUntitledRename | null {
  if (!pending) return null
  if (path && pending.path !== path) return null
  return pending
}

function takePendingRename({
  pendingRenameRef,
  path,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  path?: string
}): PendingUntitledRename | null {
  const pending = matchingPendingRename({
    pending: pendingRenameRef.current,
    path,
  })
  if (!pending) return null
  clearTimeout(pending.timer)
  pendingRenameRef.current = null
  return pending
}

function schedulePendingRename({
  pendingRenameRef,
  path,
  title,
  onFire,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  path: string
  title: string
  onFire: (path: string, title: string) => void
}): void {
  const currentPending = pendingRenameRef.current
  if (currentPending?.path === path && currentPending.title === title) return
  takePendingRename({ pendingRenameRef })
  const timer = setTimeout(() => {
    const pending = takePendingRename({ pendingRenameRef, path })
    if (pending) onFire(pending.path, pending.title)
  }, UNTITLED_RENAME_DEBOUNCE_MS)
  pendingRenameRef.current = { path, title, timer }
}

function pendingRenameOutsideActiveTab({
  pendingRenameRef,
  activeTabPath,
}: {
  pendingRenameRef: MutableRefObject<PendingUntitledRename | null>
  activeTabPath: string | null
}): string | null {
  const pending = pendingRenameRef.current
  if (!pending || pending.path === activeTabPath) return null
  return pending.path
}

async function reloadAutoRenamedNote(options: {
    oldPath: string
    newPath: string
    renamedEntry?: Partial<VaultEntry> & { path: string }
    vaultPath: string
    tabsRef: MutableRefObject<TabState[]>
    activeTabPathRef: MutableRefObject<string | null>
    setTabs: AppSaveDeps['setTabs']
    handleSwitchTab: AppSaveDeps['handleSwitchTab']
    replaceEntry: AppSaveDeps['replaceEntry']
    loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
}): Promise<void> {
  const { oldPath, newPath, renamedEntry, vaultPath, tabsRef, activeTabPathRef, setTabs, handleSwitchTab, replaceEntry, loadModifiedFiles } = options
  const backend = createVaultBackend(vaultPath)
  const newEntry = renamedEntry ?? (await backend.files.reloadEntry(newPath))
  const preservedContent =
    tabsRef.current.find((tab) => tab.entry.path === oldPath)?.content ??
    (await backend.files.read(newPath)).content

  const otherTabPaths = tabsRef.current
    .filter((tab) => tab.entry.path !== oldPath && tab.entry.path !== newPath)
    .map((tab) => tab.entry.path)

  startTransition(() => {
    setTabs((prev: TabState[]) =>
      prev.map((tab) =>
      tab.entry.path === oldPath
          ? {
              entry: { ...tab.entry, ...newEntry, path: newPath },
              content: preservedContent,
            }
          : tab,
      ),
    )
    if (activeTabPathRef.current === oldPath) handleSwitchTab(newPath)
    replaceEntry(oldPath, { ...newEntry, path: newPath }, preservedContent)
  })

  void Promise.all(
    otherTabPaths.map(async (path) => {
      const { content } = await backend.files.read(path)
    startTransition(() => {
        setTabs((prev: TabState[]) => prev.map((tab) => (tab.entry.path === path ? { ...tab, content } : tab)))
    })
    }),
  ).finally(() => {
    startTransition(() => {
      loadModifiedFiles()
    })
  })
}

function useCurrentValueRef<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useRenamePathRegistry() {
  const renamedPathsRef = useRef<RenamedPathMap>(new Map())
  const inFlightUntitledRenameRef = useRef<InFlightRenameMap>(new Map())

  const registerRenamedPath = useCallback((oldPath: string, newPath: string) => {
    trackRenamedPath(renamedPathsRef.current, oldPath, newPath)
  }, [])

  const resolveCurrentPath = useCallback((path: string) => resolveLatestPath(renamedPathsRef.current, path), [])
  const resolvePathBeforeSave = useCallback(
    (path: string) =>
      waitForSettledPath({
      path,
      renamedPaths: renamedPathsRef.current,
      inFlightRenames: inFlightUntitledRenameRef.current,
    }),
    [],
  )

  return {
    renamedPathsRef,
    inFlightUntitledRenameRef,
    registerRenamedPath,
    resolveCurrentPath,
    resolvePathBeforeSave,
  }
}

function useUntitledRenameExecutor(options: {
  resolvedPath: string
  tabsRef: MutableRefObject<TabState[]>
  activeTabPathRef: MutableRefObject<string | null>
  setTabs: AppSaveDeps['setTabs']
  handleSwitchTab: AppSaveDeps['handleSwitchTab']
  replaceEntry: AppSaveDeps['replaceEntry']
  loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
  onInternalVaultWrite?: AppSaveDeps['onInternalVaultWrite']
  renamedPathsRef: MutableRefObject<RenamedPathMap>
  inFlightUntitledRenameRef: MutableRefObject<InFlightRenameMap>
}) {
  const { resolvedPath, tabsRef, activeTabPathRef, setTabs, handleSwitchTab, replaceEntry, loadModifiedFiles, onInternalVaultWrite, renamedPathsRef, inFlightUntitledRenameRef } = options
  return useCallback(
    async (path: string, title: string) => {
    const existingRename = inFlightUntitledRenameRef.current.get(path)
    if (existingRename) return (await existingRename) !== path

    const renamePromise = (async () => {
      try {
        const renameVaultPath = vaultPathForTabPath(tabsRef.current, path, resolvedPath)
        const result = await renameUntitledNote({ vaultPath: renameVaultPath, path, title })
        if (!result) return path
        onInternalVaultWrite?.(path)
        onInternalVaultWrite?.(result.newPath)
        trackRenamedPath(renamedPathsRef.current, path, result.newPath)
        await reloadAutoRenamedNote({
          oldPath: path,
          newPath: result.newPath,
          renamedEntry: result.entry,
          vaultPath: renameVaultPath,
          tabsRef,
          activeTabPathRef,
          setTabs,
          handleSwitchTab,
          replaceEntry,
          loadModifiedFiles,
        })
        return result.newPath
      } catch {
        return path
      } finally {
        inFlightUntitledRenameRef.current.delete(path)
      }
    })()

    inFlightUntitledRenameRef.current.set(path, renamePromise)
    return (await renamePromise) !== path
    },
    [
    resolvedPath,
    tabsRef,
    activeTabPathRef,
    setTabs,
    handleSwitchTab,
    replaceEntry,
    loadModifiedFiles,
    onInternalVaultWrite,
    renamedPathsRef,
    inFlightUntitledRenameRef,
    ],
  )
}

function useUntitledRenameScheduler({
  executeUntitledRename,
  initialH1AutoRenameEnabled,
}: {
  executeUntitledRename: (path: string, title: string) => Promise<boolean>
  initialH1AutoRenameEnabled: boolean
}) {
  const pendingUntitledRenameRef = useRef<PendingUntitledRename | null>(null)

  const cancelPendingUntitledRename = useCallback(
    (path?: string) =>
      takePendingRename({
        pendingRenameRef: pendingUntitledRenameRef,
        path,
      }) !== null,
    [],
  )

  const flushPendingUntitledRename = useCallback(
    async (path?: string) => {
      const pending = takePendingRename({
        pendingRenameRef: pendingUntitledRenameRef,
        path,
      })
    if (!pending) return false
    return executeUntitledRename(pending.path, pending.title)
    },
    [executeUntitledRename],
  )

  const scheduleUntitledRenameTitle = useCallback(
    (path: string, title: string | null) => {
    if (!title || !canAutoRenameUntitled(path, initialH1AutoRenameEnabled)) {
      cancelPendingUntitledRename(path)
      return
    }

    schedulePendingRename({
      pendingRenameRef: pendingUntitledRenameRef,
      path,
      title,
      onFire: (pendingPath, pendingTitle) => {
        void executeUntitledRename(pendingPath, pendingTitle)
      },
    })
    },
    [cancelPendingUntitledRename, executeUntitledRename, initialH1AutoRenameEnabled],
  )

  const scheduleUntitledRename = useCallback(
    (path: string, content: string) => scheduleUntitledRenameTitle(path, extractH1TitleFromContent(content)),
    [scheduleUntitledRenameTitle],
  )

  const refreshPendingUntitledRename = useCallback(
    (path: string, content: string) => {
      if (
        !matchingPendingRename({
          pending: pendingUntitledRenameRef.current,
          path,
        })
      )
        return
    scheduleUntitledRename(path, content)
    },
    [scheduleUntitledRename],
  )

  return { pendingUntitledRenameRef, cancelPendingUntitledRename, flushPendingUntitledRename, refreshPendingUntitledRename, scheduleUntitledRename, scheduleUntitledRenameTitle }
}

function useUntitledRenameCoordinator(options: {
  resolvedPath: string
  tabsRef: MutableRefObject<TabState[]>
  activeTabPathRef: MutableRefObject<string | null>
  setTabs: AppSaveDeps['setTabs']
  handleSwitchTab: AppSaveDeps['handleSwitchTab']
  replaceEntry: AppSaveDeps['replaceEntry']
  loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
  onInternalVaultWrite?: AppSaveDeps['onInternalVaultWrite']
  initialH1AutoRenameEnabled: boolean
}) {
  const { resolvedPath, tabsRef, activeTabPathRef, setTabs, handleSwitchTab, replaceEntry, loadModifiedFiles, onInternalVaultWrite, initialH1AutoRenameEnabled } = options
  const { renamedPathsRef, inFlightUntitledRenameRef, registerRenamedPath, resolveCurrentPath, resolvePathBeforeSave } =
    useRenamePathRegistry()
  const executeUntitledRename = useUntitledRenameExecutor({
    resolvedPath,
    tabsRef,
    activeTabPathRef,
    setTabs,
    handleSwitchTab,
    replaceEntry,
    loadModifiedFiles,
    onInternalVaultWrite,
    renamedPathsRef,
    inFlightUntitledRenameRef,
  })
  const {
        pendingUntitledRenameRef,
        cancelPendingUntitledRename,
        flushPendingUntitledRename,
        refreshPendingUntitledRename,
        scheduleUntitledRename,
        scheduleUntitledRenameTitle,
      } = useUntitledRenameScheduler({
        executeUntitledRename,
        initialH1AutoRenameEnabled,
      })
      useLiveTitleRename(scheduleUntitledRenameTitle, resolveCurrentPath)

      return {
        pendingUntitledRenameRef,
        cancelPendingUntitledRename,
        registerRenamedPath,
        resolveCurrentPath,
        resolvePathBeforeSave,
        flushPendingUntitledRename,
        refreshPendingUntitledRename,
        scheduleUntitledRename,
      }
    }

    interface AppSaveDeps {
      updateEntry: (path: string, patch: Partial<VaultEntry>) => void
      setTabs: Parameters<typeof useEditorSaveWithLinks>[0]['setTabs']
      handleSwitchTab: (path: string) => void
      setToastMessage: (msg: string | null) => void
      loadModifiedFiles: () => void
      reloadViews?: () => Promise<void>
      trackUnsaved?: (path: string) => void
      clearUnsaved: (path: string) => void
      unsavedPaths: Set<string>
      tabs: TabState[]
      activeTabPath: string | null
      handleRenameNote: (
        path: string,
        newTitle: string,
        vaultPath: string,
        onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
      ) => Promise<void>
      handleRenameFilename: (
        path: string,
        newFilenameStem: string,
        vaultPath: string,
        onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
      ) => Promise<void>
      replaceEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
      resolvedPath: string
      writableVaultPaths?: readonly string[]
      initialH1AutoRenameEnabled: boolean
      onInternalVaultWrite?: (path: string) => void
      locale?: AppLocale
    }

    interface EditorPersistenceOptions {
      updateEntry: AppSaveDeps['updateEntry']
      setTabs: AppSaveDeps['setTabs']
      setToastMessage: AppSaveDeps['setToastMessage']
      loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
      trackUnsaved?: AppSaveDeps['trackUnsaved']
      clearUnsaved: AppSaveDeps['clearUnsaved']
      onInternalVaultWrite?: AppSaveDeps['onInternalVaultWrite']
      reloadViews: AppSaveDeps['reloadViews']
      refreshPendingUntitledRename: (path: string, content: string) => void
      scheduleUntitledRename: (path: string, content: string) => void
      resolveCurrentPath: (path: string) => string
      resolvePathBeforeSave: (path: string) => Promise<string>
      canPersist: boolean
      persistenceScope: string | readonly string[]
      locale: AppLocale
    }

    function useAppSaveStateRefs({
      tabs,
      activeTabPath,
      unsavedPaths,
    }: Pick<AppSaveDeps, 'tabs' | 'activeTabPath' | 'unsavedPaths'>) {
      return {
        tabsRef: useCurrentValueRef(tabs),
        activeTabPathRef: useCurrentValueRef(activeTabPath),
        unsavedPathsRef: useCurrentValueRef(unsavedPaths),
      }
    }

    function useAppSaveEffects({
      contentChangeRef,
      handleContentChange,
      cancelPendingUntitledRename,
      pendingUntitledRenameRef,
      activeTabPath,
    }: {
      contentChangeRef: MutableRefObject<(path: string, content: string) => void>
      handleContentChange: (path: string, content: string) => void
      cancelPendingUntitledRename: (path?: string) => boolean
      pendingUntitledRenameRef: MutableRefObject<PendingUntitledRename | null>
      activeTabPath: string | null
    }) {
      useEffect(() => {
        contentChangeRef.current = handleContentChange
      }, [contentChangeRef, handleContentChange])
      useEffect(
        () => () => {
          cancelPendingUntitledRename()
        },
        [cancelPendingUntitledRename],
      )
      useEffect(() => {
        const pendingPath = pendingRenameOutsideActiveTab({
          pendingRenameRef: pendingUntitledRenameRef,
          activeTabPath,
        })
        if (pendingPath) cancelPendingUntitledRename(pendingPath)
      }, [activeTabPath, cancelPendingUntitledRename, pendingUntitledRenameRef])
    }

    function useFlushBeforeAction(options: {
      canPersist: boolean
      resolveCurrentPath: (path: string) => string
      savePendingForPath: (path: string) => Promise<boolean>
      tabsRef: MutableRefObject<TabState[]>
      unsavedPathsRef: MutableRefObject<Set<string>>
      clearUnsaved: AppSaveDeps['clearUnsaved']
      setToastMessage: AppSaveDeps['setToastMessage']
      flushPendingUntitledRename: (path?: string) => Promise<boolean>
      locale: AppLocale
    }) {
      const { canPersist, resolveCurrentPath, savePendingForPath, tabsRef, unsavedPathsRef, clearUnsaved, setToastMessage, flushPendingUntitledRename, locale } = options
  const t = useMemo(() => createTranslator(locale), [locale])

  return useCallback(
    async (path: string) => {
    const currentPath = resolveCurrentPath(path)
    if (!canPersist) {
      if (unsavedPathsRef.current.has(currentPath)) setToastMessage(t('save.toast.missingActiveVault'))
      return
    }
    try {
      await flushEditorContent(currentPath, {
        savePendingForPath,
          getTabContent: (p) => tabsRef.current.find((t) => t.entry.path === p)?.content,
        isUnsaved: (p) => unsavedPathsRef.current.has(p),
          onSaved: (p) => {
            clearUnsaved(p)
          },
      })
      await flushPendingUntitledRename(currentPath)
    } catch (err) {
      setToastMessage(t('save.error.autoFailed', { error: String(err) }))
      throw err
    }
    },
    [
      canPersist,
      resolveCurrentPath,
      savePendingForPath,
      tabsRef,
      unsavedPathsRef,
      clearUnsaved,
      setToastMessage,
      flushPendingUntitledRename,
      t,
    ],
  )
}

async function preparePathForManualRename({
  path,
  resolveCurrentPath,
  resolvePathBeforeSave,
  savePendingForPath,
  cancelPendingUntitledRename,
}: {
  path: string
  resolveCurrentPath: (path: string) => string
  resolvePathBeforeSave: (path: string) => Promise<string>
  savePendingForPath: (path: string) => Promise<boolean>
  cancelPendingUntitledRename: (path?: string) => boolean
}): Promise<string> {
  const currentPath = resolveCurrentPath(path)
  cancelPendingUntitledRename(currentPath)
  await savePendingForPath(currentPath)
  const settledPath = await resolvePathBeforeSave(currentPath)
  cancelPendingUntitledRename(currentPath)
  cancelPendingUntitledRename(settledPath)
  return settledPath
}

function useRenameHandlers(options: {
  resolveCurrentPath: (path: string) => string
  resolvePathBeforeSave: (path: string) => Promise<string>
  savePendingForPath: (path: string) => Promise<boolean>
  cancelPendingUntitledRename: (path?: string) => boolean
  handleRenameNote: AppSaveDeps['handleRenameNote']
  handleRenameFilename: AppSaveDeps['handleRenameFilename']
  resolvedPath: string
  tabsRef: MutableRefObject<TabState[]>
  replaceRenamedEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
  loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
}) {
  const { resolveCurrentPath, resolvePathBeforeSave, savePendingForPath, cancelPendingUntitledRename, handleRenameNote, handleRenameFilename, resolvedPath, tabsRef, replaceRenamedEntry, loadModifiedFiles } = options
  const handleFilenameRename = useCallback(
    async (path: string, newFilenameStem: string) => {
    const currentPath = await preparePathForManualRename({
      path,
      resolveCurrentPath,
      resolvePathBeforeSave,
      savePendingForPath,
      cancelPendingUntitledRename,
    })
    const renameVaultPath = vaultPathForTabPath(tabsRef.current, currentPath, resolvedPath)
      await handleRenameFilename(currentPath, newFilenameStem, renameVaultPath, replaceRenamedEntry).then(
        loadModifiedFiles,
      )
    },
    [
      resolveCurrentPath,
      resolvePathBeforeSave,
      savePendingForPath,
      cancelPendingUntitledRename,
      tabsRef,
      resolvedPath,
      handleRenameFilename,
      replaceRenamedEntry,
      loadModifiedFiles,
    ],
  )

  const handleTitleSync = useCallback(
    (path: string, newTitle: string) => {
    void preparePathForManualRename({
      path,
      resolveCurrentPath,
      resolvePathBeforeSave,
      savePendingForPath,
      cancelPendingUntitledRename,
    })
      .then((currentPath) => {
        const renameVaultPath = vaultPathForTabPath(tabsRef.current, currentPath, resolvedPath)
        return handleRenameNote(currentPath, newTitle, renameVaultPath, replaceRenamedEntry)
      })
      .then(loadModifiedFiles)
      .catch((err) => console.error('Title rename failed:', err))
    },
    [
      resolveCurrentPath,
      resolvePathBeforeSave,
      savePendingForPath,
      cancelPendingUntitledRename,
      tabsRef,
      resolvedPath,
      handleRenameNote,
      replaceRenamedEntry,
      loadModifiedFiles,
    ],
  )

  return { handleFilenameRename, handleTitleSync }
}

function useHandleSaveAction({
  handleSaveRaw,
  tabs,
  activeTabPath,
  unsavedPaths,
  flushPendingUntitledRename,
  resolveCurrentPath,
}: {
  handleSaveRaw: (unsavedFallback?: { path: string; content: string }) => Promise<boolean>
  tabs: TabState[]
  activeTabPath: string | null
  unsavedPaths: Set<string>
  flushPendingUntitledRename: (path?: string) => Promise<boolean>
  resolveCurrentPath: (path: string) => string
}) {
  return useCallback(async () => {
    const resolvedActiveTabPath = activeTabPath ? resolveCurrentPath(activeTabPath) : null
    const saveCompleted = await handleSaveRaw(
      findUnsavedFallback({
      tabs,
      activeTabPath: resolvedActiveTabPath,
      unsavedPaths,
      }),
    )
    if (!saveCompleted) return false
    await flushPendingUntitledRename(resolvedActiveTabPath ?? undefined)
    return true
  }, [handleSaveRaw, tabs, activeTabPath, unsavedPaths, flushPendingUntitledRename, resolveCurrentPath])
}

function useEditorPersistence(options: EditorPersistenceOptions) {
  const { updateEntry, setTabs, setToastMessage, loadModifiedFiles, trackUnsaved, clearUnsaved, onInternalVaultWrite, reloadViews, refreshPendingUntitledRename, scheduleUntitledRename, resolveCurrentPath, resolvePathBeforeSave, canPersist, persistenceScope, locale } = options
  const onAfterSave = useCallback(() => {
    loadModifiedFiles()
  }, [loadModifiedFiles])

  const onBeforePersist = useCallback(
    (path: string) => {
    attachmentCleanup.rememberBeforePersist(path)
    onInternalVaultWrite?.(path)
    },
    [onInternalVaultWrite],
  )

  const onNotePersisted = useCallback(
    (path: string, content: string) => {
    onInternalVaultWrite?.(path)
    clearUnsaved(path)
    if (path.endsWith('.yml')) reloadViews?.()
    scheduleUntitledRename(path, content)
    const vaultPath = vaultRootForNote(path, persistenceScope)
    if (vaultPath) attachmentCleanup.handlePersisted({ path, content, vaultPath })
    },
    [clearUnsaved, onInternalVaultWrite, persistenceScope, reloadViews, scheduleUntitledRename],
  )

  const {
        handleSave: handleSaveRaw,
        handleContentChange: handleContentChangeRaw,
        savePendingForPath: savePendingForPathRaw,
        savePending,
      } = useEditorSaveWithLinks({
        updateEntry,
        setTabs,
        setToastMessage,
        onAfterSave,
        onBeforePersist,
        onNotePersisted,
        resolvePath: resolveCurrentPath,
        resolvePathBeforeSave,
        canPersist,
        persistenceScope,
        locale,
      })

      const handleContentChange = useCallback(
        (path: string, content: string) => {
        const currentPath = resolveCurrentPath(path)
        if (!canWritePathToVault(currentPath, persistenceScope)) return
        refreshPendingUntitledRename(currentPath, content)
        trackUnsaved?.(currentPath)
        handleContentChangeRaw(currentPath, content)
        const vaultPath = vaultRootForNote(currentPath, persistenceScope)
        if (vaultPath) attachmentCleanup.handleContentChanged({ path: currentPath, content, vaultPath })
        },
        [handleContentChangeRaw, persistenceScope, refreshPendingUntitledRename, resolveCurrentPath, trackUnsaved],
      )

      const savePendingForPath = useCallback(
        (path: string) => {
        const currentPath = resolveCurrentPath(path)
        return canWritePathToVault(currentPath, persistenceScope)
          ? savePendingForPathRaw(currentPath)
          : Promise.resolve(false)
        },
        [savePendingForPathRaw, persistenceScope, resolveCurrentPath],
      )

      return {
        handleSaveRaw,
        handleContentChange,
        savePendingForPath,
        savePending,
      }
    }

    function useReplaceRenamedEntry({
      registerRenamedPath,
      replaceEntry,
    }: {
      registerRenamedPath: (oldPath: string, newPath: string) => void
      replaceEntry: AppSaveDeps['replaceEntry']
    }) {
      return useCallback(
        (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => {
        registerRenamedPath(oldPath, newEntry.path)
        replaceEntry(oldPath, newEntry, newContent)
        },
        [registerRenamedPath, replaceEntry],
      )
    }

    function useAppSaveHandlers(options: {
      contentChangeRef: MutableRefObject<(path: string, content: string) => void>
      handleContentChange: (path: string, content: string) => void
      canPersist: boolean
      cancelPendingUntitledRename: (path?: string) => boolean
      pendingUntitledRenameRef: MutableRefObject<PendingUntitledRename | null>
      activeTabPath: string | null
      resolveCurrentPath: (path: string) => string
      resolvePathBeforeSave: (path: string) => Promise<string>
      savePendingForPath: (path: string) => Promise<boolean>
      tabsRef: MutableRefObject<TabState[]>
      unsavedPathsRef: MutableRefObject<Set<string>>
      clearUnsaved: AppSaveDeps['clearUnsaved']
      setToastMessage: AppSaveDeps['setToastMessage']
      flushPendingUntitledRename: (path?: string) => Promise<boolean>
      locale: AppLocale
      handleRenameNote: AppSaveDeps['handleRenameNote']
      handleRenameFilename: AppSaveDeps['handleRenameFilename']
      resolvedPath: string
      replaceRenamedEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
      loadModifiedFiles: AppSaveDeps['loadModifiedFiles']
      handleSaveRaw: (unsavedFallback?: { path: string; content: string }) => Promise<boolean>
      tabs: TabState[]
      unsavedPaths: Set<string>
    }) {
      const { contentChangeRef, handleContentChange, canPersist, cancelPendingUntitledRename, pendingUntitledRenameRef, activeTabPath, resolveCurrentPath, resolvePathBeforeSave, savePendingForPath, tabsRef, unsavedPathsRef, clearUnsaved, setToastMessage, flushPendingUntitledRename, locale, handleRenameNote, handleRenameFilename, resolvedPath, replaceRenamedEntry, loadModifiedFiles, handleSaveRaw, tabs, unsavedPaths } = options
  useAppSaveEffects({
    contentChangeRef,
    handleContentChange,
    cancelPendingUntitledRename,
    pendingUntitledRenameRef,
    activeTabPath,
  })

  const flushBeforeAction = useFlushBeforeAction({
    canPersist,
    resolveCurrentPath,
    savePendingForPath,
    tabsRef,
    unsavedPathsRef,
    clearUnsaved,
    setToastMessage,
    flushPendingUntitledRename,
    locale,
  })
  const { handleFilenameRename, handleTitleSync } = useRenameHandlers({
    resolveCurrentPath,
    resolvePathBeforeSave,
    savePendingForPath,
    cancelPendingUntitledRename,
    handleRenameNote,
    handleRenameFilename,
    resolvedPath,
    tabsRef,
    replaceRenamedEntry,
    loadModifiedFiles,
  })
  const handleSave = useHandleSaveAction({
    handleSaveRaw,
    tabs,
    activeTabPath,
    unsavedPaths,
    flushPendingUntitledRename,
    resolveCurrentPath,
  })

  return {
    handleFilenameRename,
    handleSave,
    handleTitleSync,
    flushBeforeAction,
  }
}

function useAppSaveServices(
  options: AppSaveDeps,
  refs: ReturnType<typeof useAppSaveStateRefs>,
  canPersist: boolean,
) {
  const { updateEntry, setTabs, handleSwitchTab, setToastMessage, loadModifiedFiles, reloadViews, trackUnsaved, clearUnsaved, replaceEntry, resolvedPath, writableVaultPaths, initialH1AutoRenameEnabled, onInternalVaultWrite, locale = 'en' } = options
  const { tabsRef, activeTabPathRef } = refs
  const {
    pendingUntitledRenameRef,
    cancelPendingUntitledRename,
    registerRenamedPath,
    resolveCurrentPath,
    resolvePathBeforeSave,
    flushPendingUntitledRename,
    refreshPendingUntitledRename,
    scheduleUntitledRename,
  } = useUntitledRenameCoordinator({
    resolvedPath,
    tabsRef,
    activeTabPathRef,
    setTabs,
    handleSwitchTab,
    replaceEntry,
    loadModifiedFiles,
    onInternalVaultWrite,
    initialH1AutoRenameEnabled,
  })
  const { handleSaveRaw, handleContentChange, savePendingForPath, savePending } = useEditorPersistence({
    updateEntry,
    setTabs,
    setToastMessage,
    loadModifiedFiles,
    trackUnsaved,
    clearUnsaved,
    onInternalVaultWrite,
    reloadViews,
    refreshPendingUntitledRename,
    scheduleUntitledRename,
    resolveCurrentPath,
    resolvePathBeforeSave,
    canPersist,
    persistenceScope: writableVaultPaths && writableVaultPaths.length > 0 ? writableVaultPaths : resolvedPath,
    locale,
  })
  const replaceRenamedEntry = useReplaceRenamedEntry({
    registerRenamedPath,
    replaceEntry,
  })
  return { pendingUntitledRenameRef, cancelPendingUntitledRename, registerRenamedPath, resolveCurrentPath, resolvePathBeforeSave, flushPendingUntitledRename, handleSaveRaw, handleContentChange, savePendingForPath, savePending, replaceRenamedEntry }
}

/**
 * A note edited as a live document is saved by the document, not through
 * handleContentChange, so its untitled rename is scheduled from the title the editor reports.
 */
function useLiveTitleRename(
  scheduleUntitledRenameTitle: (path: string, title: string | null) => void,
  resolveCurrentPath: (path: string) => string,
) {
  useEffect(
    () => onLiveNoteTitle((path, title) => scheduleUntitledRenameTitle(resolveCurrentPath(path), title)),
    [scheduleUntitledRenameTitle, resolveCurrentPath],
  )
}

export function useAppSave(options: AppSaveDeps) {
  const { setToastMessage, loadModifiedFiles, clearUnsaved, unsavedPaths, tabs, activeTabPath, handleRenameNote, handleRenameFilename: handleRenameFilenameRaw, resolvedPath, locale = 'en' } = options
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})
  const canPersist = resolvedPath.trim().length > 0
  const refs = useAppSaveStateRefs({ tabs, activeTabPath, unsavedPaths })
  const { tabsRef, unsavedPathsRef } = refs
  const { pendingUntitledRenameRef, cancelPendingUntitledRename, registerRenamedPath, resolveCurrentPath, resolvePathBeforeSave, flushPendingUntitledRename, handleSaveRaw, handleContentChange, savePendingForPath, savePending, replaceRenamedEntry } = useAppSaveServices(options, refs, canPersist)
  const { handleFilenameRename, handleSave, handleTitleSync, flushBeforeAction } = useAppSaveHandlers({
    contentChangeRef,
    handleContentChange,
    canPersist,
    cancelPendingUntitledRename,
    pendingUntitledRenameRef,
    activeTabPath,
    resolveCurrentPath,
    savePendingForPath,
    tabsRef,
    unsavedPathsRef,
    clearUnsaved,
    setToastMessage,
    flushPendingUntitledRename,
    locale,
    handleRenameNote,
    handleRenameFilename: handleRenameFilenameRaw,
    resolvedPath,
    resolvePathBeforeSave,
    replaceRenamedEntry,
    loadModifiedFiles,
    handleSaveRaw,
    tabs,
    unsavedPaths,
  })

  return {
    contentChangeRef,
    handleContentChange,
    handleFilenameRename,
    handleSave,
    handleTitleSync,
    savePending,
    savePendingForPath,
    trackRenamedPath: registerRenamedPath,
    flushBeforeAction,
  }
}
