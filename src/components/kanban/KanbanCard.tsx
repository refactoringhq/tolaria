import { type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { VaultEntry } from '../../types'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { cn } from '@/lib/utils'

interface KanbanCardProps {
  entry: VaultEntry
  isSelected?: boolean
  isPlaceholder?: boolean
  dragOverlay?: boolean
  onClickNote: (entry: VaultEntry, event: ReactMouseEvent) => void
}

const CARD_BASE_CLASS = 'flex flex-col gap-1.5 rounded-md border bg-background p-3 text-sm shadow-sm transition-colors hover:border-foreground/30 hover:bg-muted/40'

export function KanbanCard({ entry, isSelected = false, isPlaceholder = false, dragOverlay = false, onClickNote }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.path,
    disabled: dragOverlay,
  })

  const placeholderStyle: CSSProperties = isPlaceholder || isDragging
    ? { opacity: 0, pointerEvents: 'none' }
    : {}

  const overlayStyle: CSSProperties = dragOverlay
    ? { cursor: 'grabbing', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.35)', transform: 'rotate(1.5deg)' }
    : {}

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={{ ...placeholderStyle, ...overlayStyle }}
      className={cn(
        CARD_BASE_CLASS,
        'select-none',
        isSelected && 'border-foreground/40 bg-muted/40',
        !dragOverlay && 'cursor-grab active:cursor-grabbing',
      )}
      {...(dragOverlay ? {} : listeners)}
      {...(dragOverlay ? {} : attributes)}
      onClick={(event) => {
        if (dragOverlay) return
        onClickNote(entry, event)
      }}
      data-testid={`kanban-card-${entry.path}`}
    >
      <div className="flex items-center gap-1.5 text-foreground">
        <NoteTitleIcon icon={entry.icon} size={14} />
        <span className="truncate font-medium">{entry.title || entry.filename}</span>
      </div>
      {entry.snippet ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{entry.snippet}</p>
      ) : null}
    </div>
  )
}
