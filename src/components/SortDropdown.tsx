import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { type SortOption, type SortDirection, DEFAULT_DIRECTIONS, SORT_OPTIONS } from '../utils/noteListHelpers'

export function SortDropdown({ groupLabel, current, direction, onChange }: {
  groupLabel: string
  current: SortOption
  direction: SortDirection
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

  return (
    <div ref={ref} className="relative" style={{ zIndex: open ? 10 : 0 }}>
      <button
        className={cn("flex items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent", open && "bg-accent text-foreground")}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        title={`Sort by ${current}`}
        data-testid={`sort-button-${groupLabel}`}
      >
        <DirectionIcon size={12} data-testid={`sort-direction-icon-${groupLabel}`} />
        <span className="text-[10px] font-medium">{SORT_OPTIONS.find((o) => o.value === current)?.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md" style={{ width: 150, padding: 4 }} data-testid={`sort-menu-${groupLabel}`}>
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.value === current
            return (
              <div
                key={opt.value}
                className={cn("flex w-full items-center justify-between rounded px-2 text-[12px] text-popover-foreground hover:bg-accent", isActive && "bg-accent font-medium")}
                style={{ height: 28, cursor: 'pointer', background: isActive ? 'var(--accent)' : 'transparent' }}
                data-testid={`sort-option-${opt.value}`}
                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value, isActive ? direction : DEFAULT_DIRECTIONS[opt.value]) }}
              >
                <span className="flex flex-1 items-center gap-1.5 text-inherit">
                  {opt.label}
                </span>
                <span className="flex items-center gap-0.5 ml-1">
                  <button
                    className={cn("flex items-center border-none bg-transparent cursor-pointer p-0 rounded hover:bg-background", isActive && direction === 'asc' ? 'text-foreground' : 'text-muted-foreground opacity-40')}
                    style={{ padding: 2 }}
                    onClick={(e) => { e.stopPropagation(); handleSelect(opt.value, 'asc') }}
                    data-testid={`sort-dir-asc-${opt.value}`}
                    title="Ascending"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    className={cn("flex items-center border-none bg-transparent cursor-pointer p-0 rounded hover:bg-background", isActive && direction === 'desc' ? 'text-foreground' : 'text-muted-foreground opacity-40')}
                    style={{ padding: 2 }}
                    onClick={(e) => { e.stopPropagation(); handleSelect(opt.value, 'desc') }}
                    data-testid={`sort-dir-desc-${opt.value}`}
                    title="Descending"
                  >
                    <ArrowDown size={12} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
