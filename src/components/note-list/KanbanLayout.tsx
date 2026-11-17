import './KanbanLayout.css'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, type DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { CollectionLayoutRendererProps } from '../../collections/layoutRegistry'
import { type AppLocale, translate } from '../../lib/i18n'
import { KanbanCardFace, type KanbanCardContext } from './KanbanCard'
import { KanbanColumn, type KanbanColumnActions, KanbanColumnHeader } from './KanbanColumn'
import { KanbanHiddenColumns } from './KanbanHiddenColumns'
import { columnId, columnTitle, groupEntries, hiddenColumnSummaries, orderColumns, visibleColumns } from './kanbanModel'
import { type KanbanActiveItem, kanbanCollisionDetection, useKanbanDrag, useKanbanSensors, usePendingMoves } from './useKanbanDrag'

type KanbanLayoutProps = Omit<CollectionLayoutRendererProps, 'listContent'>

const SETTLE_DROP_ANIMATION: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    className: { dragOverlay: 'kanban-overlay--dropping' },
    styles: { active: { opacity: '0' } },
  }),
}

function KanbanDragPreview({ active, context, locale, cardCount }: { active: KanbanActiveItem; context: KanbanCardContext; locale: AppLocale; cardCount: number }) {
  if (active?.kind === 'card') {
    return <div className="kanban-drag-lift"><KanbanCardFace entry={active.entry} context={context} className="kanban-card--lifted" /></div>
  }
  if (active?.kind === 'column') {
    return (
      <div className="kanban-drag-lift flex h-10 w-[272px] items-center rounded-xl bg-muted px-3 shadow-lg">
        <KanbanColumnHeader title={columnTitle(active.group, locale)} count={cardCount} />
      </div>
    )
  }
  return null
}

function activeColumnSize(active: KanbanActiveItem, grouped: Map<string, unknown[]>): number {
  if (active?.kind !== 'column') return 0
  return grouped.get(active.group)?.length ?? 0
}

type ColumnActionProps = Pick<KanbanLayoutProps, 'onToggleColumnCollapsed' | 'onToggleColumnHidden'>

/** Stable column actions that always call the latest handlers, so memoized columns skip re-rendering. */
function useColumnActions(props: ColumnActionProps): KanbanColumnActions {
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })
  return useMemo(() => ({
    onToggleCollapsed: (group) => latest.current.onToggleColumnCollapsed(group),
    onToggleHidden: (group) => latest.current.onToggleColumnHidden(group),
  }), [])
}

export function KanbanLayout(props: KanbanLayoutProps) {
  const { entries, allEntries, groupBy, properties, onOpen, locale, typeEntryMap, displayPropsOverride, selectedNotePath } = props
  const { columnOrder, onColumnOrderChange, onMove, collapsedColumns, hiddenColumns } = props
  const [pending, setPending] = usePendingMoves(entries, groupBy)
  const grouped = useMemo(() => groupEntries(entries, groupBy, pending), [entries, groupBy, pending])
  const columns = useMemo(() => orderColumns(grouped.keys(), columnOrder), [columnOrder, grouped])
  const shownColumns = useMemo(() => visibleColumns(columns, hiddenColumns), [columns, hiddenColumns])
  const columnActions = useColumnActions(props)
  const sensors = useKanbanSensors()
  const drag = useKanbanDrag({ groupBy, columns, pending, setPending, onMove, onColumnOrderChange })
  const context = useMemo<KanbanCardContext>(
    () => ({ cardProperties: properties, allEntries, typeEntryMap, displayPropsOverride, cardRole: translate(locale, 'layout.cardRole'), onOpen }),
    [allEntries, displayPropsOverride, locale, onOpen, properties, typeEntryMap],
  )
  const activeColumnCount = activeColumnSize(drag.active, grouped)
  const cardTarget = drag.crossColumnDrop ? drag.overGroup : undefined

  return (
    <DndContext sensors={sensors} collisionDetection={kanbanCollisionDetection} onDragStart={drag.onDragStart} onDragOver={drag.onDragOver} onDragEnd={drag.onDragEnd} onDragCancel={drag.onDragCancel}>
      <section className="kanban-board kanban-scroll flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3" data-testid="kanban-board" aria-label={translate(locale, 'layout.boardLabel', { property: groupBy })}>
        <SortableContext items={shownColumns.map(columnId)} strategy={horizontalListSortingStrategy}>
          {shownColumns.map((group) => (
            <KanbanColumn
              key={group || '__empty'}
              group={group}
              cards={grouped.get(group) ?? []}
              context={context}
              locale={locale}
              selectedNotePath={selectedNotePath}
              droppedPath={drag.droppedPath}
              isCardTarget={cardTarget === group}
              collapsed={collapsedColumns.includes(group)}
              actions={columnActions}
            />
          ))}
        </SortableContext>
        <KanbanHiddenColumns hidden={hiddenColumnSummaries(columns, hiddenColumns, grouped)} locale={locale} onShow={columnActions.onToggleHidden} />
      </section>
      {createPortal(
        <DragOverlay dropAnimation={drag.crossColumnDrop ? null : SETTLE_DROP_ANIMATION} zIndex={12000}>
          <KanbanDragPreview active={drag.active} context={context} locale={locale} cardCount={activeColumnCount} />
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
