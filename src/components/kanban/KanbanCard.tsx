import { type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { VaultEntry } from '../../types'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { cn } from '@/lib/utils'

interface KanbanCardProps {
  entry: VaultEntry
  isSelected?: boolean
  onClickNote: (entry: VaultEntry, event: ReactMouseEvent) => void
}

const CARD_BASE_CLASS = 'flex select-none flex-col gap-1.5 rounded-md border bg-background p-3 text-sm shadow-sm transition-colors hover:border-foreground/30 hover:bg-muted/40'

export function KanbanCard({ entry, isSelected = false, onClickNote }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.path })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(CARD_BASE_CLASS, isSelected && 'border-foreground/40 bg-muted/40')}
      {...listeners}
      {...attributes}
      onClick={(event) => {
        if (isDragging) return
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
