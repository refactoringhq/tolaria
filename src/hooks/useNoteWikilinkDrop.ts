import { useEffect, useEffectEvent, type RefObject } from 'react'
import { readDraggedNotePath } from '../components/note-retargeting/noteDragData'
import { relativePathStem } from '../utils/wikilink'

const MARKDOWN_NOTE_PATH = /\.md$/i

interface UseNoteWikilinkDropOptions {
  containerRef: RefObject<HTMLElement | null>
  onInsertTarget: (target: string) => void
  vaultPath?: string
}

function droppedNoteWikilinkTarget(dataTransfer: DataTransfer | null, vaultPath?: string): string | null {
  if (!vaultPath) return null

  const notePath = readDraggedNotePath(dataTransfer)?.trim() ?? ''
  if (!MARKDOWN_NOTE_PATH.test(notePath)) return null

  return relativePathStem(notePath, vaultPath)
}

export function useNoteWikilinkDrop({
  containerRef,
  onInsertTarget,
  vaultPath,
}: UseNoteWikilinkDropOptions) {
  const handleDragOver = useEffectEvent((event: DragEvent) => {
    if (!droppedNoteWikilinkTarget(event.dataTransfer, vaultPath)) return

    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'link'
  })

  const handleDrop = useEffectEvent((event: DragEvent) => {
    const target = droppedNoteWikilinkTarget(event.dataTransfer, vaultPath)
    if (!target) return

    event.preventDefault()
    onInsertTarget(target)
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
  }, [containerRef])
}
