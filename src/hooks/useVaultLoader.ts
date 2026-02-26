import { useCallback, useEffect, useState, startTransition } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry, GitCommit, ModifiedFile, NoteStatus } from '../types'

function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

async function loadVaultData(vaultPath: string) {
  if (!isTauri()) console.info('[mock] Using mock Tauri data for browser testing')
  const entries = await tauriCall<VaultEntry[]>('list_vault', { path: vaultPath })
  console.log(`Vault scan complete: ${entries.length} entries found`)
  const allContent = isTauri() ? {} : await mockInvoke<Record<string, string>>('get_all_content', { path: vaultPath })
  return { entries, allContent }
}

async function commitWithPush(vaultPath: string, message: string): Promise<string> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { message })
    await mockInvoke<string>('git_push', {})
    return 'Committed and pushed'
  }
  await invoke<string>('git_commit', { vaultPath, message })
  try {
    await invoke<string>('git_push', { vaultPath })
    return 'Committed and pushed'
  } catch {
    return 'Committed (push failed)'
  }
}

function useNewNoteTracker() {
  const [newPaths, setNewPaths] = useState<Set<string>>(new Set())

  const trackNew = useCallback((path: string) => {
    setNewPaths((prev) => new Set(prev).add(path))
  }, [])

  const clear = useCallback(() => setNewPaths(new Set()), [])

  return { newPaths, trackNew, clear }
}

export function resolveNoteStatus(path: string, newPaths: Set<string>, modifiedFiles: ModifiedFile[]): NoteStatus {
  if (newPaths.has(path)) return 'new'
  const gitEntry = modifiedFiles.find((f) => f.path === path)
  if (!gitEntry) return 'clean'
  if (gitEntry.status === 'untracked' || gitEntry.status === 'added') return 'new'
  if (gitEntry.status === 'modified') return 'modified'
  return 'clean'
}

export function useVaultLoader(vaultPath: string) {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [allContent, setAllContent] = useState<Record<string, string>>({})
  const [modifiedFiles, setModifiedFiles] = useState<ModifiedFile[]>([])
  const tracker = useNewNoteTracker()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale data then load new vault
    setEntries([]); setAllContent({}); setModifiedFiles([]); tracker.clear()
    loadVaultData(vaultPath)
      .then(({ entries: e, allContent: c }) => { setEntries(e); setAllContent(c) })
      .catch((err) => console.warn('Vault scan failed:', err))
  }, [vaultPath]) // eslint-disable-line react-hooks/exhaustive-deps -- tracker.clear is stable

  const loadModifiedFiles = useCallback(async () => {
    try {
      setModifiedFiles(await tauriCall<ModifiedFile[]>('get_modified_files', { vaultPath }, {}))
    } catch (err) {
      console.warn('Failed to load modified files:', err)
      setModifiedFiles([])
    }
  }, [vaultPath])

  useEffect(() => { loadModifiedFiles() }, [loadModifiedFiles]) // eslint-disable-line react-hooks/set-state-in-effect -- trigger initial load

  // PERF: startTransition defers the expensive entries update (filter/sort on
  // 9000+ entries) so the high-priority tab render completes in <50ms first.
  const addEntry = useCallback((entry: VaultEntry, content: string) => {
    startTransition(() => {
      setEntries((prev) => {
        if (prev.some(e => e.path === entry.path)) return prev
        return [entry, ...prev]
      })
      setAllContent((prev) => ({ ...prev, [entry.path]: content }))
      tracker.trackNew(entry.path)
    })
  }, [tracker])

  const updateContent = useCallback((path: string, content: string) =>
    setAllContent((prev) => ({ ...prev, [path]: content })), [])

  const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) =>
    setEntries((prev) => prev.map((e) => e.path === path ? { ...e, ...patch } : e)), [])

  const removeEntry = useCallback((path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path))
    setAllContent((prev) => { const next = { ...prev }; delete next[path]; return next })
  }, [])

  const replaceEntry = useCallback((oldPath: string, patch: Partial<VaultEntry> & { path: string }, newContent: string) => {
    setEntries((prev) => prev.map((e) => e.path === oldPath ? { ...e, ...patch } : e))
    setAllContent((prev) => { const next = { ...prev }; delete next[oldPath]; next[patch.path] = newContent; return next })
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
    resolveNoteStatus(path, tracker.newPaths, modifiedFiles), [tracker.newPaths, modifiedFiles])

  const commitAndPush = useCallback((message: string): Promise<string> =>
    commitWithPush(vaultPath, message), [vaultPath])

  const reloadVault = useCallback(
    () => loadVaultData(vaultPath)
      .then((data) => { setEntries(data.entries); setAllContent((prev) => ({ ...prev, ...data.allContent })); loadModifiedFiles() })
      .catch((err) => console.warn('Vault reload failed:', err)),
    [vaultPath, loadModifiedFiles],
  )

  return {
    entries, allContent, modifiedFiles,
    addEntry, updateEntry, removeEntry, replaceEntry, updateContent,
    loadModifiedFiles, loadGitHistory, loadDiff, loadDiffAtCommit,
    getNoteStatus, commitAndPush, reloadVault,
  }
}
