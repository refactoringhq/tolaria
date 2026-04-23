import type { DragEvent, ReactNode } from 'react'
import { clearDraggedNotePath, writeDraggedNotePath } from './noteDragData'

interface DraggableNoteItemProps {
  notePath: string
  children: ReactNode
}

export function DraggableNoteItem({ notePath, children }: DraggableNoteItemProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    writeDraggedNotePath(event, notePath)
  }

  const handleDragEnd = () => {
    clearDraggedNotePath()
  }

  return (
    <div
      draggable
      data-testid={`draggable-note:${notePath}`}
      className="cursor-grab active:cursor-grabbing"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
    </div>
  )
}
