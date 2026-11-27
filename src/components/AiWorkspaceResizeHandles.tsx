import type { MouseEvent as ReactMouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { AiWorkspaceMode } from './aiWorkspaceSizing'

function startResizeDrag(
  event: ReactMouseEvent,
  cursor: string,
  onDrag: (deltaX: number, deltaY: number) => void,
) {
  event.preventDefault()
  event.stopPropagation()

  let lastX = event.clientX
  let lastY = event.clientY
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - lastX
    const deltaY = moveEvent.clientY - lastY
    lastX = moveEvent.clientX
    lastY = moveEvent.clientY
    onDrag(deltaX, deltaY)
  }
  const handleMouseUp = () => {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

export function WorkspaceResizeHandles({
  mode,
  onResize,
}: {
  mode: AiWorkspaceMode
  onResize: (deltaWidth: number, deltaHeight: number) => void
}) {
  if (mode === 'window') return null

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="Resize AI workspace horizontally"
        className="absolute inset-y-0 left-0 z-30 h-auto min-h-0 w-2 cursor-col-resize rounded-none bg-transparent p-0 transition-colors hover:bg-border"
        data-testid="ai-workspace-left-resize"
        onMouseDown={(event) => startResizeDrag(event, 'col-resize', (deltaX) => onResize(-deltaX, 0))}
      />
      {mode === 'docked' && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Resize AI workspace vertically"
          className="absolute top-0 right-0 left-0 z-30 h-2 min-h-0 w-auto cursor-row-resize rounded-none bg-transparent p-0 transition-colors hover:bg-border"
          data-testid="ai-workspace-top-resize"
          onMouseDown={(event) => startResizeDrag(event, 'row-resize', (_deltaX, deltaY) => onResize(0, -deltaY))}
        />
      )}
    </>
  )
}
