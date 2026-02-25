import { useRef, useEffect, type ComponentType, type SVGAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export interface NoteSearchResultItem {
  title: string
  noteType?: string
  typeColor?: string
  TypeIcon?: ComponentType<SVGAttributes<SVGSVGElement>>
}

interface NoteSearchListProps<T extends NoteSearchResultItem> {
  items: T[]
  selectedIndex: number
  getItemKey: (item: T, index: number) => string
  onItemClick: (item: T, index: number) => void
  onItemHover?: (index: number) => void
  emptyMessage?: string
  className?: string
}

export function NoteSearchList<T extends NoteSearchResultItem>({
  items,
  selectedIndex,
  getItemKey,
  onItemClick,
  onItemHover,
  emptyMessage = 'No results',
  className,
}: NoteSearchListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) {
    return (
      <div ref={listRef} className={cn('py-1', className)}>
        <div className="px-4 py-3 text-center text-[13px] text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div ref={listRef} className={cn('py-1', className)}>
      {items.map((item, i) => (
        <div
          key={getItemKey(item, i)}
          className={cn(
            'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 transition-colors',
            i === selectedIndex ? 'bg-accent' : 'hover:bg-secondary',
          )}
          onClick={() => onItemClick(item, i)}
          onMouseEnter={() => onItemHover?.(i)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-foreground">
            {item.TypeIcon && (
              <item.TypeIcon
                width={14}
                height={14}
                className="shrink-0"
                style={item.typeColor ? { color: item.typeColor } : undefined}
              />
            )}
            <span className="truncate">{item.title}</span>
          </span>
          {item.noteType && (
            <Badge
              variant="secondary"
              className="shrink-0 text-[11px]"
              style={item.typeColor ? { color: item.typeColor } : undefined}
            >
              {item.noteType}
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}
