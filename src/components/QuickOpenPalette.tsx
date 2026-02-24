import { useState, useRef, useEffect, useMemo } from 'react'
import type { VaultEntry } from '../types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { fuzzyMatch } from '../utils/fuzzyMatch'

interface QuickOpenPaletteProps {
  open: boolean
  entries: VaultEntry[]
  onSelect: (entry: VaultEntry) => void
  onClose: () => void
}

export function QuickOpenPalette({ open, entries, onSelect, onClose }: QuickOpenPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on dialog open
      setQuery(''); setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) {
      return [...entries].sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0)).slice(0, 20)
    }
    return entries
      .map((entry) => ({ entry, ...fuzzyMatch(query, entry.title) }))
      .filter((r) => r.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.entry)
  }, [entries, query])

  useEffect(() => {
    setSelectedIndex(0) // eslint-disable-line react-hooks/set-state-in-effect -- reset selection on query change
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex])
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, results, selectedIndex, onSelect, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center bg-[var(--shadow-dialog)] pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="flex w-[500px] max-w-[90vw] max-h-[400px] flex-col self-start overflow-hidden rounded-xl border border-[var(--border-dialog)] bg-popover shadow-[0_8px_32px_var(--shadow-dialog)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="border-b border-border bg-transparent px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          type="text"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto py-1" ref={listRef}>
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-[13px] text-muted-foreground">
              No matching notes
            </div>
          ) : (
            results.map((entry, i) => (
              <div
                key={entry.path}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-4 py-2 transition-colors",
                  i === selectedIndex ? "bg-accent" : "hover:bg-secondary"
                )}
                onClick={() => {
                  onSelect(entry)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="text-sm text-foreground">{entry.title}</span>
                {entry.isA && (
                  <Badge variant="secondary" className="text-[11px]">
                    {entry.isA}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
