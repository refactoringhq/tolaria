import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { t } from '../lib/i18n'
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

interface UseConflictResolverConfig {
  vaultPath: string
  onResolved: () => void
  onToast: (msg: string) => void
  onOpenFile: (relativePath: string) => void
}

export function useConflictResolver({
  vaultPath,
  onResolved,
  onToast,
  onOpenFile,
}: UseConflictResolverConfig) {
  const [fileStates, setFileStates] = useState<ConflictFileState[]>([])
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initFiles = useCallback((files: string[]) => {
    setFileStates(files.map(file => ({ file, resolution: null, resolving: false })))
    setError(null)
    setCommitting(false)
  }, [])

  const resolveFile = useCallback(async (file: string, strategy: 'ours' | 'theirs') => {
    setFileStates(prev => prev.map(f =>
      f.file === file ? { ...f, resolving: true } : f
    ))
    setError(null)

    try {
      await tauriCall<void>('git_resolve_conflict', { vaultPath, file, strategy })
      setFileStates(prev => prev.map(f =>
        f.file === file ? { ...f, resolution: strategy, resolving: false } : f
      ))
    } catch (err) {
      setFileStates(prev => prev.map(f =>
        f.file === file ? { ...f, resolving: false } : f
      ))
      setError(`Failed to resolve ${file}: ${err}`)
    }
  }, [vaultPath])

  const openInEditor = useCallback((file: string) => {
    onOpenFile(file)
    setFileStates(prev => prev.map(f =>
      f.file === file ? { ...f, resolution: 'manual' } : f
    ))
  }, [onOpenFile])

  const allResolved = fileStates.length > 0 && fileStates.every(f => f.resolution !== null)
  const anyResolving = fileStates.some(f => f.resolving)

  const commitResolution = useCallback(async () => {
    if (!allResolved || committing) return
    setCommitting(true)
    setError(null)

    try {
      await tauriCall<string>('git_commit_conflict_resolution', { vaultPath })
      onResolved()
      onToast(t('Conflicts resolved — sync resumed'))
    } catch (err) {
      setError(`Commit failed: ${err}`)
    } finally {
      setCommitting(false)
    }
  }, [vaultPath, allResolved, committing, onResolved, onToast])

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
