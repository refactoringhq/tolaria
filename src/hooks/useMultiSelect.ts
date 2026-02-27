import { useState, useCallback, useRef } from 'react'
import type { VaultEntry } from '../types'

export interface MultiSelectState {
  selectedPaths: Set<string>
  isMultiSelecting: boolean
  toggle: (path: string) => void
  selectRange: (toPath: string) => void
  clear: () => void
  selectAll: () => void
}

export function useMultiSelect(visibleEntries: VaultEntry[]): MultiSelectState {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const lastClickedRef = useRef<string | null>(null)

  const toggle = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    lastClickedRef.current = path
  }, [])

  const selectRange = useCallback((toPath: string) => {
    const fromPath = lastClickedRef.current
    if (!fromPath) {
      toggle(toPath)
      return
    }
    const paths = visibleEntries.map((e) => e.path)
    const fromIdx = paths.indexOf(fromPath)
    const toIdx = paths.indexOf(toPath)
    if (fromIdx === -1 || toIdx === -1) {
      toggle(toPath)
      return
    }
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) next.add(paths[i])
      return next
    })
    lastClickedRef.current = toPath
  }, [visibleEntries, toggle])

  const clear = useCallback(() => {
    setSelectedPaths(new Set())
    lastClickedRef.current = null
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(visibleEntries.map((e) => e.path)))
  }, [visibleEntries])

  return {
    selectedPaths,
    isMultiSelecting: selectedPaths.size > 0,
    toggle,
    selectRange,
    clear,
    selectAll,
  }
}
