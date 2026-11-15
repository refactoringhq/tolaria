import { useMemo, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { type AppLocale, translate } from '../../lib/i18n'
import type { VaultEntry, VaultPropertyValue } from '../../types'

interface KanbanLayoutProps {
  entries: VaultEntry[]
  groupBy: string
  properties: string[]
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
  onOpen: (entry: VaultEntry, event: React.MouseEvent) => void
  onMove: (entry: VaultEntry, value: string | null) => void
  locale: AppLocale
}

function valueFor(entry: VaultEntry, property: string): string {
  const value = property === 'status' ? entry.status : entry.properties[property]
  if (Array.isArray(value)) return value.join(', ')
  return value === null || value === undefined ? '' : String(value)
}

function groupEntries(entries: VaultEntry[], property: string) {
  const groups = new Map<string, VaultEntry[]>()
  for (const entry of entries) {
    const value = valueFor(entry, property)
    const group = groups.get(value) ?? []
    group.push(entry)
    groups.set(value, group)
  }
  return groups
}

function orderColumns(values: string[], savedOrder: string[]) {
  return [...savedOrder.filter((value) => values.includes(value)), ...values.filter((value) => !savedOrder.includes(value))]
}

function moveColumn(columns: string[], index: number, direction: -1 | 1, onChange: (order: string[]) => void) {
  const target = index + direction
  if (target < 0 || target >= columns.length) return
  const next = [...columns]
  ;[next[index], next[target]] = [next[target], next[index]]
  onChange(next)
}

function droppedGroup(target: EventTarget | null): string | null | undefined {
  if (!(target instanceof Element)) return undefined
  const column = target.closest<HTMLElement>('[data-kanban-column]')
  return column ? column.dataset.kanbanColumn || null : undefined
}

function KanbanCard({ entry, properties, onOpen, onPointerStart }: { entry: VaultEntry; properties: string[]; onOpen: (entry: VaultEntry, event: React.MouseEvent) => void; onPointerStart: (entry: VaultEntry, event: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerStart(entry, event)}
      onClick={(event) => onOpen(entry, event)}
      className="block w-full rounded-md border border-border bg-card p-3 text-left shadow-sm hover:border-primary"
      data-testid="kanban-card"
    >
      <span className="block truncate text-sm font-medium">{entry.title}</span>
      {properties.map((property) => {
        const value: VaultPropertyValue | undefined = property === 'status' ? entry.status : entry.properties[property]
        if (value === null || value === undefined || value === '') return null
        return <span key={property} className="mt-2 block truncate text-xs text-muted-foreground">{property}: {Array.isArray(value) ? value.join(', ') : String(value)}</span>
      })}
    </button>
  )
}

function KanbanColumn({ group, cards, properties, onOpen, locale, onMoveColumn, onMoveStart }: {
  group: string
  cards: VaultEntry[]
  properties: string[]
  onOpen: (entry: VaultEntry, event: React.MouseEvent) => void
  locale: AppLocale
  onMoveColumn: (direction: -1 | 1) => void
  onMoveStart: (entry: VaultEntry, event: React.PointerEvent) => void
}) {
  const title = group || translate(locale, 'layout.noValue')
  return (
    <section
      className="flex h-full w-64 min-w-64 flex-col overflow-hidden rounded-md bg-muted/40"
      aria-label={`${title}, ${cards.length} notes`}
      data-kanban-column={group}
    >
      <h4 className="flex items-center border-b border-border px-3 py-2 text-sm font-semibold"><span>{title}<span className="ml-2 text-muted-foreground">{cards.length}</span></span><span className="ml-auto flex gap-1"><button type="button" aria-label={translate(locale, 'layout.moveColumnLeft', { column: title })} className="rounded px-1 hover:bg-muted" onClick={() => onMoveColumn(-1)}>←</button><button type="button" aria-label={translate(locale, 'layout.moveColumnRight', { column: title })} className="rounded px-1 hover:bg-muted" onClick={() => onMoveColumn(1)}>→</button></span></h4>
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <Virtuoso
          data={cards}
          style={{ height: '100%' }}
          computeItemKey={(_, entry) => entry.path}
          itemContent={(_, entry) => (
            <div className="pb-2">
            <KanbanCard entry={entry} properties={properties} onOpen={onOpen} onPointerStart={onMoveStart} />
            </div>
          )}
        />
      </div>
    </section>
  )
}

export function KanbanLayout({ entries, groupBy, properties, columnOrder, onColumnOrderChange, onOpen, onMove, locale }: KanbanLayoutProps) {
  const groupedEntries = useMemo(() => groupEntries(entries, groupBy), [entries, groupBy])
  const pendingDrag = useRef<{ entry: VaultEntry; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const values = [...[...groupedEntries.keys()].filter(Boolean).sort((left, right) => left.localeCompare(right)), '']
  const columns = orderColumns(values, columnOrder)
  const onMoveStart = (entry: VaultEntry, event: React.PointerEvent) => {
    if (event.button !== 0) return
    pendingDrag.current = { entry, x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const drag = pendingDrag.current
    pendingDrag.current = null
    if (!drag || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    const group = droppedGroup(event.target)
    if (group === undefined) return
    suppressClick.current = true
    onMove(drag.entry, group)
  }

  return (
    <section className="flex h-full min-h-0 gap-3 overflow-x-auto p-3" data-testid="kanban-board" aria-label={`Kanban grouped by ${groupBy}`} onPointerUp={onPointerUp} onPointerCancel={() => { pendingDrag.current = null }} onClickCapture={(event) => { if (!suppressClick.current) return; suppressClick.current = false; event.preventDefault(); event.stopPropagation() }}>
      {columns.map((group, index) => <KanbanColumn key={group || '__empty'} group={group} cards={groupedEntries.get(group) ?? []} properties={properties} onOpen={onOpen} locale={locale} onMoveColumn={(direction) => moveColumn(columns, index, direction, onColumnOrderChange)} onMoveStart={onMoveStart} />)}
    </section>
  )
}
