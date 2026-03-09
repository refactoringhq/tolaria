import { EditorView, ViewPlugin } from '@codemirror/view'

/**
 * Read the current CSS zoom factor from document.documentElement.
 * Returns 1 when no zoom is applied or the value is unparseable.
 *
 * Checks getComputedStyle first (real browsers return the decimal value),
 * then falls back to the inline style property (works in jsdom and test
 * environments where getComputedStyle doesn't report zoom).
 */
export function getDocumentZoom(): number {
  const computed = getComputedStyle(document.documentElement).zoom
  if (computed && computed !== 'normal') {
    const parsed = parseFloat(computed)
    if (parsed > 0 && isFinite(parsed)) return parsed
  }

  const inline = document.documentElement.style.getPropertyValue('zoom')
  if (inline && inline !== 'normal') {
    let value = parseFloat(inline)
    if (inline.endsWith('%')) value /= 100
    if (value > 0 && isFinite(value)) return value
  }

  return 1
}

/**
 * Convert viewport-space coordinates to CSS-space coordinates by
 * dividing by the zoom factor. When CSS zoom is applied to the root
 * element, mouse event clientX/clientY are in viewport space, but
 * Range.getClientRects() (used by CodeMirror's posAtCoords) may return
 * values in CSS space. Dividing by zoom aligns them.
 */
export function adjustCoordsForZoom(
  coords: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  if (zoom === 1) return coords
  return { x: coords.x / zoom, y: coords.y / zoom }
}

/**
 * Use the browser's native caretRangeFromPoint API to find the document
 * position at viewport coordinates. This API correctly handles CSS zoom
 * because it operates in the browser's own coordinate system.
 *
 * Returns null if the API is unavailable or the position is outside the
 * editor's content area.
 */
function caretPosFromPoint(
  view: EditorView,
  x: number,
  y: number,
): number | null {
  if (typeof document.caretRangeFromPoint !== 'function') return null

  const range = document.caretRangeFromPoint(x, y)
  if (!range) return null

  if (!view.contentDOM.contains(range.startContainer)) return null

  try {
    return view.posAtDOM(range.startContainer, range.startOffset)
  } catch {
    return null
  }
}

type Coords = { x: number; y: number }
type PosAndSide = { pos: number; assoc: -1 | 1 }

/**
 * CodeMirror extension that fixes cursor positioning at non-100% CSS zoom.
 *
 * When CSS `zoom` is applied to document.documentElement, CodeMirror's
 * posAtCoords breaks because it compares mouse event coordinates (viewport
 * space) against Range.getClientRects() values (which may be in CSS space
 * under zoom). This extension overrides posAtCoords and posAndSideAtCoords
 * on the EditorView instance with zoom-aware versions that:
 *
 * 1. Use document.caretRangeFromPoint() — the browser's native, zoom-aware
 *    coordinate-to-text API — to find the correct position.
 * 2. Fall back to the original method with coordinates divided by the zoom
 *    factor if caretRangeFromPoint is unavailable or returns no result.
 */
export function zoomCursorFix() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...args: any[]) => any

  return ViewPlugin.define((view) => {
    const origPosAtCoords: AnyFn =
      Object.getPrototypeOf(view).posAtCoords
    const origPosAndSideAtCoords: AnyFn =
      Object.getPrototypeOf(view).posAndSideAtCoords

    function zoomPosAtCoords(
      self: EditorView,
      coords: Coords,
      precise?: boolean,
    ): number | null {
      const zoom = getDocumentZoom()
      if (zoom === 1) return origPosAtCoords.call(self, coords, precise)

      const pos = caretPosFromPoint(self, coords.x, coords.y)
      if (pos !== null) return pos

      const adjusted = adjustCoordsForZoom(coords, zoom)
      return origPosAtCoords.call(self, adjusted, precise)
    }

    function zoomPosAndSideAtCoords(
      self: EditorView,
      coords: Coords,
      precise?: boolean,
    ): PosAndSide | null {
      const zoom = getDocumentZoom()
      if (zoom === 1)
        return origPosAndSideAtCoords.call(self, coords, precise)

      const pos = caretPosFromPoint(self, coords.x, coords.y)
      if (pos !== null) return { pos, assoc: 1 }

      const adjusted = adjustCoordsForZoom(coords, zoom)
      return origPosAndSideAtCoords.call(self, adjusted, precise)
    }

    // Override on the instance (shadows prototype methods)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(view as any).posAtCoords = function (
      this: EditorView,
      coords: Coords,
      precise?: boolean,
    ) {
      return zoomPosAtCoords(this, coords, precise)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(view as any).posAndSideAtCoords = function (
      this: EditorView,
      coords: Coords,
      precise?: boolean,
    ) {
      return zoomPosAndSideAtCoords(this, coords, precise)
    }

    return {
      destroy() {
        // Remove instance overrides, restoring prototype methods
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (view as any).posAtCoords
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (view as any).posAndSideAtCoords
      },
    }
  })
}
