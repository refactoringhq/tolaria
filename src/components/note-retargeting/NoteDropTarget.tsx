import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { clearDraggedNotePath, readDraggedNotePath } from './noteDragData'

type DropState = 'idle' | 'valid' | 'invalid'

interface NoteDropTargetProps {
  children: ReactNode
  className?: string
  validClassName?: string
  invalidClassName?: string
  canAcceptNotePath: (notePath: string) => boolean
  onDropNote: (notePath: string) => void | Promise<void>
}

export function NoteDropTarget({
  children,
  className,
  validClassName = 'ring-1 ring-primary/40 bg-primary/10',
  invalidClassName = 'ring-1 ring-destructive/35 bg-destructive/5',
  canAcceptNotePath,
  onDropNote,
}: NoteDropTargetProps) {
  const [dropState, setDropState] = useState<DropState>('idle')
  const dragDepthRef = useRef(0)

  const updateDropState = (event: DragEvent<HTMLDivElement>): string | null => {
    const notePath = readDraggedNotePath(event.dataTransfer)
    if (!notePath) return null

    const isValid = canAcceptNotePath(notePath)
    event.preventDefault()
    event.dataTransfer.dropEffect = isValid ? 'move' : 'none'
    setDropState(isValid ? 'valid' : 'invalid')
    return notePath
  }

  const resetDropState = () => {
    dragDepthRef.current = 0
    setDropState('idle')
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    const notePath = readDraggedNotePath(event.dataTransfer)
    if (!notePath) return
    dragDepthRef.current += 1
    updateDropState(event)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    updateDropState(event)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const notePath = readDraggedNotePath(event.dataTransfer)
    if (!notePath) return

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0 && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropState('idle')
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const notePath = updateDropState(event)
    if (!notePath) return

    const isValid = canAcceptNotePath(notePath)
    resetDropState()
    clearDraggedNotePath()
    if (!isValid) return
    void onDropNote(notePath)
  }

  return (
    <div
      className={cn(
        'rounded-[5px] transition-colors',
        className,
        dropState === 'valid' && validClassName,
        dropState === 'invalid' && invalidClassName,
      )}
      data-drop-state={dropState === 'idle' ? undefined : dropState}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  )
}
