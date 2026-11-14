import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

// Scrolling down to within this distance (px) of the bottom re-pins.
const BOTTOM_THRESHOLD_PX = 24
// How long after an upward wheel, touch, or key input a scroll still counts as the user's own.
const USER_INPUT_WINDOW_MS = 300

const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])
const DOWN_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' '])

function distanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight
}

function keyDirection(event: KeyboardEvent): 'up' | 'down' | null {
  if (event.key === ' ') return event.shiftKey ? 'up' : 'down'
  if (UP_KEYS.has(event.key)) return 'up'
  return DOWN_KEYS.has(event.key) ? 'down' : null
}

/**
 * Watches the user's own scroll input on `element` and reports whether they are
 * scrolling up right now. Direction comes from the input itself, not from scrollTop,
 * because macOS rubber-banding moves scrollTop up at the bottom edge while the
 * trackpad is still pushing down. Returns a cleanup function as `dispose`.
 */
function trackUpwardScrollIntent(element: HTMLElement) {
  let lastUpInputAt = Number.NEGATIVE_INFINITY
  let lastTouchY: number | null = null
  let pointerDown = false

  const record = (direction: 'up' | 'down' | null) => {
    if (direction === 'up') lastUpInputAt = performance.now()
    else if (direction === 'down') lastUpInputAt = Number.NEGATIVE_INFINITY
  }
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY !== 0) record(event.deltaY < 0 ? 'up' : 'down')
  }
  const onKeyDown = (event: KeyboardEvent) => record(keyDirection(event))
  const onTouchStart = (event: TouchEvent) => { lastTouchY = event.touches[0]?.clientY ?? null }
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY
    if (y === undefined || lastTouchY === null) return
    // A finger moving down drags the content down, which scrolls the view up.
    if (y !== lastTouchY) record(y > lastTouchY ? 'up' : 'down')
    lastTouchY = y
  }
  const onPointerDown = () => { pointerDown = true }
  const onPointerUp = () => { pointerDown = false }

  const passive = { passive: true }
  element.addEventListener('wheel', onWheel, passive)
  element.addEventListener('keydown', onKeyDown)
  element.addEventListener('touchstart', onTouchStart, passive)
  element.addEventListener('touchmove', onTouchMove, passive)
  element.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)

  return {
    // Dragging the scrollbar has no direction of its own, so any upward move counts.
    isScrollingUp: () => pointerDown || performance.now() - lastUpInputAt < USER_INPUT_WINDOW_MS,
    dispose: () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    },
  }
}

/**
 * Keeps a scroll container pinned to its bottom while content streams in, but only
 * while the user is following along. Scrolling up unpins it; scrolling back to the
 * bottom re-pins it. A new turn (`turnKey` changes) always re-pins.
 *
 * Only an upward scroll the user causes (wheel, touch, keys, dragging the scrollbar) can
 * unpin. The browser also moves scrollTop up on its own, when layout shifts after sending
 * or when the view rubber-bands at the bottom edge, and those moves never count.
 *
 * The hook attaches its own listeners to the container. `contentKey` is any value that
 * changes whenever the content may have grown. `isPinned` drives a "jump to latest"
 * affordance, and `scrollToBottom` is what that affordance calls.
 */
export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  { turnKey, contentKey }: { turnKey: unknown; contentKey: unknown },
) {
  const pinnedRef = useRef(true)
  const lastScrollTopRef = useRef(0)
  const lastTurnKeyRef = useRef(turnKey)
  const isScrollingUpRef = useRef<() => boolean>(() => false)
  // The turn the user scrolled away from. Keyed by turn so a new turn reads as pinned
  // again without an effect having to reset state.
  const [unpinnedTurn, setUnpinnedTurn] = useState<{ key: unknown } | null>(null)

  const snapToBottom = useCallback(() => {
    pinnedRef.current = true
    const element = containerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    lastScrollTopRef.current = element.scrollTop
  }, [containerRef])

  const handleScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const movedUp = element.scrollTop < lastScrollTopRef.current
    lastScrollTopRef.current = element.scrollTop
    if (movedUp && isScrollingUpRef.current()) pinnedRef.current = false
    else if (distanceFromBottom(element) <= BOTTOM_THRESHOLD_PX) pinnedRef.current = true
    const pinned = pinnedRef.current
    const key = lastTurnKeyRef.current
    // Reuse the previous value while nothing changed so scrolling does not re-render.
    setUnpinnedTurn((current) => {
      if (pinned) return null
      return current?.key === key ? current : { key }
    })
  }, [containerRef])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const intent = trackUpwardScrollIntent(element)
    isScrollingUpRef.current = intent.isScrollingUp
    element.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', handleScroll)
      intent.dispose()
    }
  }, [containerRef, handleScroll])

  const scrollToBottom = useCallback(() => {
    snapToBottom()
    setUnpinnedTurn(null)
  }, [snapToBottom])

  useLayoutEffect(() => {
    void contentKey
    const startsNewTurn = turnKey !== lastTurnKeyRef.current
    lastTurnKeyRef.current = turnKey
    if (startsNewTurn || pinnedRef.current) snapToBottom()
  }, [snapToBottom, turnKey, contentKey])

  const isPinned = unpinnedTurn === null || unpinnedTurn.key !== turnKey
  return { isPinned, scrollToBottom }
}
