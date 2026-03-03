import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export interface IndexingProgress {
  phase: 'idle' | 'installing' | 'scanning' | 'embedding' | 'complete' | 'error' | 'unavailable'
  current: number
  total: number
  done: boolean
  error: string | null
}

interface IndexStatus {
  available: boolean
  qmd_installed: boolean
  collection_exists: boolean
  indexed_count: number
  embedded_count: number
  pending_embed: number
}

const IDLE: IndexingProgress = { phase: 'idle', current: 0, total: 0, done: false, error: null }

function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

export function useIndexing(vaultPath: string) {
  const [progress, setProgress] = useState<IndexingProgress>(IDLE)
  const indexingRef = useRef(false)
  const vaultPathRef = useRef(vaultPath)

  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

  // Listen for progress events from Rust
  useEffect(() => {
    if (!isTauri()) return

    let cleanup: (() => void) | null = null

    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisten = listen<IndexingProgress>('indexing-progress', (event) => {
        setProgress(event.payload)
        if (event.payload.done) {
          indexingRef.current = false
        }
      })
      cleanup = () => { unlisten.then(fn => fn()) }
    })

    return () => { cleanup?.() }
  }, [])

  // Check index status and auto-trigger indexing on vault open
  useEffect(() => {
    if (!vaultPath) return
    let cancelled = false

    async function checkAndIndex() {
      try {
        const status = await invokeCmd<IndexStatus>('get_index_status', { vaultPath })
        if (cancelled) return

        // If qmd not installed or no collection or pending embeds, trigger indexing
        const needsIndexing = !status.qmd_installed || !status.collection_exists || status.pending_embed > 0
        if (needsIndexing && !indexingRef.current) {
          indexingRef.current = true
          setProgress({
            phase: 'scanning',
            current: 0,
            total: status.indexed_count,
            done: false,
            error: null,
          })
          // Fire and forget — progress updates come via events
          invokeCmd('start_indexing', { vaultPath }).catch((err) => {
            if (cancelled) return
            const msg = String(err)
            const isUnavailable = msg.includes('not installed') || msg.includes('not available')
            setProgress({
              phase: isUnavailable ? 'unavailable' : 'error',
              current: 0,
              total: 0,
              done: true,
              error: msg,
            })
            indexingRef.current = false
          })
        }
      } catch {
        // get_index_status failed — likely qmd not available, non-fatal
      }
    }

    checkAndIndex()
    return () => { cancelled = true }
  }, [vaultPath])

  // Auto-dismiss transient statuses after a delay
  useEffect(() => {
    if (progress.phase === 'complete') {
      const timer = setTimeout(() => setProgress(IDLE), 5000)
      return () => clearTimeout(timer)
    }
    if (progress.phase === 'unavailable') {
      const timer = setTimeout(() => setProgress(IDLE), 8000)
      return () => clearTimeout(timer)
    }
    if (progress.phase === 'error') {
      const timer = setTimeout(() => setProgress(IDLE), 15000)
      return () => clearTimeout(timer)
    }
  }, [progress.phase])

  const triggerIncrementalIndex = useCallback(async () => {
    if (indexingRef.current) return
    try {
      await invokeCmd('trigger_incremental_index', { vaultPath: vaultPathRef.current })
    } catch {
      // Incremental update failure is non-fatal
    }
  }, [])

  const retryIndexing = useCallback(async () => {
    if (indexingRef.current || !vaultPathRef.current) return
    indexingRef.current = true
    setProgress({ phase: 'scanning', current: 0, total: 0, done: false, error: null })
    try {
      await invokeCmd('start_indexing', { vaultPath: vaultPathRef.current })
    } catch (err) {
      const msg = String(err)
      const isUnavailable = msg.includes('not installed') || msg.includes('not available')
      setProgress({ phase: isUnavailable ? 'unavailable' : 'error', current: 0, total: 0, done: true, error: msg })
    } finally {
      indexingRef.current = false
    }
  }, [])

  return { progress, triggerIncrementalIndex, retryIndexing }
}
