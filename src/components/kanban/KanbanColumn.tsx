import { type MouseEvent as ReactMouseEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { VaultEntry } from '../../types'
import type { KanbanStatusDef } from '../../utils/kanbanStatuses'
import { KanbanCard } from './KanbanCard'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  status: KanbanStatusDef
  cards: VaultEntry[]
  selectedNotePath: string | null
  activeDragId?: string | null
  onClickNote: (entry: VaultEntry, event: ReactMouseEvent) => void
}

export function KanbanColumn({ status, cards, selectedNotePath, activeDragId = null, onClickNote }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex h-full min-w-[220px] max-w-[320px] flex-1 basis-[260px] flex-col overflow-hidden rounded-lg border bg-muted/20 transition-colors',
        isOver && 'border-foreground/40 bg-muted/40',
      )}
      data-testid={`kanban-column-${status.key}`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b bg-background/50 px-3 py-2">
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: 999, background: status.color }}
        />
        <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {status.label}
        </span>
        {!status.canonical ? (
          <span className="text-[10px] uppercase text-muted-foreground" title="Custom status">custom</span>
        ) : null}
        <span
          className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          data-testid={`kanban-column-count-${status.key}`}
        >
          {cards.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>
        ) : (
          cards.map((entry) => (
            <KanbanCard
              key={entry.path}
              entry={entry}
              isSelected={selectedNotePath === entry.path}
              isPlaceholder={activeDragId === entry.path}
              onClickNote={onClickNote}
            />
          ))
        )}
      </div>
    </section>
  )
}
