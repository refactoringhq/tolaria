import { memo, type ReactNode } from 'react'
import { ArrowLineLeft, EyeSlash } from '@phosphor-icons/react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Virtuoso } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AppLocale, translate } from '../../lib/i18n'
import type { VaultEntry } from '../../types'
import { KanbanCard, type KanbanCardContext } from './KanbanCard'
import { columnId, columnLabel, columnTitle } from './kanbanModel'
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME } from './NoteListHeader'

/** Column-level layout actions; they only change the layout config, never a note. */
export interface KanbanColumnActions {
  onToggleCollapsed: (group: string) => void
  onToggleHidden: (group: string) => void
}

export interface KanbanColumnProps {
  group: string
  cards: VaultEntry[]
  context: KanbanCardContext
  locale: AppLocale
  selectedNotePath?: string | null
  droppedPath: string | null
  isCardTarget: boolean
  collapsed: boolean
  actions: KanbanColumnActions
}

/** A column header or strip; the drag wiring comes from dnd-kit for whichever control activates a column drag. */
interface ColumnPartProps {
  group: string
  title: string
  count: number
  locale: AppLocale
  actions: KanbanColumnActions
  activatorRef: (element: HTMLElement | null) => void
  dragAttributes: DraggableAttributes
  dragListeners: DraggableSyntheticListeners
}

export function KanbanColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
      <span className="truncate">{title}</span>
      <span className="text-xs font-medium text-muted-foreground">{count}</span>
    </span>
  )
}

function ColumnActionButton({ label, testId, onClick, children }: { label: string; testId: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} title={label} aria-label={label} data-testid={testId} onClick={onClick}>
      {children}
    </Button>
  )
}

function ExpandedColumnHeader({ group, title, count, locale, actions, activatorRef, dragAttributes, dragListeners }: ColumnPartProps) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 pr-2">
      <Button
        ref={activatorRef}
        type="button"
        variant="ghost"
        {...dragAttributes}
        {...dragListeners}
        aria-roledescription={translate(locale, 'layout.columnRole')}
        aria-label={title}
        className="h-10 min-w-0 flex-1 cursor-grab justify-start rounded-tl-xl rounded-tr-none rounded-b-none px-3 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <KanbanColumnHeader title={title} count={count} />
      </Button>
      <ColumnActionButton label={translate(locale, 'layout.collapseColumn', { column: title })} testId="kanban-column-collapse" onClick={() => actions.onToggleCollapsed(group)}>
        <ArrowLineLeft size={16} />
      </ColumnActionButton>
      <ColumnActionButton label={translate(locale, 'layout.hideColumn', { column: title })} testId="kanban-column-hide" onClick={() => actions.onToggleHidden(group)}>
        <EyeSlash size={16} />
      </ColumnActionButton>
    </div>
  )
}

/** A collapsed column: a narrow vertical strip with its count and rotated name; one click expands it. */
function CollapsedColumnStrip({ group, title, count, locale, actions, activatorRef, dragAttributes, dragListeners }: ColumnPartProps) {
  const expandLabel = translate(locale, 'layout.expandColumn', { column: title })
  return (
    <Button
      ref={activatorRef}
      type="button"
      variant="ghost"
      {...dragAttributes}
      {...dragListeners}
      aria-roledescription={translate(locale, 'layout.columnRole')}
      aria-label={expandLabel}
      title={expandLabel}
      onClick={() => actions.onToggleCollapsed(group)}
      className="kanban-column-strip h-full min-h-0 w-full cursor-grab flex-col justify-start gap-2 rounded-xl px-0 py-3 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      data-testid="kanban-column-expand"
    >
      <span className="text-xs font-medium text-muted-foreground">{count}</span>
      <span className="kanban-column-strip__title text-[13px] font-semibold text-foreground">{title}</span>
    </Button>
  )
}

function ColumnCards({ cards, context, selectedNotePath, droppedPath }: Pick<KanbanColumnProps, 'cards' | 'context' | 'selectedNotePath' | 'droppedPath'>) {
  return (
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
  )
}

export const KanbanColumn = memo(function KanbanColumn(props: KanbanColumnProps) {
  const { group, cards, locale, isCardTarget, collapsed, actions } = props
  const title = columnTitle(group, locale)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: columnId(group),
    data: { group },
  })
  const part: ColumnPartProps = {
    group, title, count: cards.length, locale, actions, activatorRef: setActivatorNodeRef, dragAttributes: attributes, dragListeners: listeners,
  }
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'kanban-column flex min-h-0 shrink-0 flex-col rounded-xl bg-muted/50',
        collapsed ? 'kanban-column--collapsed w-10 min-w-10' : 'w-[272px] min-w-[272px]',
        isCardTarget && 'kanban-column--target',
        isDragging && 'kanban-column--placeholder',
      )}
      aria-label={columnLabel(title, cards.length, locale)}
      data-kanban-column={group}
      data-collapsed={collapsed ? 'true' : undefined}
      data-testid="kanban-column"
    >
      {collapsed ? <CollapsedColumnStrip {...part} /> : (
        <>
          <ExpandedColumnHeader {...part} />
          <ColumnCards cards={cards} context={props.context} selectedNotePath={props.selectedNotePath} droppedPath={props.droppedPath} />
        </>
      )}
    </section>
  )
})
