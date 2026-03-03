import { useEffect } from 'react'

/**
 * Registers mouse button 3/4 (back/forward) and macOS trackpad two-finger
 * horizontal swipe gestures for navigation.
 */
export function useNavigationGestures({
  onGoBack,
  onGoForward,
}: {
  onGoBack: () => void
  onGoForward: () => void
}) {
  useEffect(() => {
    const handleMouseBack = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); onGoBack() }
      if (e.button === 4) { e.preventDefault(); onGoForward() }
    }
    window.addEventListener('mouseup', handleMouseBack)

    // Trackpad swipe: accumulate horizontal wheel delta and trigger on threshold
    let accumulatedDeltaX = 0
    let resetTimer: ReturnType<typeof setTimeout> | null = null
    const SWIPE_THRESHOLD = 120

    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal-dominant gestures (trackpad swipe)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      if (e.ctrlKey || e.metaKey) return // ignore pinch-zoom

      accumulatedDeltaX += e.deltaX

      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => { accumulatedDeltaX = 0 }, 300)

      if (accumulatedDeltaX > SWIPE_THRESHOLD) {
        accumulatedDeltaX = 0
        onGoForward()
      } else if (accumulatedDeltaX < -SWIPE_THRESHOLD) {
        accumulatedDeltaX = 0
        onGoBack()
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      window.removeEventListener('mouseup', handleMouseBack)
      window.removeEventListener('wheel', handleWheel)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [onGoBack, onGoForward])
}
