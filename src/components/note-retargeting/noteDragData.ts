import type { DragEvent } from 'react'

const NOTE_DRAG_MIME = 'application/x-laputa-note-path'
let activeDraggedNotePath: string | null = null

export function writeDraggedNotePath(event: DragEvent<HTMLElement>, notePath: string): void {
  activeDraggedNotePath = notePath
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(NOTE_DRAG_MIME, notePath)
  event.dataTransfer.setData('text/plain', notePath)
}

export function clearDraggedNotePath(): void {
  activeDraggedNotePath = null
}

export function readDraggedNotePath(dataTransfer: DataTransfer | null): string | null {
  if (!dataTransfer) return activeDraggedNotePath

  const customPath = dataTransfer.getData(NOTE_DRAG_MIME).trim()
  if (customPath) return customPath

  const fallbackPath = dataTransfer.getData('text/plain').trim()
  if (fallbackPath) return fallbackPath

  return activeDraggedNotePath
}
