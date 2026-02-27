import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { getStatusStyle, getStatusColorKey, setStatusColor, SUGGESTED_STATUSES } from '../utils/statusStyles'
import { ACCENT_COLORS } from '../utils/typeColors'
import { useDropdownKeyboard } from '../hooks/useDropdownKeyboard'

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const style = getStatusStyle(status)
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
      title={status}
    >
      {status}
    </span>
  )
}

function ColorDot({ status, onClick }: { status: string; onClick: (e: React.MouseEvent) => void }) {
  const style = getStatusStyle(status)
  return (
    <button
      className="flex shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 transition-transform hover:scale-125"
      style={{ width: 12, height: 12 }}
      onClick={onClick}
      title="Change color"
      data-testid={`color-dot-${status}`}
    >
      <span className="block rounded-full" style={{ width: 10, height: 10, backgroundColor: style.color }} />
    </button>
  )
}

function ColorPalette({ status, onSelect }: {
  status: string; onSelect: (status: string, colorKey: string | null) => void
}) {
  const currentKey = getStatusColorKey(status)
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5"
      style={{ backgroundColor: 'var(--muted)', borderRadius: 4 }}
      data-testid={`color-palette-${status}`}
    >
      <button
        className="shrink-0 cursor-pointer border bg-transparent px-1.5 py-0.5 text-[10px] transition-colors hover:bg-background"
        style={{
          borderColor: 'var(--border)', borderRadius: 10,
          color: 'var(--muted-foreground)', fontWeight: currentKey === null ? 600 : 400,
        }}
        onClick={() => onSelect(status, null)}
        data-testid={`color-swatch-default-${status}`}
      >
        Default
      </button>
      {ACCENT_COLORS.map(ac => (
        <button
          key={ac.key}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-transform hover:scale-125"
          style={{ width: 16, height: 16 }}
          onClick={() => onSelect(status, ac.key)}
          title={ac.label}
          data-testid={`color-swatch-${ac.key}-${status}`}
        >
          <span
            className="block rounded-full"
            style={{
              width: 14, height: 14, backgroundColor: ac.css,
              outline: currentKey === ac.key ? '2px solid var(--foreground)' : 'none',
              outlineOffset: 1,
            }}
          />
        </button>
      ))}
    </div>
  )
}

function StatusOption({
  status, highlighted, pickerOpen, onSelect, onMouseEnter, onDotClick, onColorSelect,
}: {
  status: string; highlighted: boolean; pickerOpen: boolean
  onSelect: (status: string) => void; onMouseEnter: () => void
  onDotClick: (status: string) => void; onColorSelect: (status: string, colorKey: string | null) => void
}) {
  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 border-none bg-transparent px-2 py-1 text-left transition-colors"
        style={{ borderRadius: 4, backgroundColor: highlighted ? 'var(--muted)' : 'transparent' }}
        onClick={() => onSelect(status)}
        onMouseEnter={onMouseEnter}
        data-testid={`status-option-${status}`}
      >
        <ColorDot status={status} onClick={(e) => { e.stopPropagation(); onDotClick(status) }} />
        <StatusPill status={status} />
      </button>
      {pickerOpen && <ColorPalette status={status} onSelect={onColorSelect} />}
    </div>
  )
}

const SECTION_LABEL_STYLE = {
  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 500,
  letterSpacing: '1.2px', textTransform: 'uppercase' as const,
} as const

function StatusSection({ label, statuses, highlightOffset, highlightIndex, pickerStatus, onSave, setHighlightIndex, onDotClick, onColorSelect }: {
  label: string; statuses: string[]; highlightOffset: number; highlightIndex: number
  pickerStatus: string | null
  onSave: (v: string) => void; setHighlightIndex: (i: number) => void
  onDotClick: (s: string) => void; onColorSelect: (s: string, k: string | null) => void
}) {
  if (statuses.length === 0) return null
  return (
    <div>
      <div className="px-2 py-1">
        <span className="text-muted-foreground" style={SECTION_LABEL_STYLE}>{label}</span>
      </div>
      {statuses.map((status, i) => (
        <StatusOption
          key={status} status={status}
          highlighted={highlightIndex === highlightOffset + i}
          pickerOpen={pickerStatus === status}
          onSelect={onSave}
          onMouseEnter={() => setHighlightIndex(highlightOffset + i)}
          onDotClick={onDotClick} onColorSelect={onColorSelect}
        />
      ))}
    </div>
  )
}

function useStatusFilter(query: string, vaultStatuses: string[]) {
  return useMemo(() => {
    const lowerQuery = query.toLowerCase()
    const vaultSet = new Set(vaultStatuses.map(s => s.toLowerCase()))
    const suggested = SUGGESTED_STATUSES.filter(
      s => s.toLowerCase().includes(lowerQuery) && !vaultSet.has(s.toLowerCase()),
    )
    const vault = vaultStatuses.filter(s => s.toLowerCase().includes(lowerQuery))
    return { suggestedFiltered: suggested, vaultFiltered: vault, allFiltered: [...vault, ...suggested] }
  }, [query, vaultStatuses])
}

export function StatusDropdown({
  vaultStatuses, onSave, onCancel, onColorChange,
}: {
  value: string; vaultStatuses: string[]
  onSave: (newValue: string) => void; onCancel: () => void; onColorChange?: () => void
}) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [pickerStatus, setPickerStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const { suggestedFiltered, vaultFiltered, allFiltered } = useStatusFilter(query, vaultStatuses)

  const showCreateOption = useMemo(() => {
    if (!query.trim()) return false
    return !allFiltered.some(s => s.toLowerCase() === query.trim().toLowerCase())
  }, [query, allFiltered])

  const totalOptions = allFiltered.length + (showCreateOption ? 1 : 0)

  const { listRef, handleKeyDown } = useDropdownKeyboard({
    highlightIndex, setHighlightIndex, totalOptions,
    allFiltered, showCreateOption, query, onSave, onCancel,
  })

  const handleDotClick = useCallback((status: string) => {
    setPickerStatus(prev => (prev === status ? null : status))
  }, [])

  const handleColorSelect = useCallback((status: string, colorKey: string | null) => {
    setStatusColor(status, colorKey)
    setPickerStatus(null)
    onColorChange?.()
  }, [onColorChange])

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setHighlightIndex(-1)
  }, [])

  const sectionProps = {
    highlightIndex, pickerStatus, onSave, setHighlightIndex,
    onDotClick: handleDotClick, onColorSelect: handleColorSelect,
  }

  return (
    <div className="relative" data-testid="status-dropdown">
      <div className="fixed inset-0 z-40" onClick={onCancel} data-testid="status-dropdown-backdrop" />
      <div
        className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
        data-testid="status-dropdown-popover"
      >
        <div className="border-b border-border px-2 py-1.5">
          <input
            ref={inputRef}
            className="w-full border-none bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Type a status..."
            value={query} onChange={handleQueryChange} onKeyDown={handleKeyDown}
            data-testid="status-search-input"
          />
        </div>
        <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
          <StatusSection label="From vault" statuses={vaultFiltered} highlightOffset={0} {...sectionProps} />
          {vaultFiltered.length > 0 && suggestedFiltered.length > 0 && <div className="my-1 h-px bg-border" />}
          <StatusSection label="Suggested" statuses={suggestedFiltered} highlightOffset={vaultFiltered.length} {...sectionProps} />
          {showCreateOption && (
            <>
              {allFiltered.length > 0 && <div className="my-1 h-px bg-border" />}
              <button
                className="flex w-full items-center gap-1.5 border-none bg-transparent px-2 py-1 text-left text-[11px] transition-colors"
                style={{
                  borderRadius: 4,
                  backgroundColor: highlightIndex === allFiltered.length ? 'var(--muted)' : 'transparent',
                  color: 'var(--muted-foreground)',
                }}
                onClick={() => onSave(query.trim())}
                onMouseEnter={() => setHighlightIndex(allFiltered.length)}
                data-testid="status-create-option"
              >
                Create <StatusPill status={query.trim()} />
              </button>
            </>
          )}
          {allFiltered.length === 0 && !showCreateOption && (
            <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">No matching statuses</div>
          )}
        </div>
      </div>
    </div>
  )
}
