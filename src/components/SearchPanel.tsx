import { useRef, useEffect, useCallback } from 'react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SearchResult, VaultEntry } from '../types'
import { useUnifiedSearch } from '../hooks/useUnifiedSearch'
import { getTypeColor, buildTypeEntryMap } from '../utils/typeColors'
import { formatSearchSubtitle } from '../utils/noteListHelpers'
import { getTypeIcon } from './NoteItem'

interface SearchPanelProps {
  open: boolean
  vaultPath: string
  entries: VaultEntry[]
  onSelectNote: (entry: VaultEntry) => void
  onClose: () => void
}

export function SearchPanel({ open, vaultPath, entries, onSelectNote, onClose }: SearchPanelProps) {
  const {
    query, setQuery, results, selectedIndex, setSelectedIndex, loading, elapsedMs,
  } = useUnifiedSearch(vaultPath, open)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback((result: SearchResult) => {
    const entry = entries.find(e => e.path === result.path)
    if (entry) {
      onSelectNote(entry)
      onClose()
    }
  }, [entries, onSelectNote, onClose])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) handleSelect(results[selectedIndex])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, results, selectedIndex, handleSelect, setSelectedIndex, onClose])

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const entryLookup = useMemo(() => {
    const map = new Map<string, VaultEntry>()
    for (const e of entries) map.set(e.path, e)
    return map
  }, [entries])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center bg-[var(--shadow-dialog)] pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="flex w-[540px] max-w-[90vw] max-h-[480px] flex-col self-start overflow-hidden rounded-xl border border-[var(--border-dialog)] bg-popover shadow-[0_8px_32px_var(--shadow-dialog)]"
        onClick={e => e.stopPropagation()}
      >
        <SearchInput
          ref={inputRef}
          query={query}
          loading={loading}
          onChange={setQuery}
        />
        <SearchContent
          query={query}
          results={results}
          selectedIndex={selectedIndex}
          loading={loading}
          elapsedMs={elapsedMs}
          entryLookup={entryLookup}
          typeEntryMap={typeEntryMap}
          listRef={listRef}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
        />
      </div>
    </div>
  )
}

import { forwardRef } from 'react'

interface SearchInputProps {
  query: string
  loading: boolean
  onChange: (value: string) => void
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ query, loading, onChange }, ref) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={ref}
          className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          type="text"
          placeholder="Search in all notes..."
          value={query}
          onChange={e => onChange(e.target.value)}
        />
        {loading && (
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            data-testid="search-spinner"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    )
  },
)

interface SearchContentProps {
  query: string
  results: SearchResult[]
  selectedIndex: number
  loading: boolean
  elapsedMs: number | null
  entryLookup: Map<string, VaultEntry>
  typeEntryMap: Record<string, VaultEntry>
  listRef: React.RefObject<HTMLDivElement | null>
  onSelect: (result: SearchResult) => void
  onHover: (index: number) => void
}

function SearchContent({
  query, results, selectedIndex, loading, elapsedMs, entryLookup, typeEntryMap, listRef, onSelect, onHover,
}: SearchContentProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {!query.trim() && (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">Search across all note contents</p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            Enter to open · Esc to close
          </p>
        </div>
      )}

      {query.trim() && results.length === 0 && loading && (
        <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
          Searching...
        </div>
      )}

      {query.trim() && results.length === 0 && !loading && (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">No results found</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="border-b border-border/50 px-4 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''}{elapsedMs !== null ? ` · ${elapsedMs}ms` : ''}
            </span>
          </div>
          <div ref={listRef}>
            {results.map((result, i) => {
              const entry = entryLookup.get(result.path)
              const isA = entry?.isA ?? result.noteType
              const noteType = isA && isA !== 'Note' ? isA : null
              const te = typeEntryMap[isA ?? '']
              const typeColor = noteType ? getTypeColor(isA, te?.color) : undefined
              const TypeIcon = getTypeIcon(isA ?? null, te?.icon)
              const subtitle = entry ? formatSearchSubtitle(entry) : null
              return (
                <div
                  key={result.path}
                  className={cn(
                    "cursor-pointer px-4 py-2.5 transition-colors",
                    i === selectedIndex ? "bg-accent" : "hover:bg-secondary",
                  )}
                  onClick={() => onSelect(result)}
                  onMouseEnter={() => onHover(i)}
                >
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line react-hooks/static-components -- icon from static map lookup */}
                    <TypeIcon width={14} height={14} className="shrink-0" style={{ color: typeColor ?? 'var(--muted-foreground)' }} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{result.title}</span>
                    {noteType && (
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">{noteType}</span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="mt-0.5 pl-[22px] text-[11px] text-muted-foreground">
                      {subtitle}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
