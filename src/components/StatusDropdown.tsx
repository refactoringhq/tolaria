import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { getStatusStyle, SUGGESTED_STATUSES } from '../utils/statusStyles'

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

function StatusOption({
  status,
  highlighted,
  onSelect,
  onMouseEnter,
}: {
  status: string
  highlighted: boolean
  onSelect: (status: string) => void
  onMouseEnter: () => void
}) {
  return (
    <button
      className="flex w-full items-center border-none bg-transparent px-2 py-1 text-left transition-colors"
      style={{
        borderRadius: 4,
        backgroundColor: highlighted ? 'var(--muted)' : 'transparent',
      }}
      onClick={() => onSelect(status)}
      onMouseEnter={onMouseEnter}
      data-testid={`status-option-${status}`}
    >
      <StatusPill status={status} />
    </button>
  )
}

export function StatusDropdown({
  vaultStatuses,
  onSave,
  onCancel,
}: {
  value: string
  vaultStatuses: string[]
  onSave: (newValue: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const { suggestedFiltered, vaultFiltered, allFiltered } = useMemo(() => {
    const lowerQuery = query.toLowerCase()
    const vaultSet = new Set(vaultStatuses.map(s => s.toLowerCase()))

    const suggested = SUGGESTED_STATUSES.filter(
      s => s.toLowerCase().includes(lowerQuery) && !vaultSet.has(s.toLowerCase()),
    )

    const vault = vaultStatuses.filter(s => s.toLowerCase().includes(lowerQuery))

    return {
      suggestedFiltered: suggested,
      vaultFiltered: vault,
      allFiltered: [...vault, ...suggested],
    }
  }, [query, vaultStatuses])

  const showCreateOption = useMemo(() => {
    if (!query.trim()) return false
    const lowerQuery = query.trim().toLowerCase()
    return !allFiltered.some(s => s.toLowerCase() === lowerQuery)
  }, [query, allFiltered])

  const totalOptions = allFiltered.length + (showCreateOption ? 1 : 0)

  const scrollHighlightedIntoView = useCallback((index: number) => {
    const list = listRef.current
    if (!list) return
    const items = list.querySelectorAll('[data-testid^="status-option-"], [data-testid="status-create-option"]')
    items[index]?.scrollIntoView({ block: 'nearest' })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = highlightIndex < totalOptions - 1 ? highlightIndex + 1 : 0
        setHighlightIndex(next)
        scrollHighlightedIntoView(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = highlightIndex > 0 ? highlightIndex - 1 : totalOptions - 1
        setHighlightIndex(prev)
        scrollHighlightedIntoView(prev)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < allFiltered.length) {
          onSave(allFiltered[highlightIndex])
        } else if (showCreateOption && highlightIndex === allFiltered.length) {
          onSave(query.trim())
        } else if (query.trim()) {
          onSave(query.trim())
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [highlightIndex, totalOptions, allFiltered, showCreateOption, query, onSave, onCancel, scrollHighlightedIntoView],
  )

  return (
    <div className="relative" data-testid="status-dropdown">
      {/* Backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onCancel} data-testid="status-dropdown-backdrop" />

      <div
        className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
        data-testid="status-dropdown-popover"
      >
        {/* Search input */}
        <div className="border-b border-border px-2 py-1.5">
          <input
            ref={inputRef}
            className="w-full border-none bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Type a status..."
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setHighlightIndex(-1)
            }}
            onKeyDown={handleKeyDown}
            data-testid="status-search-input"
          />
        </div>

        {/* Options list */}
        <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
          {vaultFiltered.length > 0 && (
            <div>
              <div className="px-2 py-1">
                <span
                  className="text-muted-foreground"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  From vault
                </span>
              </div>
              {vaultFiltered.map((status, i) => (
                <StatusOption
                  key={status}
                  status={status}
                  highlighted={highlightIndex === i}
                  onSelect={onSave}
                  onMouseEnter={() => setHighlightIndex(i)}
                />
              ))}
            </div>
          )}

          {suggestedFiltered.length > 0 && (
            <div>
              {vaultFiltered.length > 0 && (
                <div className="my-1 h-px bg-border" />
              )}
              <div className="px-2 py-1">
                <span
                  className="text-muted-foreground"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Suggested
                </span>
              </div>
              {suggestedFiltered.map((status, i) => (
                <StatusOption
                  key={status}
                  status={status}
                  highlighted={highlightIndex === vaultFiltered.length + i}
                  onSelect={onSave}
                  onMouseEnter={() => setHighlightIndex(vaultFiltered.length + i)}
                />
              ))}
            </div>
          )}

          {showCreateOption && (
            <>
              {allFiltered.length > 0 && <div className="my-1 h-px bg-border" />}
              <button
                className="flex w-full items-center gap-1.5 border-none bg-transparent px-2 py-1 text-left text-[11px] transition-colors"
                style={{
                  borderRadius: 4,
                  backgroundColor:
                    highlightIndex === allFiltered.length ? 'var(--muted)' : 'transparent',
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
            <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
              No matching statuses
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
