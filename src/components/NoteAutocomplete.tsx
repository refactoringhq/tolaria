import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { VaultEntry } from '../types'
import { getTypeColor } from '../utils/typeColors'
import './WikilinkSuggestionMenu.css'

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 10

interface NoteAutocompleteProps {
  entries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  value: string
  onChange: (value: string) => void
  onSelect: (noteTitle: string) => void
  onEscape?: () => void
  placeholder?: string
  autoFocus?: boolean
  testId?: string
}

interface MatchedEntry {
  title: string
  noteType?: string
  typeColor?: string
}

function matchEntries(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>, query: string): MatchedEntry[] {
  if (query.length < MIN_QUERY_LENGTH) return []
  const lowerQuery = query.toLowerCase()
  const matches = entries.filter(e =>
    e.title.toLowerCase().includes(lowerQuery) ||
    e.aliases.some(a => a.toLowerCase().includes(lowerQuery)),
  )
  return matches.slice(0, MAX_RESULTS).map(e => {
    const isA = e.isA
    const te = typeEntryMap[isA ?? '']
    const noteType = isA && isA !== 'Note' ? isA : undefined
    return {
      title: e.title,
      noteType,
      typeColor: noteType ? getTypeColor(isA, te?.color) : undefined,
    }
  })
}

export function NoteAutocomplete({ entries, typeEntryMap, value, onChange, onSelect, onEscape, placeholder, autoFocus, testId }: NoteAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(
    () => open ? matchEntries(entries, typeEntryMap, value) : [],
    [entries, typeEntryMap, value, open],
  )

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !menuRef.current) return
    const el = menuRef.current.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!inputRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback((title: string) => {
    onSelect(title)
    setOpen(false)
    setSelectedIndex(-1)
  }, [onSelect])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setOpen(true)
    setSelectedIndex(-1)
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) {
      if (e.key === 'Enter') { onSelect(value); return }
      if (e.key === 'Escape') { onEscape?.(); return }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < matches.length) {
        handleSelect(matches[selectedIndex].title)
      } else {
        onSelect(value)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      onEscape?.()
    }
  }, [open, matches, selectedIndex, value, handleSelect, onSelect, onEscape])

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="flex-1 border border-border bg-transparent px-2 py-0.5 text-xs text-foreground"
        style={{ borderRadius: 4, outline: 'none', minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        data-testid={testId}
      />
      {open && matches.length > 0 && (
        <div className="wikilink-menu" ref={menuRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, minWidth: 'auto' }}>
          {matches.map((item, index) => (
            <div
              key={item.title}
              className={`wikilink-menu__item${index === selectedIndex ? ' wikilink-menu__item--selected' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(item.title)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="wikilink-menu__title">{item.title}</span>
              {item.noteType && (
                <span className="wikilink-menu__type" style={{ color: item.typeColor }}>
                  {item.noteType}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
