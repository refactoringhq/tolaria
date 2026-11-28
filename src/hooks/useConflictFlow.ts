import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { openLocalFile } from '../utils/url'
import { findByNotePath, joinVaultPath, normalizeNotePathForIdentity, notePathsMatch } from '../utils/notePathIdentity'

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

interface ConflictFlowDeps {
  resolvedPath: string
  entries: VaultEntry[]
  conflictFiles: string[]
  pausePull: () => void
  resumePull: () => void
  triggerSync: (repositoryPath?: string) => void
  reloadVault: () => Promise<unknown>
  initConflictFiles: (files: string[], repositoryPath: string) => void
  openConflictResolver: () => void
  closeConflictResolver: () => void
  onSelectNote: (entry: VaultEntry) => void
  activeTabPath: string | null
  setToastMessage: (msg: string | null) => void
}

async function fetchConflictFiles(vaultPath: string): Promise<string[]> {
  return tauriCall<string[]>('get_conflict_files', { vaultPath })
}

async function inspectManualConflict(vaultPath: string, file: string) {
  const remaining = await fetchConflictFiles(vaultPath)
  if (remaining.includes(file)) return null
  const mode = remaining.length === 0 ? await tauriCall<string>('get_conflict_mode', { vaultPath }) : null
  return { remaining, needsCommit: mode === 'merge' || mode === 'rebase' }
}

async function applyInlineResolution(vaultPath: string, file: string, strategy: 'ours' | 'theirs') {
  await tauriCall('git_resolve_conflict', { vaultPath, file, strategy })
  const remaining = await fetchConflictFiles(vaultPath)
  return { remaining, needsCommit: remaining.length === 0 }
}

async function resolveAndCommitInline(vaultPath: string, filePath: string, strategy: 'ours' | 'theirs', manual: boolean) {
  const file = normalizeNotePathForIdentity(filePath).replace(`${normalizeNotePathForIdentity(vaultPath)}/`, '')
  const inspected = manual ? await inspectManualConflict(vaultPath, file) : null
  const outcome = inspected ?? await applyInlineResolution(vaultPath, file, strategy)
  if (outcome.needsCommit) await commitMergeResolution(vaultPath)
  return outcome
}

async function commitMergeResolution(vaultPath: string): Promise<void> {
  await tauriCall('git_commit_conflict_resolution', { vaultPath })
}

interface ConflictBatch {
  repositoryPath: string
  files: string[]
}

function hasConflictedPath(batch: ConflictBatch | null, path: string): boolean {
  if (!batch) return false
  return batch.files.some((file) => notePathsMatch(joinVaultPath(batch.repositoryPath, file), path))
}

function useOpenConflictFileRef({
  closeConflictResolver,
  entries,
  onSelectNote,
  dialogRef,
  onManualOpen,
}: Pick<ConflictFlowDeps, 'closeConflictResolver' | 'entries' | 'onSelectNote'> & { dialogRef: RefObject<ConflictBatch | null>; onManualOpen: (batch: ConflictBatch) => void }) {
  const openConflictFileRef = useRef<(relativePath: string) => void>(() => {})
  useEffect(() => {
    openConflictFileRef.current = (relativePath: string) => {
      const batch = dialogRef.current
      if (!batch) return
      const vaultPath = batch.repositoryPath
      const fullPath = joinVaultPath(vaultPath, relativePath)
      const entry = findByNotePath(entries, fullPath)
      if (entry) {
        onManualOpen({ repositoryPath: vaultPath, files: [relativePath] })
        onSelectNote(entry)
        closeConflictResolver()
      } else {
        openLocalFile(fullPath, vaultPath)
      }
    }
  }, [closeConflictResolver, dialogRef, entries, onManualOpen, onSelectNote])
  return openConflictFileRef
}

function useConflictDialogOpener(
  options: Pick<ConflictFlowDeps, 'conflictFiles' | 'resolvedPath' | 'pausePull' | 'initConflictFiles' | 'openConflictResolver' | 'setToastMessage'>,
  dialogRef: RefObject<ConflictBatch | null>,
  requestIdRef: RefObject<number>,
) {
  const { conflictFiles, resolvedPath, pausePull, initConflictFiles, openConflictResolver, setToastMessage } = options
  return useCallback(async (requestedPath?: string) => {
    const explicitRepository = typeof requestedPath === 'string'
    const repositoryPath = explicitRepository ? requestedPath : resolvedPath
    const request = ++requestIdRef.current
    let files = explicitRepository ? [] : conflictFiles
    if (files.length === 0) {
      try {
        files = await fetchConflictFiles(repositoryPath)
      } catch {
        return
      }
      if (request !== requestIdRef.current) return
      if (files.length === 0) {
        setToastMessage('No merge conflicts to resolve')
        return
      }
    }
    pausePull()
    dialogRef.current = { repositoryPath, files }
    initConflictFiles(files, repositoryPath)
    openConflictResolver()
  }, [conflictFiles, dialogRef, resolvedPath, pausePull, requestIdRef, initConflictFiles, openConflictResolver, setToastMessage])
}

function updateManualConflictFiles(
  manual: ConflictBatch | null,
  remaining: string[],
  setManualConflict: Dispatch<SetStateAction<ConflictBatch | null>>,
) {
  if (!manual) return
  setManualConflict((current) => current === manual ? { ...manual, files: remaining } : current)
}

function useConflictResolutionActions(
  options: Pick<ConflictFlowDeps, 'resolvedPath' | 'reloadVault' | 'resumePull' | 'triggerSync' | 'setToastMessage'>,
  manualConflict: ConflictBatch | null,
  setManualConflict: Dispatch<SetStateAction<ConflictBatch | null>>,
) {
  const { resolvedPath, reloadVault, resumePull, triggerSync, setToastMessage } = options
  const handleResolveConflictInline = useCallback(
    async (filePath: string, strategy: 'ours' | 'theirs') => {
    const manual = hasConflictedPath(manualConflict, filePath) ? manualConflict : null
    const repositoryPath = manual?.repositoryPath ?? resolvedPath
    try {
      const { remaining, needsCommit } = await resolveAndCommitInline(repositoryPath, filePath, strategy, manual !== null)
      updateManualConflictFiles(manual, remaining, setManualConflict)
      if (remaining.length === 0) {
        if (manual) resumePull()
        reloadVault()
        triggerSync(manual?.repositoryPath)
        setToastMessage(needsCommit ? 'All conflicts resolved — merge committed' : null)
      } else {
        reloadVault()
        setToastMessage(`Resolved — ${remaining.length} conflict${remaining.length > 1 ? 's' : ''} remaining`)
      }
    } catch (err) {
      setToastMessage(`Failed to resolve conflict: ${err}`)
    }
    },
    [manualConflict, resolvedPath, reloadVault, resumePull, triggerSync, setManualConflict, setToastMessage],
  )

  const handleKeepMine = useCallback(
    (path: string) => handleResolveConflictInline(path, 'ours'),
    [handleResolveConflictInline],
  )
  const handleKeepTheirs = useCallback(
    (path: string) => handleResolveConflictInline(path, 'theirs'),
    [handleResolveConflictInline],
  )
  return { handleKeepMine, handleKeepTheirs }
}

export function useConflictFlow(options: ConflictFlowDeps) {
  const { resolvedPath, entries, conflictFiles, resumePull, closeConflictResolver, onSelectNote, activeTabPath } = options
  const dialogRef = useRef<ConflictBatch | null>(null)
  const requestIdRef = useRef(0)
  const [manualConflict, setManualConflict] = useState<ConflictBatch | null>(null)
  const openConflictFileRef = useOpenConflictFileRef({ closeConflictResolver, entries, onSelectNote, dialogRef, onManualOpen: setManualConflict })

  const handleOpenConflictResolver = useConflictDialogOpener(options, dialogRef, requestIdRef)
  const { handleKeepMine, handleKeepTheirs } = useConflictResolutionActions(options, manualConflict, setManualConflict)
  const handleCloseConflictResolver = useCallback(() => {
    requestIdRef.current++
    resumePull()
    closeConflictResolver()
  }, [resumePull, closeConflictResolver])

  const syncConflicts = { repositoryPath: resolvedPath, files: conflictFiles }
  const isConflicted = activeTabPath !== null && (
    hasConflictedPath(syncConflicts, activeTabPath) ||
    hasConflictedPath(manualConflict, activeTabPath)
  )

  return {
    openConflictFileRef,
    handleOpenConflictResolver,
    handleCloseConflictResolver,
    handleKeepMine,
    handleKeepTheirs,
    isConflicted,
  }
}
