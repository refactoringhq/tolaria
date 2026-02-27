import { useCallback, useRef } from 'react'

function resolveEnterTarget(
  highlightIndex: number, allFiltered: string[], showCreateOption: boolean, query: string,
): string | null {
  if (highlightIndex >= 0 && highlightIndex < allFiltered.length) return allFiltered[highlightIndex]
  if (showCreateOption && highlightIndex === allFiltered.length) return query.trim()
  if (query.trim()) return query.trim()
  return null
}

export function useDropdownKeyboard({
  highlightIndex, setHighlightIndex, totalOptions, allFiltered, showCreateOption, query, onSave, onCancel,
}: {
  highlightIndex: number; setHighlightIndex: (i: number) => void; totalOptions: number
  allFiltered: string[]; showCreateOption: boolean; query: string
  onSave: (v: string) => void; onCancel: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const scrollHighlightedIntoView = useCallback((index: number) => {
    const items = listRef.current?.querySelectorAll('[data-testid^="status-option-"], [data-testid="status-create-option"]')
    items?.[index]?.scrollIntoView({ block: 'nearest' })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = e.key === 'ArrowDown'
          ? (highlightIndex < totalOptions - 1 ? highlightIndex + 1 : 0)
          : (highlightIndex > 0 ? highlightIndex - 1 : totalOptions - 1)
        setHighlightIndex(next)
        scrollHighlightedIntoView(next)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = resolveEnterTarget(highlightIndex, allFiltered, showCreateOption, query)
        if (target) onSave(target)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [highlightIndex, totalOptions, allFiltered, showCreateOption, query, onSave, onCancel, setHighlightIndex, scrollHighlightedIntoView],
  )

  return { listRef, handleKeyDown }
}
