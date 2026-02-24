import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { SearchMode, SearchResult, VaultEntry } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

interface SearchResultData {
  title: string
  path: string
  snippet: string
  score: number
  note_type: string | null
}

interface SearchResponseData {
  results: SearchResultData[]
  elapsed_ms: number
}

function searchCall(args: Record<string, unknown>): Promise<SearchResponseData> {
  return isTauri() ? invoke<SearchResponseData>('search_vault', args) : mockInvoke<SearchResponseData>('search_vault', args)
}

interface SearchPanelProps {
  open: boolean
  vaultPath: string
  entries: VaultEntry[]
  onSelectNote: (entry: VaultEntry) => void
  onClose: () => void
}

export function SearchPanel({ open, vaultPath, entries, onSelectNote, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('keyword')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setElapsedMs(null)
      setSearchError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const performSearch = useCallback(async (q: string, m: SearchMode) => {
    if (!q.trim()) {
      setResults([])
      setElapsedMs(null)
      setSearchError(null)
      return
    }

    setLoading(true)
    setSearchError(null)
    try {
      const response = await searchCall({
        vaultPath,
        query: q,
        mode: m,
        limit: 20,
      })
      const mapped = response.results.map((r: SearchResultData) => ({
        title: r.title,
        path: r.path,
        snippet: r.snippet,
        score: r.score,
        noteType: r.note_type,
      }))
      setResults(mapped)
      setElapsedMs(response.elapsed_ms)
      setSelectedIndex(0)
    } catch (err) {
      setSearchError(String(err))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setElapsedMs(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query, mode)
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, mode, performSearch])

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
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        setMode(m => m === 'keyword' ? 'semantic' : 'keyword')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, results, selectedIndex, handleSelect, onClose])

  if (!open) return null

  const entryTypeMap = new Map(entries.map(e => [e.path, e.isA]))

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center bg-[var(--shadow-dialog)] pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="flex w-[540px] max-w-[90vw] max-h-[480px] flex-col self-start overflow-hidden rounded-xl border border-[var(--border-dialog)] bg-popover shadow-[0_8px_32px_var(--shadow-dialog)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            type="text"
            placeholder="Search in all notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex gap-1">
            <button
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                mode === 'keyword'
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode('keyword')}
            >
              Keyword
            </button>
            <button
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                mode === 'semantic'
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode('semantic')}
            >
              Semantic
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Searching...
            </div>
          )}

          {!loading && !query.trim() && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">Search across all note contents</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                Tab to toggle keyword/semantic · Enter to open · Esc to close
              </p>
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && !searchError && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">No results found</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                Try different keywords or switch to semantic search
              </p>
            </div>
          )}

          {searchError && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-destructive">Search error</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{searchError}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="border-b border-border/50 px-4 py-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {results.length} result{results.length !== 1 ? 's' : ''}{elapsedMs !== null ? ` · ${elapsedMs}ms` : ''}
                </span>
              </div>
              <div ref={listRef}>
                {results.map((result, i) => {
                  const noteType = entryTypeMap.get(result.path) ?? result.noteType
                  return (
                    <div
                      key={result.path}
                      className={cn(
                        "cursor-pointer px-4 py-2.5 transition-colors",
                        i === selectedIndex ? "bg-accent" : "hover:bg-secondary"
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{result.title}</span>
                        {noteType && (
                          <Badge variant="secondary" className="text-[10px]">
                            {noteType}
                          </Badge>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
