import { type MouseEvent as ReactMouseEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { VaultEntry } from '../../types'
import { useKanbanModel, type UseKanbanModelDeps } from '../../hooks/useKanbanModel'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps extends UseKanbanModelDeps {
  entries: VaultEntry[]
  selectedNotePath: string | null
  onSelectNote: (entry: VaultEntry, event: ReactMouseEvent) => void
  emptyMessage?: string
}

export function KanbanBoard({
  entries,
  selectedNotePath,
  onSelectNote,
  emptyMessage,
  ...modelDeps
}: KanbanBoardProps) {
  const { columns, handleDragEnd } = useKanbanModel(entries, modelDeps)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground" data-testid="kanban-empty">
        {emptyMessage ?? 'No notes match this board.'}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto p-3" data-testid="kanban-board">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status.key}
            status={column.status}
            cards={column.cards}
            selectedNotePath={selectedNotePath}
            onClickNote={onSelectNote}
          />
        ))}
      </div>
    </DndContext>
  )
}
