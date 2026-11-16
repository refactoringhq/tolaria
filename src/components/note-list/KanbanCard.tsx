import { memo, type KeyboardEvent, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { PropertyChips } from '../note-item/PropertyChips'
import { cardDisplayProperties, cardId } from './kanbanModel'

export interface KanbanCardContext {
  cardProperties: string[]
  allEntries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
}

interface KanbanCardFaceProps {
  entry: VaultEntry
  context: KanbanCardContext
  className?: string
}

/** The visual card, shared by the in-column card and the lifted drag overlay. */
export function KanbanCardFace({ entry, context, className }: KanbanCardFaceProps) {
  const displayProps = cardDisplayProperties(entry, context.cardProperties, context.typeEntryMap, context.displayPropsOverride)
  return (
    <Card className={cn('kanban-card gap-0 rounded-lg px-3 py-2.5 text-left shadow-xs', className)}>
      <span className="block truncate text-[13px] font-medium text-foreground">{entry.title}</span>
      {displayProps.length > 0 && (
        <PropertyChips
          entry={entry}
          displayProps={displayProps}
          allEntries={context.allEntries}
          typeEntryMap={context.typeEntryMap}
          onOpenNote={context.onOpen}
        />
      )}
    </Card>
  )
}

function clickOnEnter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.click()
}

interface KanbanCardProps {
  entry: VaultEntry
  context: KanbanCardContext
  selected: boolean
  justDropped: boolean
}

export const KanbanCard = memo(function KanbanCard({ entry, context, selected, justDropped }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cardId(entry.path), data: { entry } })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="card"
      aria-label={entry.title}
      className={cn('kanban-card-slot rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring', isDragging && 'kanban-card-slot--placeholder')}
      onClick={(event) => context.onOpen(entry, event)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event)
        clickOnEnter(event)
      }}
      data-testid="kanban-card"
      data-selected={selected ? 'true' : undefined}
    >
      <KanbanCardFace entry={entry} context={context} className={cn(selected && 'kanban-card--selected', justDropped && 'kanban-card--dropped')} />
    </div>
  )
})
