import { useState, useCallback, useEffect, useRef } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry } from '../types'

interface NoteListKeyboardOptions {
  items: VaultEntry[]
  selectedNotePath: string | null
  onOpen: (entry: VaultEntry) => void
  enabled: boolean
}

export function useNoteListKeyboard({
  items, selectedNotePath, onOpen, enabled,
}: NoteListKeyboardOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  // Reset highlight when items change (filter/sort/selection changed)
  useEffect(() => {
    setHighlightedIndex(-1) // eslint-disable-line react-hooks/set-state-in-effect -- reset on data change
  }, [items])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled || items.length === 0) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => {
        const next = Math.min((prev < 0 ? -1 : prev) + 1, items.length - 1)
        virtuosoRef.current?.scrollToIndex({ index: next, behavior: 'auto' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => {
        const next = Math.max((prev < 0 ? items.length : prev) - 1, 0)
        virtuosoRef.current?.scrollToIndex({ index: next, behavior: 'auto' })
        return next
      })
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < items.length) {
      e.preventDefault()
      onOpen(items[highlightedIndex])
    }
  }, [enabled, items, highlightedIndex, onOpen])

  const handleFocus = useCallback(() => {
    if (highlightedIndex >= 0 || items.length === 0) return
    const activeIdx = selectedNotePath
      ? items.findIndex(n => n.path === selectedNotePath)
      : -1
    setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0)
  }, [highlightedIndex, items, selectedNotePath])

  const highlightedPath = (highlightedIndex >= 0 && highlightedIndex < items.length)
    ? items[highlightedIndex].path
    : null

  return { highlightedPath, handleKeyDown, handleFocus, virtuosoRef }
}
