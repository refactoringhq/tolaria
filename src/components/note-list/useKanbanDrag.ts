import { type SetStateAction, useCallback, useEffect, useState } from 'react'
import {
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { VaultEntry } from '../../types'
import {
  type ColumnValue,
  columnFromId,
  groupValueFor,
  isCardId,
  moveColumn,
  type PendingMoves,
  type PropertyName,
  settlePendingMoves,
  withoutPendingMove,
} from './kanbanModel'

const DROP_HIGHLIGHT_MS = 420
/** A drop that the vault never confirms (for example a failed write) snaps back after this delay. */
const PENDING_MOVE_TIMEOUT_MS = 5000
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] }

export type KanbanActiveItem = { kind: 'card'; entry: VaultEntry; origin: ColumnValue } | { kind: 'column'; group: ColumnValue } | null
type SetPendingMoves = (update: SetStateAction<PendingMoves>) => void

interface KanbanDragOptions {
  groupBy: PropertyName
  columns: ColumnValue[]
  pending: PendingMoves
  setPending: SetPendingMoves
  onMove: (entry: VaultEntry, value: ColumnValue | null) => void
  onColumnOrderChange: (order: ColumnValue[]) => void
}

/** Prefer the column under the pointer; fall back to the nearest column for keyboard drags. */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

export function useKanbanSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES }),
  )
}

/** Optimistic column for dropped cards until the vault entry reports the written value. */
export function usePendingMoves(entries: VaultEntry[], groupBy: PropertyName) {
  const [state, setState] = useState(() => ({ entries, groupBy, pending: new Map() as PendingMoves }))
  let current = state
  if (state.entries !== entries || state.groupBy !== groupBy) {
    current = { entries, groupBy, pending: settlePendingMoves(state.pending, entries, groupBy) }
    setState(current)
  }
  const setPending = useCallback<SetPendingMoves>((update) => {
    setState((previous) => ({ ...previous, pending: typeof update === 'function' ? update(previous.pending) : update }))
  }, [])
  return [current.pending, setPending] as const
}

function useDroppedHighlight() {
  const [droppedPath, setDroppedPath] = useState<string | null>(null)
  useEffect(() => {
    if (!droppedPath) return
    const timer = window.setTimeout(() => setDroppedPath(null), DROP_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [droppedPath])
  return [droppedPath, setDroppedPath] as const
}

function activeItemFor(event: DragStartEvent, groupBy: PropertyName, pending: PendingMoves): KanbanActiveItem {
  const entry = event.active.data.current?.entry as VaultEntry | undefined
  if (isCardId(event.active.id) && entry) {
    return { kind: 'card', entry, origin: pending.get(entry.path) ?? groupValueFor(entry, groupBy) }
  }
  const group = columnFromId(event.active.id)
  return group === undefined ? null : { kind: 'column', group }
}

function useCardDrop({ setPending, onMove }: Pick<KanbanDragOptions, 'setPending' | 'onMove'>) {
  const [droppedPath, setDroppedPath] = useDroppedHighlight()
  const dropCard = useCallback((entry: VaultEntry, origin: ColumnValue, target: ColumnValue) => {
    if (target === origin) return
    setPending((current) => new Map(current).set(entry.path, target))
    window.setTimeout(() => setPending((current) => withoutPendingMove(current, entry.path, target)), PENDING_MOVE_TIMEOUT_MS)
    setDroppedPath(entry.path)
    onMove(entry, target || null)
  }, [onMove, setDroppedPath, setPending])
  return { droppedPath, dropCard }
}

function isCrossColumnDrop(active: KanbanActiveItem, overGroup: ColumnValue | undefined): boolean {
  if (active?.kind !== 'card' || overGroup === undefined) return false
  return overGroup !== active.origin
}

export function useKanbanDrag({ groupBy, columns, pending, setPending, onMove, onColumnOrderChange }: KanbanDragOptions) {
  const [active, setActive] = useState<KanbanActiveItem>(null)
  const [overGroup, setOverGroup] = useState<ColumnValue | undefined>(undefined)
  const { droppedPath, dropCard } = useCardDrop({ setPending, onMove })
  const reset = useCallback(() => {
    setActive(null)
    setOverGroup(undefined)
  }, [])
  const onDragStart = useCallback((event: DragStartEvent) => setActive(activeItemFor(event, groupBy, pending)), [groupBy, pending])
  const onDragOver = useCallback((event: DragOverEvent) => setOverGroup(columnFromId(event.over?.id)), [])
  const onDragEnd = useCallback((event: DragEndEvent) => {
    const target = columnFromId(event.over?.id)
    reset()
    if (!active || target === undefined) return
    if (active.kind === 'card') dropCard(active.entry, active.origin, target)
    else onColumnOrderChange(moveColumn(columns, active.group, target))
  }, [active, columns, dropCard, onColumnOrderChange, reset])
  return {
    active,
    overGroup,
    droppedPath,
    crossColumnDrop: isCrossColumnDrop(active, overGroup),
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: reset,
  }
}
