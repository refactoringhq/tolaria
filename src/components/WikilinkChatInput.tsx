/**
 * Chat input with [[wikilink]] autocomplete.
 *
 * When the user types `[[`, a dropdown appears with vault note suggestions.
 * Selecting a note inserts a colored pill in the input and records a reference.
 */
import { useState, useRef, useMemo, useEffect } from 'react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { getTypeColor, getTypeLightColor, buildTypeEntryMap } from '../utils/typeColors'

const MAX_SUGGESTIONS = 20
const MIN_QUERY_LENGTH = 1
const DEBOUNCE_MS = 100

interface WikilinkChatInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
  disabled?: boolean
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}

interface Pill {
  title: string
  path: string
  type: string | null
  color?: string
  lightColor?: string
}

interface SuggestionEntry {
  title: string
  path: string
  isA: string | null
  color?: string
  lightColor?: string
}

function matchEntries(
  entries: VaultEntry[],
  query: string,
  typeEntryMap: Record<string, VaultEntry>,
): SuggestionEntry[] {
  if (query.length < MIN_QUERY_LENGTH) return []
  const lower = query.toLowerCase()
  const matches = entries.filter(e =>
    !e.trashed && !e.archived && (
      e.title.toLowerCase().includes(lower) ||
      e.aliases.some(a => a.toLowerCase().includes(lower))
    ),
  )
  return matches.slice(0, MAX_SUGGESTIONS).map(e => {
    const te = typeEntryMap[e.isA ?? '']
    return {
      title: e.title,
      path: e.path,
      isA: e.isA,
      color: e.isA ? getTypeColor(e.isA, te?.color) : undefined,
      lightColor: e.isA ? getTypeLightColor(e.isA, te?.color) : undefined,
    }
  })
}

export function WikilinkChatInput({
  entries, value, onChange, onSend, disabled, placeholder, inputRef: externalRef,
}: WikilinkChatInputProps) {
  const [pills, setPills] = useState<Pill[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRefToUse = externalRef ?? internalRef
  const menuRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const suggestions = useMemo(
    () => showMenu ? matchEntries(entries, debouncedQuery, typeEntryMap) : [],
    [entries, debouncedQuery, typeEntryMap, showMenu],
  )

  // Clamp selection to valid range
  const clampedIndex = suggestions.length > 0
    ? Math.min(selectedIndex, suggestions.length - 1)
    : 0

  useEffect(() => {
    if (!menuRef.current || clampedIndex < 0) return
    const el = menuRef.current.children[clampedIndex] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [clampedIndex])

  function selectSuggestion(suggestion: SuggestionEntry) {
    const cursor = inputRefToUse.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursor)
    const bracketIdx = textBefore.lastIndexOf('[[')
    if (bracketIdx < 0) return

    const textAfter = value.slice(cursor)
    const newValue = textBefore.slice(0, bracketIdx) + textAfter

    onChange(newValue)
    setPills(prev => {
      if (prev.some(p => p.path === suggestion.path)) return prev
      return [...prev, {
        title: suggestion.title,
        path: suggestion.path,
        type: suggestion.isA,
        color: suggestion.color,
        lightColor: suggestion.lightColor,
      }]
    })
    setShowMenu(false)
    setTimeout(() => inputRefToUse.current?.focus(), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    onChange(newValue)

    const cursor = e.target.selectionStart ?? newValue.length
    const textBefore = newValue.slice(0, cursor)
    const bracketIdx = textBefore.lastIndexOf('[[')

    if (bracketIdx >= 0 && !textBefore.slice(bracketIdx).includes(']]')) {
      const query = textBefore.slice(bracketIdx + 2)
      setShowMenu(true)
      setSelectedIndex(0)
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    } else {
      setShowMenu(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showMenu && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectSuggestion(suggestions[clampedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!value.trim() && pills.length === 0) return
      const references: NoteReference[] = pills.map(p => ({
        title: p.title,
        path: p.path,
        type: p.type,
      }))
      onSend(value, references)
      setPills([])
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1" style={{ marginBottom: 4 }}>
          {pills.map(pill => (
            <span
              key={pill.path}
              className="inline-flex items-center gap-1 text-xs"
              style={{
                background: pill.lightColor ?? 'var(--muted)',
                color: pill.color ?? 'var(--foreground)',
                borderRadius: 9999,
                padding: '1px 8px 1px 6px',
                fontWeight: 500,
              }}
              data-testid="reference-pill"
            >
              {pill.title}
              <button
                className="border-none bg-transparent p-0 cursor-pointer"
                style={{ color: 'inherit', opacity: 0.6, fontSize: 10, lineHeight: 1 }}
                onClick={() => setPills(prev => prev.filter(p => p.path !== pill.path))}
                tabIndex={-1}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRefToUse}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="flex-1 border border-border bg-transparent text-foreground"
        style={{
          fontSize: 13, borderRadius: 8, padding: '8px 10px',
          outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
        }}
        placeholder={placeholder}
        disabled={disabled}
        data-testid="agent-input"
      />
      {showMenu && suggestions.length > 0 && (
        <div
          ref={menuRef}
          className="wikilink-menu"
          style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            marginBottom: 4, maxHeight: 260, overflowY: 'auto',
          }}
          data-testid="wikilink-menu"
        >
          {suggestions.map((s, i) => (
            <div
              key={s.path}
              className="flex items-center justify-between gap-2 cursor-pointer transition-colors"
              style={{
                padding: '6px 10px',
                fontSize: 13,
                background: i === clampedIndex ? 'var(--accent)' : undefined,
              }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="truncate">{s.title}</span>
              {s.isA && s.isA !== 'Note' && (
                <span
                  className="shrink-0 text-xs"
                  style={{
                    color: s.color,
                    backgroundColor: s.lightColor,
                    borderRadius: 9999,
                    padding: '1px 8px',
                  }}
                >
                  {s.isA}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
