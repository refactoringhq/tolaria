import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getTagStyle, setTagColor, getTagColorKey } from '../utils/tagStyles'
import { ACCENT_COLORS } from '../utils/typeColors'

export function TagPill({ tag, className }: { tag: string; className?: string }) {
  const style = getTagStyle(tag)
  return (
    <span
      className={`inline-block min-w-0 truncate${className ? ` ${className}` : ''}`}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        borderRadius: 16,
        padding: '1px 6px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.2px',
        textTransform: 'uppercase' as const,
        maxWidth: 160,
      }}
      title={tag}
    >
      {tag}
    </span>
  )
}

function ColorPickerRow({ tag, onColorChange }: { tag: string; onColorChange: (tag: string, colorKey: string) => void }) {
  const currentKey = getTagColorKey(tag)
  return (
    <div className="flex items-center gap-1 px-3 py-1.5" data-testid={`tag-color-picker-${tag}`}>
      {ACCENT_COLORS.map(c => (
        <button
          key={c.key}
          className="flex size-4 shrink-0 items-center justify-center rounded-full border-none p-0 transition-transform hover:scale-125"
          style={{ backgroundColor: c.css }}
          onClick={(e) => { e.stopPropagation(); onColorChange(tag, c.key) }}
          title={c.label}
          data-testid={`tag-color-option-${c.key}`}
        >
          {currentKey === c.key && (
            <span style={{ color: 'white', fontSize: 8, lineHeight: 1 }}>{'\u2713'}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function TagOption({
  tag, selected, highlighted, onToggle, onMouseEnter,
  colorEditing, onToggleColor, onColorChange,
}: {
  tag: string; selected: boolean; highlighted: boolean
  onToggle: (tag: string) => void; onMouseEnter: () => void
  colorEditing: boolean
  onToggleColor: (tag: string) => void; onColorChange: (tag: string, colorKey: string) => void
}) {
  const style = getTagStyle(tag)
  return (
    <>
      <div
        className="flex w-full items-center gap-1 px-2 py-1 transition-colors"
        style={{ borderRadius: 4, backgroundColor: highlighted ? 'var(--muted)' : 'transparent' }}
        onMouseEnter={onMouseEnter}
      >
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 border-none bg-transparent p-0 text-left"
          onClick={() => onToggle(tag)}
          data-testid={`tag-option-${tag}`}
        >
          <span className="w-3.5 text-center text-[10px]" style={{ color: style.color }}>
            {selected ? '\u2713' : ''}
          </span>
          <TagPill tag={tag} />
        </button>
        <button
          className="flex size-4 shrink-0 items-center justify-center rounded-full border-none p-0"
          style={{ backgroundColor: style.color }}
          onClick={() => onToggleColor(tag)}
          title="Change color"
          data-testid={`tag-color-swatch-${tag}`}
        />
      </div>
      {colorEditing && <ColorPickerRow tag={tag} onColorChange={onColorChange} />}
    </>
  )
}

const SECTION_LABEL_STYLE = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '1.2px',
  textTransform: 'uppercase' as const,
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-2 py-1">
      <span className="text-muted-foreground" style={SECTION_LABEL_STYLE}>{children}</span>
    </div>
  )
}

function useTagFiltering(query: string, vaultTags: string[]) {
  return useMemo(() => {
    const lowerQuery = query.toLowerCase()
    const filtered = vaultTags.filter(t => t.toLowerCase().includes(lowerQuery))
    return { filtered }
  }, [query, vaultTags])
}

function useTagKeyboard(opts: {
  filtered: string[]; totalOptions: number; showCreateOption: boolean
  query: string; selectedTags: Set<string>
  onToggle: (tag: string) => void; onClose: () => void
  listRef: React.RefObject<HTMLDivElement | null>
}) {
  const { filtered, totalOptions, showCreateOption, query, selectedTags, onToggle, onClose, listRef } = opts
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const scrollIntoView = useCallback((index: number) => {
    const list = listRef.current
    if (!list) return
    const items = list.querySelectorAll('[data-testid^="tag-option-"], [data-testid="tag-create-option"]')
    items[index]?.scrollIntoView({ block: 'nearest' })
  }, [listRef])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = highlightIndex < totalOptions - 1 ? highlightIndex + 1 : 0
          setHighlightIndex(next)
          scrollIntoView(next)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prev = highlightIndex > 0 ? highlightIndex - 1 : totalOptions - 1
          setHighlightIndex(prev)
          scrollIntoView(prev)
          break
        }
        case 'Enter': {
          e.preventDefault()
          const trimmed = query.trim()
          if (highlightIndex >= 0 && highlightIndex < filtered.length) {
            onToggle(filtered[highlightIndex])
          } else if (showCreateOption && highlightIndex === filtered.length && trimmed) {
            onToggle(trimmed)
          } else if (trimmed && !selectedTags.has(trimmed)) {
            onToggle(trimmed)
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [highlightIndex, totalOptions, filtered, showCreateOption, query, selectedTags, onToggle, onClose, scrollIntoView],
  )

  const resetHighlight = useCallback(() => setHighlightIndex(-1), [])

  return { highlightIndex, setHighlightIndex, handleKeyDown, resetHighlight }
}

export function TagsDropdown({
  selectedTags, vaultTags, onToggle, onClose,
}: {
  selectedTags: string[]; vaultTags: string[]
  onToggle: (tag: string) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [colorEditingTag, setColorEditingTag] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags])

  useLayoutEffect(() => {
    const node = dropdownRef.current
    if (!node) return
    const anchor = anchorRef.current?.parentElement
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const dropW = 208
    let left = rect.right - dropW
    if (left < 8) left = 8
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8
    node.style.top = `${rect.bottom + 4}px`
    node.style.left = `${left}px`
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  const { filtered } = useTagFiltering(query, vaultTags)

  const showCreateOption = useMemo(() => {
    if (!query.trim()) return false
    return !filtered.some(t => t.toLowerCase() === query.trim().toLowerCase())
  }, [query, filtered])

  const totalOptions = filtered.length + (showCreateOption ? 1 : 0)

  const { highlightIndex, setHighlightIndex, handleKeyDown, resetHighlight } =
    useTagKeyboard({ filtered, totalOptions, showCreateOption, query, selectedTags: selectedSet, onToggle, onClose, listRef })

  const handleToggleColor = useCallback((tag: string) => {
    setColorEditingTag(prev => prev === tag ? null : tag)
  }, [])

  const handleColorChange = useCallback((tag: string, colorKey: string) => {
    const currentKey = getTagColorKey(tag)
    setTagColor(tag, currentKey === colorKey ? null : colorKey)
    setColorEditingTag(null)
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    resetHighlight()
  }, [resetHighlight])

  return (
    <span ref={anchorRef} data-testid="tags-dropdown">
      {createPortal(
        <>
          <div className="fixed inset-0 z-[12000]" onClick={onClose} data-testid="tags-dropdown-backdrop" />
          <div
            ref={dropdownRef}
            className="fixed z-[12001] w-52 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
            data-testid="tags-dropdown-popover"
          >
            <div className="border-b border-border px-2 py-1.5">
              <input
                ref={inputRef}
                className="w-full border-none bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Type a tag..."
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid="tags-search-input"
              />
            </div>
            <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
              {filtered.length > 0 && (
                <div>
                  <SectionLabel>From vault</SectionLabel>
                  {filtered.map((tag, i) => (
                    <TagOption
                      key={tag} tag={tag}
                      selected={selectedSet.has(tag)}
                      highlighted={highlightIndex === i}
                      onToggle={onToggle}
                      onMouseEnter={() => setHighlightIndex(i)}
                      colorEditing={colorEditingTag === tag}
                      onToggleColor={handleToggleColor}
                      onColorChange={handleColorChange}
                    />
                  ))}
                </div>
              )}
              {showCreateOption && (
                <>
                  {filtered.length > 0 && <div className="my-1 h-px bg-border" />}
                  <button
                    className="flex w-full items-center gap-1.5 border-none bg-transparent px-2 py-1 text-left text-[11px] transition-colors"
                    style={{
                      borderRadius: 4,
                      backgroundColor: highlightIndex === filtered.length ? 'var(--muted)' : 'transparent',
                      color: 'var(--muted-foreground)',
                    }}
                    onClick={() => onToggle(query.trim())}
                    onMouseEnter={() => setHighlightIndex(filtered.length)}
                    data-testid="tag-create-option"
                  >
                    Create <TagPill tag={query.trim()} />
                  </button>
                </>
              )}
              {filtered.length === 0 && !showCreateOption && (
                <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                  No matching tags
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </span>
  )
}
