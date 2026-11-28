import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

export type FileResolution = 'ours' | 'theirs' | 'manual' | null

export interface ConflictFileState {
  file: string
  resolution: FileResolution
  resolving: boolean
}

type ConflictStrategy = Exclude<FileResolution, 'manual' | null>
type SetConflictFileStates = Dispatch<SetStateAction<ConflictFileState[]>>
type SetConflictError = Dispatch<SetStateAction<string | null>>

interface UseConflictResolverConfig {
  vaultPath: string
  onResolved: () => void
  onToast: (msg: string) => void
  onOpenFile: (relativePath: string) => void
}

function initialConflictFileState(file: string): ConflictFileState {
  return { file, resolution: null, resolving: false }
}

function updateConflictFile(
  states: ConflictFileState[],
  file: string,
  patch: Partial<ConflictFileState>,
): ConflictFileState[] {
  return states.map((state) => state.file === file ? { ...state, ...patch } : state)
}

function useResolveConflictFile(
  vaultPath: string,
  dialogSessionRef: RefObject<number>,
  setFileStates: SetConflictFileStates,
  setError: SetConflictError,
): (file: string, strategy: ConflictStrategy) => Promise<void> {
  return useCallback(async (file: string, strategy: ConflictStrategy) => {
    const session = dialogSessionRef.current
    setFileStates((prev) => updateConflictFile(prev, file, { resolving: true }))
    setError(null)

    try {
      await tauriCall<void>('git_resolve_conflict', { vaultPath, file, strategy })
      if (session !== dialogSessionRef.current) return
      setFileStates((prev) => updateConflictFile(prev, file, { resolution: strategy, resolving: false }))
    } catch (err) {
      if (session !== dialogSessionRef.current) return
      setFileStates((prev) => updateConflictFile(prev, file, { resolving: false }))
      setError(`Failed to resolve ${file}: ${err}`)
    }
  }, [dialogSessionRef, setError, setFileStates, vaultPath])
}

function useOpenConflictFile(
  onOpenFile: UseConflictResolverConfig['onOpenFile'],
  setFileStates: SetConflictFileStates,
): (file: string) => void {
  return useCallback((file: string) => {
    onOpenFile(file)
    setFileStates((prev) => updateConflictFile(prev, file, { resolution: 'manual' }))
  }, [onOpenFile, setFileStates])
}

function useCommitConflictResolution({
  allResolved,
  committing,
  dialogSessionRef,
  onResolved,
  onToast,
  setCommitting,
  setError,
  vaultPath,
}: {
  allResolved: boolean
  committing: boolean
  dialogSessionRef: RefObject<number>
  onResolved: UseConflictResolverConfig['onResolved']
  onToast: UseConflictResolverConfig['onToast']
  setCommitting: Dispatch<SetStateAction<boolean>>
  setError: SetConflictError
  vaultPath: string
}): () => Promise<void> {
  return useCallback(async () => {
    if (!allResolved || committing) return
    const session = dialogSessionRef.current
    setCommitting(true)
    setError(null)

    try {
      await tauriCall<string>('git_commit_conflict_resolution', { vaultPath })
      if (session !== dialogSessionRef.current) return
      onResolved()
      onToast('Conflicts resolved — sync resumed')
    } catch (err) {
      if (session === dialogSessionRef.current) setError(`Commit failed: ${err}`)
    } finally {
      if (session === dialogSessionRef.current) setCommitting(false)
    }
  }, [allResolved, committing, dialogSessionRef, onResolved, onToast, setCommitting, setError, vaultPath])
}

export function useConflictResolver({
  vaultPath,
  onResolved,
  onToast,
  onOpenFile,
}: UseConflictResolverConfig) {
  const dialogSessionRef = useRef(0)
  const [repositoryPath, setRepositoryPath] = useState(vaultPath)
  const [fileStates, setFileStates] = useState<ConflictFileState[]>([])
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initFiles = useCallback((files: string[], selectedPath = vaultPath) => {
    dialogSessionRef.current++
    setRepositoryPath(selectedPath)
    setFileStates(files.map(initialConflictFileState))
    setError(null)
    setCommitting(false)
  }, [vaultPath])

  const resolveFile = useResolveConflictFile(repositoryPath, dialogSessionRef, setFileStates, setError)
  const openInEditor = useOpenConflictFile(onOpenFile, setFileStates)

  const allResolved = fileStates.length > 0 && fileStates.every(f => f.resolution !== null)
  const anyResolving = fileStates.some(f => f.resolving)
  const commitResolution = useCommitConflictResolution({
    allResolved,
    committing,
    dialogSessionRef,
    onResolved,
    onToast,
    setCommitting,
    setError,
    vaultPath: repositoryPath,
  })

  return {
    fileStates,
    committing,
    error,
    allResolved,
    anyResolving,
    initFiles,
    resolveFile,
    openInEditor,
    commitResolution,
  }
}
