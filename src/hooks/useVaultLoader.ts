import { useCallback, useEffect, useState, startTransition } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry, GitCommit, ModifiedFile, NoteStatus, GitPushResult } from '../types'
import { clearPrefetchCache } from './useTabManagement'

function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

async function loadVaultData(vaultPath: string) {
  if (!isTauri()) console.info('[mock] Using mock Tauri data for browser testing')
  const entries = await tauriCall<VaultEntry[]>('list_vault', { path: vaultPath })
  console.log(`Vault scan complete: ${entries.length} entries found`)
  return { entries }
}

async function commitWithPush(vaultPath: string, message: string): Promise<string> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { message })
    const pushResult = await mockInvoke<GitPushResult>('git_push', {})
    return pushResult.status === 'ok' ? 'Committed and pushed' : pushResult.message
  }
  await invoke<string>('git_commit', { vaultPath, message })
  const pushResult = await invoke<GitPushResult>('git_push', { vaultPath })
  return pushResult.status === 'ok' ? 'Committed and pushed' : pushResult.message
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
  if (gitEntry.status === 'modified') return 'modified'
  return 'clean'
}

export function useVaultLoader(vaultPath: string) {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [modifiedFiles, setModifiedFiles] = useState<ModifiedFile[]>([])
  const [modifiedFilesError, setModifiedFilesError] = useState<string | null>(null)
  const tracker = useNewNoteTracker()
  const pendingSave = usePendingSaveTracker()
  const unsaved = useUnsavedTracker()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale data then load new vault
    setEntries([]); setModifiedFiles([]); setModifiedFilesError(null); tracker.clear(); unsaved.clearAll()
    loadVaultData(vaultPath)
      .then(({ entries: e }) => { setEntries(e) })
      .catch((err) => console.warn('Vault scan failed:', err))
  }, [vaultPath]) // eslint-disable-line react-hooks/exhaustive-deps -- tracker.clear is stable

  const loadModifiedFiles = useCallback(async () => {
    try {
      setModifiedFilesError(null)
      setModifiedFiles(await tauriCall<ModifiedFile[]>('get_modified_files', { vaultPath }, {}))
    } catch (err) {
      const message = typeof err === 'string' ? err : 'Failed to load changes'
      console.warn('Failed to load modified files:', err)
      setModifiedFilesError(message)
      setModifiedFiles([])
    }
  }, [vaultPath])

  useEffect(() => { loadModifiedFiles() }, [loadModifiedFiles]) // eslint-disable-line react-hooks/set-state-in-effect -- trigger initial load

  // PERF: startTransition defers the expensive entries update (filter/sort on
  // 9000+ entries) so the high-priority tab render completes in <50ms first.
  const addEntry = useCallback((entry: VaultEntry) => {
    startTransition(() => {
      setEntries((prev) => {
        if (prev.some(e => e.path === entry.path)) return prev
        return [entry, ...prev]
      })
      tracker.trackNew(entry.path)
    })
  }, [tracker])

  const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) =>
    setEntries((prev) => prev.map((e) => e.path === path ? { ...e, ...patch } : e)), [])

  const removeEntry = useCallback((path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path))
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

  const commitAndPush = useCallback((message: string): Promise<string> =>
    commitWithPush(vaultPath, message), [vaultPath])

  const reloadVault = useCallback(
    () => {
      clearPrefetchCache()
      return tauriCall<VaultEntry[]>('reload_vault', { path: vaultPath })
        .then((entries) => { setEntries(entries); loadModifiedFiles(); return entries })
        .catch((err) => { console.warn('Vault reload failed:', err); return [] as VaultEntry[] })
    },
    [vaultPath, loadModifiedFiles],
  )

  return {
    entries, modifiedFiles, modifiedFilesError,
    addEntry, updateEntry, removeEntry, replaceEntry,
    loadModifiedFiles, loadGitHistory, loadDiff, loadDiffAtCommit,
    getNoteStatus, commitAndPush, reloadVault,
    addPendingSave: pendingSave.addPendingSave,
    removePendingSave: pendingSave.removePendingSave,
    unsavedPaths: unsaved.unsavedPaths,
    trackUnsaved: unsaved.trackUnsaved,
    clearUnsaved: unsaved.clearUnsaved,
  }
}
