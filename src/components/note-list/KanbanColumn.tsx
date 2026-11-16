import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Virtuoso } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AppLocale, translate } from '../../lib/i18n'
import type { VaultEntry } from '../../types'
import { KanbanCard, type KanbanCardContext } from './KanbanCard'
import { columnId, columnLabel, columnTitle } from './kanbanModel'

export interface KanbanColumnProps {
  group: string
  cards: VaultEntry[]
  context: KanbanCardContext
  locale: AppLocale
  selectedNotePath?: string | null
  droppedPath: string | null
  isCardTarget: boolean
}

export function KanbanColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
      <span className="truncate">{title}</span>
      <span className="text-xs font-medium text-muted-foreground">{count}</span>
    </span>
  )
}

export const KanbanColumn = memo(function KanbanColumn({ group, cards, context, locale, selectedNotePath, droppedPath, isCardTarget }: KanbanColumnProps) {
  const title = columnTitle(group, locale)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: columnId(group),
    data: { group },
  })
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('kanban-column flex min-h-0 w-[272px] min-w-[272px] flex-col rounded-xl bg-muted/50', isCardTarget && 'kanban-column--target', isDragging && 'kanban-column--placeholder')}
      aria-label={columnLabel(title, cards.length, locale)}
      data-kanban-column={group}
      data-testid="kanban-column"
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        {...attributes}
        {...listeners}
        aria-roledescription={translate(locale, 'layout.columnRole')}
        aria-label={title}
        className="h-10 w-full shrink-0 cursor-grab justify-start rounded-t-xl rounded-b-none px-3 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <KanbanColumnHeader title={title} count={cards.length} />
      </Button>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <Virtuoso
          data={cards}
          className="kanban-scroll"
          style={{ height: '100%' }}
          computeItemKey={(_, entry) => entry.path}
          itemContent={(_, entry) => (
            <div className="pb-2">
              <KanbanCard entry={entry} context={context} selected={entry.path === selectedNotePath} justDropped={entry.path === droppedPath} />
            </div>
          )}
        />
      </div>
    </section>
  )
})
