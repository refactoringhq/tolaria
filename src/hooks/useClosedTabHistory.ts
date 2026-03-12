import { useCallback, useRef } from 'react'
import type { VaultEntry } from '../types'

export interface ClosedTabEntry {
  path: string
  index: number
  entry: VaultEntry
}

const MAX_HISTORY = 20

export function useClosedTabHistory() {
  const stackRef = useRef<ClosedTabEntry[]>([])

  const push = useCallback((path: string, index: number, entry: VaultEntry) => {
    const stack = stackRef.current
    // Remove any existing entry for this path (dedup)
    const filtered = stack.filter(e => e.path !== path)
    filtered.push({ path, index, entry })
    // Cap at MAX_HISTORY
    if (filtered.length > MAX_HISTORY) {
      filtered.splice(0, filtered.length - MAX_HISTORY)
    }
    stackRef.current = filtered
  }, [])

  const pop = useCallback((): ClosedTabEntry | null => {
    const stack = stackRef.current
    if (stack.length === 0) return null
    return stack.pop() ?? null
  }, [])

  const clear = useCallback(() => {
    stackRef.current = []
  }, [])

  // Getter so callers see live state without re-render
  return {
    push, pop, clear,
    get canReopen() { return stackRef.current.length > 0 },
  }
}
