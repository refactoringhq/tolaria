import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { GitPullResult, SyncStatus } from '../types'

const DEFAULT_INTERVAL_MS = 5 * 60_000

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

interface UseAutoSyncOptions {
  vaultPath: string
  intervalMinutes: number | null
  onVaultUpdated: () => void
  onConflict: (files: string[]) => void
  onToast: (msg: string) => void
}

export interface AutoSyncState {
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictFiles: string[]
  triggerSync: () => void
}

export function useAutoSync({
  vaultPath,
  intervalMinutes,
  onVaultUpdated,
  onConflict,
  onToast,
}: UseAutoSyncOptions): AutoSyncState {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [conflictFiles, setConflictFiles] = useState<string[]>([])
  const syncingRef = useRef(false)
  const callbacksRef = useRef({ onVaultUpdated, onConflict, onToast })
  callbacksRef.current = { onVaultUpdated, onConflict, onToast }

  const performPull = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')

    try {
      const result = await tauriCall<GitPullResult>('git_pull', { vaultPath })
      setLastSyncTime(Date.now())

      if (result.status === 'updated') {
        setSyncStatus('idle')
        setConflictFiles([])
        callbacksRef.current.onVaultUpdated()
        callbacksRef.current.onToast(`Pulled ${result.updatedFiles.length} update(s) from remote`)
      } else if (result.status === 'conflict') {
        setSyncStatus('conflict')
        setConflictFiles(result.conflictFiles)
        callbacksRef.current.onConflict(result.conflictFiles)
      } else if (result.status === 'error') {
        setSyncStatus('error')
      } else {
        // up_to_date or no_remote
        setSyncStatus('idle')
        setConflictFiles([])
      }
    } catch {
      setSyncStatus('error')
      setLastSyncTime(Date.now())
    } finally {
      syncingRef.current = false
    }
  }, [vaultPath])

  // Pull on mount (app launch)
  useEffect(() => {
    performPull()
  }, [performPull])

  // Pull on window focus (app foreground)
  useEffect(() => {
    const handleFocus = () => { performPull() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [performPull])

  // Periodic pull
  useEffect(() => {
    const ms = (intervalMinutes ?? 5) * 60_000 || DEFAULT_INTERVAL_MS
    const id = setInterval(performPull, ms)
    return () => clearInterval(id)
  }, [performPull, intervalMinutes])

  return { syncStatus, lastSyncTime, conflictFiles, triggerSync: performPull }
}
