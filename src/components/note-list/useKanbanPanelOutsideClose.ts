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

type PressRef = { current: PressStart | null }

interface PanelListenerContext {
  root: HTMLElement
  press: PressRef
  close: () => void
}

/** The header is a window-drag region: its mousedown starts a native drag that swallows the click. */
function startsWindowDrag(root: HTMLElement, event: MouseEvent): boolean {
  return event.button === 0 && event.defaultPrevented && dismissesPanel(root, event.target)
}

function isDismissingClick(root: HTMLElement, start: PressStart | null, event: MouseEvent): boolean {
  if (!start?.dismisses || travelled(start, event) > MAX_CLICK_TRAVEL_PX) return false
  return dismissesPanel(root, event.target)
}

function panelListeners({ root, press, close }: PanelListenerContext) {
  return {
    pointerdown: (event: PointerEvent) => {
      press.current = { x: event.clientX, y: event.clientY, dismisses: dismissesPanel(root, event.target) }
    },
    mousedown: (event: MouseEvent) => {
      if (!startsWindowDrag(root, event)) return
      press.current = null
      close()
    },
    click: (event: MouseEvent) => {
      const start = press.current
      press.current = null
      if (isDismissingClick(root, start, event)) close()
    },
  }
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
    const listeners = panelListeners({ root, press, close })
    root.addEventListener('pointerdown', listeners.pointerdown)
    root.addEventListener('mousedown', listeners.mousedown)
    root.addEventListener('click', listeners.click)
    return () => {
      root.removeEventListener('pointerdown', listeners.pointerdown)
      root.removeEventListener('mousedown', listeners.mousedown)
      root.removeEventListener('click', listeners.click)
    }
  }, [close, open, rootRef])
}
