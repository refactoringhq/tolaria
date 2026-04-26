import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry, FolderNode, GitCommit, ModifiedFile, NoteStatus, GitPushResult, ViewFile } from '../types'
import { clearPrefetchCache } from './useTabManagement'

function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

function hasVaultPath(vaultPath: string): boolean {
  return vaultPath.trim().length > 0
}

function loadVaultEntries(vaultPath: string): Promise<VaultEntry[]> {
  const command = isTauri() ? 'reload_vault' : 'list_vault'
  return tauriCall<VaultEntry[]>(command, { path: vaultPath })
}

async function loadVaultData(vaultPath: string) {
  if (!isTauri()) console.info('[mock] Using mock Tauri data for browser testing')
  const entries = await loadVaultEntries(vaultPath)
  console.log(`Vault scan complete: ${entries.length} entries found`)
  return { entries }
}

function loadVaultFolders(vaultPath: string): Promise<FolderNode[]> {
  return tauriCall<FolderNode[]>('list_vault_folders', { path: vaultPath })
}

function loadVaultViews(vaultPath: string): Promise<ViewFile[]> {
  return tauriCall<ViewFile[]>('list_views', { vaultPath })
}

function resetVaultState(options: {
  clearNewPaths: () => void
  clearUnsaved: () => void
  setEntries: (entries: VaultEntry[]) => void
  setFolders: (folders: FolderNode[]) => void
  setModifiedFiles: (files: ModifiedFile[]) => void
  setModifiedFilesError: (message: string | null) => void
  setViews: (views: ViewFile[]) => void
}) {
  options.setEntries([])
  options.setFolders([])
  options.setViews([])
  options.setModifiedFiles([])
  options.setModifiedFilesError(null)
  options.clearNewPaths()
  options.clearUnsaved()
}

function useCurrentVaultPathGuard(vaultPath: string) {
  const currentPathRef = useRef(vaultPath)

  useEffect(() => {
    currentPathRef.current = vaultPath
  }, [vaultPath])

  return useCallback((path: string) => currentPathRef.current === path, [])
}

async function commitWithPush(vaultPath: string, message: string): Promise<GitPushResult> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { message })
    return mockInvoke<GitPushResult>('git_push', {})
  }
  await invoke<string>('git_commit', { vaultPath, message })
  return invoke<GitPushResult>('git_push', { vaultPath })
}

function useNewNoteTracker() {
  const [newPaths, setNewPaths] = useState<Set<string>>(new Set())

  const trackNew = useCallback((path: string) => {
    setNewPaths((prev) => new Set(prev).add(path))
  }, [])

  const clear = useCallback(() => setNewPaths(new Set()), [])

  return { newPaths, trackNew, clear }
}

function useUnsavedTracker() {
  const [unsavedPaths, setUnsavedPaths] = useState<Set<string>>(new Set())

  const trackUnsaved = useCallback((path: string) => {
    setUnsavedPaths((prev) => new Set(prev).add(path))
  }, [])

  const clearUnsaved = useCallback((path: string) => {
    setUnsavedPaths((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setUnsavedPaths(new Set()), [])

  return { unsavedPaths, trackUnsaved, clearUnsaved, clearAll }
}

function usePendingSaveTracker() {
  const [pendingSavePaths, setPendingSavePaths] = useState<Set<string>>(new Set())

  const addPendingSave = useCallback((path: string) => {
    setPendingSavePaths((prev) => new Set(prev).add(path))
  }, [])

  const removePendingSave = useCallback((path: string) => {
    setPendingSavePaths((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  return { pendingSavePaths, addPendingSave, removePendingSave }
}

export function resolveNoteStatus(
  path: string, newPaths: Set<string>, modifiedFiles: ModifiedFile[], pendingSavePaths?: Set<string>, unsavedPaths?: Set<string>,
): NoteStatus {
  if (unsavedPaths?.has(path)) return 'unsaved'
  if (pendingSavePaths?.has(path)) return 'pendingSave'
  if (newPaths.has(path)) return 'new'
  const gitEntry = modifiedFiles.find((f) => f.path === path)
  if (!gitEntry) return 'clean'
  if (gitEntry.status === 'untracked' || gitEntry.status === 'added') return 'new'
  if (gitEntry.status === 'modified' || gitEntry.status === 'deleted') return 'modified'
  return 'clean'
}

export function useVaultLoader(vaultPath: string) {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [views, setViews] = useState<ViewFile[]>([])
  const [modifiedFiles, setModifiedFiles] = useState<ModifiedFile[]>([])
  const [modifiedFilesError, setModifiedFilesError] = useState<string | null>(null)
  const tracker = useNewNoteTracker()
  const pendingSave = usePendingSaveTracker()
  const unsaved = useUnsavedTracker()
  const isCurrentVaultPath = useCurrentVaultPathGuard(vaultPath)

  useEffect(() => {
    const path = vaultPath
    resetVaultState({
      clearNewPaths: tracker.clear,
      clearUnsaved: unsaved.clearAll,
      setEntries,
      setFolders,
      setModifiedFiles,
      setModifiedFilesError,
      setViews,
    })

    if (!hasVaultPath(path)) {
      return
    }

    loadVaultData(path)
      .then(({ entries: e }) => {
        if (!isCurrentVaultPath(path)) return
        setEntries(e)
      })
      .catch((err) => console.warn('Vault scan failed:', err))
    loadVaultFolders(path)
      .then((f) => {
        if (!isCurrentVaultPath(path)) return
        setFolders(f ?? [])
      })
      .catch(() => { /* folders are optional — ignore errors */ })
    loadVaultViews(path)
      .then((v) => {
        if (!isCurrentVaultPath(path)) return
        setViews(v ?? [])
      })
      .catch(() => { /* views are optional — ignore errors */ })
  }, [vaultPath, tracker.clear, unsaved.clearAll, isCurrentVaultPath])

  const loadModifiedFiles = useCallback(async () => {
    const path = vaultPath
    setModifiedFilesError(null)

    if (!hasVaultPath(path)) {
      setModifiedFiles([])
      return
    }

    try {
      const files = await tauriCall<ModifiedFile[]>('get_modified_files', { vaultPath: path }, {})
      if (!isCurrentVaultPath(path)) return
      setModifiedFiles(files)
    } catch (err) {
      if (!isCurrentVaultPath(path)) return
      const message = typeof err === 'string' ? err : 'Failed to load changes'
      console.warn('Failed to load modified files:', err)
      setModifiedFilesError(message)
      setModifiedFiles([])
    }
  }, [vaultPath, isCurrentVaultPath])

  useEffect(() => { loadModifiedFiles() }, [loadModifiedFiles]) // eslint-disable-line react-hooks/set-state-in-effect -- trigger initial load

  const addEntry = useCallback((entry: VaultEntry) => {
    setEntries((prev) => {
      if (prev.some(e => e.path === entry.path)) return prev
      return [entry, ...prev]
    })
    tracker.trackNew(entry.path)
  }, [tracker])

  const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) => {
    setEntries((prev) => {
      let changed = false
      const next = prev.map((e) => {
        if (e.path === path) { changed = true; return { ...e, ...patch } }
        return e
      })
      return changed ? next : prev
    })
  }, [])

  const removeEntry = useCallback((path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path))
  }, [])

  const removeEntries = useCallback((paths: string[]) => {
    if (paths.length === 0) return
    const pathSet = new Set(paths)
    setEntries((prev) => prev.filter((entry) => !pathSet.has(entry.path)))
  }, [])

  const replaceEntry = useCallback((oldPath: string, patch: Partial<VaultEntry> & { path: string }) => {
    setEntries((prev) => prev.map((e) => e.path === oldPath ? { ...e, ...patch } : e))
  }, [])

  const loadGitHistory = useCallback(async (path: string): Promise<GitCommit[]> => {
    try { return await tauriCall<GitCommit[]>('get_file_history', { vaultPath, path }, { path }) }
    catch (err) { console.warn('Failed to load git history:', err); return [] }
  }, [vaultPath])

  const loadDiffAtCommit = useCallback((path: string, commitHash: string): Promise<string> =>
    tauriCall<string>('get_file_diff_at_commit', { vaultPath, path, commitHash }, { path, commitHash }), [vaultPath])

  const loadDiff = useCallback((path: string): Promise<string> =>
    tauriCall<string>('get_file_diff', { vaultPath, path }, { path }), [vaultPath])

  const getNoteStatus = useCallback((path: string): NoteStatus =>
    resolveNoteStatus(path, tracker.newPaths, modifiedFiles, pendingSave.pendingSavePaths, unsaved.unsavedPaths), [tracker.newPaths, modifiedFiles, pendingSave.pendingSavePaths, unsaved.unsavedPaths])

  const commitAndPush = useCallback((message: string): Promise<GitPushResult> =>
    commitWithPush(vaultPath, message), [vaultPath])

  const reloadFolders = useCallback(
    () => {
      const path = vaultPath
      return loadVaultFolders(path)
        .then((f) => {
          if (!isCurrentVaultPath(path)) return [] as FolderNode[]
          const nextFolders = f ?? []
          setFolders(nextFolders)
          return nextFolders
        })
        .catch(() => [] as FolderNode[])
    },
    [vaultPath, isCurrentVaultPath],
  )

  const [isReloading, setIsReloading] = useState(false)

  const reloadVault = useCallback(
    () => {
      const path = vaultPath
      clearPrefetchCache()
      setIsReloading(true)
      return tauriCall<VaultEntry[]>('reload_vault', { path })
        .then((entries) => {
          if (!isCurrentVaultPath(path)) return [] as VaultEntry[]
          setEntries(entries)
          void loadModifiedFiles()
          return entries
        })
        .catch((err) => { console.warn('Vault reload failed:', err); return [] as VaultEntry[] })
        .finally(() => {
          if (isCurrentVaultPath(path)) setIsReloading(false)
        })
    },
    [vaultPath, loadModifiedFiles, isCurrentVaultPath],
  )

  const reloadViews = useCallback(async () => {
    const path = vaultPath
    try {
      const nextViews = await loadVaultViews(path)
      if (!isCurrentVaultPath(path)) return []
      const resolvedViews = nextViews ?? []
      setViews(resolvedViews)
      return resolvedViews
    } catch { /* views are optional */ }
    return []
  }, [vaultPath, isCurrentVaultPath])

  return {
    entries, folders, views, modifiedFiles, modifiedFilesError,
    addEntry, updateEntry, removeEntry, removeEntries, replaceEntry,
    loadModifiedFiles, loadGitHistory, loadDiff, loadDiffAtCommit,
    getNoteStatus, commitAndPush, reloadVault, reloadFolders, reloadViews,
    isReloading,
    addPendingSave: pendingSave.addPendingSave,
    removePendingSave: pendingSave.removePendingSave,
    unsavedPaths: unsaved.unsavedPaths,
    trackUnsaved: unsaved.trackUnsaved,
    clearUnsaved: unsaved.clearUnsaved,
  }
}
