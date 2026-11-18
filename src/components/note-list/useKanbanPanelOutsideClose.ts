import { type RefObject, useEffect, useRef } from 'react'

/** Controls a click must not dismiss the panel through: cards open notes, buttons and menus act on the board. */
const KEEP_PANEL_SELECTOR = 'button, a, input, textarea, select, label, [role="button"], [role="menuitem"], [role="option"], [role="dialog"], [role="menu"], [role="listbox"], [contenteditable="true"]'

/** A press that travels further than this is a drag or a scroll, never a dismissing click. */
const MAX_CLICK_TRAVEL_PX = 4

interface PressStart {
  x: number
  y: number
  dismisses: boolean
}

interface KanbanPanelOutsideCloseOptions {
  rootRef: RefObject<HTMLElement | null>
  open: boolean
  close: () => void
}

/** True when the event landed on bare board, lane or header space inside the note list itself. */
function dismissesPanel(root: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !root.contains(target)) return false
  return target.closest(KEEP_PANEL_SELECTOR) === null
}

function travelled(start: PressStart, event: MouseEvent): number {
  return Math.hypot(event.clientX - start.x, event.clientY - start.y)
}

/**
 * Closes the Kanban editor panel when the user clicks empty board space, a lane background or the
 * note-list header, like the close button. Cards, controls, menus, drags and portals keep it open.
 */
export function useKanbanPanelOutsideClose({ rootRef, open, close }: KanbanPanelOutsideCloseOptions) {
  const press = useRef<PressStart | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!open || !root) return
    const onPointerDown = (event: PointerEvent) => {
      press.current = { x: event.clientX, y: event.clientY, dismisses: dismissesPanel(root, event.target) }
    }
    const onClick = (event: MouseEvent) => {
      const start = press.current
      press.current = null
      if (!start?.dismisses || travelled(start, event) > MAX_CLICK_TRAVEL_PX) return
      if (dismissesPanel(root, event.target)) close()
    }
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('click', onClick)
    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('click', onClick)
    }
  }, [close, open, rootRef])
}
