import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { VaultEntry } from '../../types'
import { useKanbanModel, type UpdateStatusFn } from '../../hooks/useKanbanModel'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'

interface KanbanBoardProps {
  entries: VaultEntry[]
  selectedNotePath: string | null
  onSelectNote: (entry: VaultEntry, event: ReactMouseEvent) => void
  onUpdateStatus: UpdateStatusFn
  emptyMessage?: string
}

export function KanbanBoard({
  entries,
  selectedNotePath,
  onSelectNote,
  onUpdateStatus,
  emptyMessage,
}: KanbanBoardProps) {
  const { columns, handleDragEnd } = useKanbanModel(entries, onUpdateStatus)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeEntry = activeId ? entries.find((entry) => entry.path === activeId) ?? null : null

  const handleStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      void handleDragEnd(event)
    },
    [handleDragEnd],
  )

  const handleCancel = useCallback(() => setActiveId(null), [])

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground" data-testid="kanban-empty">
        {emptyMessage ?? 'No notes match this board.'}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-3" data-testid="kanban-board">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status.key}
            status={column.status}
            cards={column.cards}
            selectedNotePath={selectedNotePath}
            activeDragId={activeId}
            onClickNote={onSelectNote}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeEntry ? (
          <KanbanCard entry={activeEntry} onClickNote={() => undefined} dragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
