import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { type SortOption, type SortDirection, getDefaultDirection, SORT_OPTIONS, getSortOptionLabel } from '../utils/noteListHelpers'

export function SortDropdown({ groupLabel, current, direction, customProperties, onChange }: {
  groupLabel: string
  current: SortOption
  direction: SortDirection
  customProperties?: string[]
  onChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSelect = (opt: SortOption, dir: SortDirection) => {
    onChange(groupLabel, opt, dir)
    setOpen(false)
  }

  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown
  const hasCustom = customProperties && customProperties.length > 0

  return (
    <div ref={ref} className="relative" style={{ zIndex: open ? 10 : 0 }}>
      <button
        className={cn("flex items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent", open && "bg-accent text-foreground")}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        title={`Sort by ${getSortOptionLabel(current)}`}
        data-testid={`sort-button-${groupLabel}`}
      >
        <DirectionIcon size={12} data-testid={`sort-direction-icon-${groupLabel}`} />
        <span className="text-[10px] font-medium">{getSortOptionLabel(current)}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md"
          style={{ width: 170, padding: 4, maxHeight: 280, overflowY: 'auto' }}
          data-testid={`sort-menu-${groupLabel}`}
        >
          {SORT_OPTIONS.map((opt) => (
            <SortRow key={opt.value} value={opt.value} label={opt.label} current={current} direction={direction} onSelect={handleSelect} />
          ))}
          {hasCustom && (
            <>
              <div className="mx-2 my-1 border-t border-border" data-testid="sort-separator" />
              {customProperties.map((key) => {
                const value: SortOption = `property:${key}`
                return <SortRow key={value} value={value} label={key} current={current} direction={direction} onSelect={handleSelect} />
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SortRow({ value, label, current, direction, onSelect }: {
  value: SortOption
  label: string
  current: SortOption
  direction: SortDirection
  onSelect: (opt: SortOption, dir: SortDirection) => void
}) {
  const isActive = value === current
  return (
    <div
      className={cn("flex w-full items-center justify-between rounded px-2 text-[12px] text-popover-foreground hover:bg-accent", isActive && "bg-accent font-medium")}
      style={{ height: 28, cursor: 'pointer', background: isActive ? 'var(--accent)' : 'transparent' }}
      data-testid={`sort-option-${value}`}
      onClick={(e) => { e.stopPropagation(); onSelect(value, isActive ? direction : getDefaultDirection(value)) }}
    >
      <span className="flex flex-1 items-center gap-1.5 text-inherit truncate">
        {label}
      </span>
      <span className="flex items-center gap-0.5 ml-1 shrink-0">
        <button
          className={cn("flex items-center border-none bg-transparent cursor-pointer p-0 rounded hover:bg-background", isActive && direction === 'asc' ? 'text-foreground' : 'text-muted-foreground opacity-40')}
          style={{ padding: 2 }}
          onClick={(e) => { e.stopPropagation(); onSelect(value, 'asc') }}
          data-testid={`sort-dir-asc-${value}`}
          title="Ascending"
        >
          <ArrowUp size={12} />
        </button>
        <button
          className={cn("flex items-center border-none bg-transparent cursor-pointer p-0 rounded hover:bg-background", isActive && direction === 'desc' ? 'text-foreground' : 'text-muted-foreground opacity-40')}
          style={{ padding: 2 }}
          onClick={(e) => { e.stopPropagation(); onSelect(value, 'desc') }}
          data-testid={`sort-dir-desc-${value}`}
          title="Descending"
        >
          <ArrowDown size={12} />
        </button>
      </span>
    </div>
  )
}
