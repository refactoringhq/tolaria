import { describe, expect, it } from 'vitest'
import { LABEL_GAP_PX, type LabelCandidate, labelBoxFor, labelZoomOpacity, placeLabels } from './graphLabelPlacement'

const viewport = { width: 800, height: 600 }

function candidate(id: string, x: number, y: number, forced = false): LabelCandidate {
  return { id, x, y, radius: 6, width: 80, forced }
}

describe('graph label placement', () => {
  it('fades labels with zoom: full from the fade zoom, gone one halving below, shifted by the threshold', () => {
    expect(labelZoomOpacity(1, 0)).toBe(1)
    expect(labelZoomOpacity(2, 0)).toBe(1)
    expect(labelZoomOpacity(4, 0)).toBe(0)
    expect(labelZoomOpacity(2 * Math.SQRT2, 0)).toBeCloseTo(0.5)
    expect(labelZoomOpacity(2, 1)).toBe(0)
    expect(labelZoomOpacity(8, -2)).toBe(1)
  })

  it('hangs a label centred under its node, clear of the circle', () => {
    expect(labelBoxFor(candidate('a', 100, 50))).toEqual({ left: 60, top: 50 + 6 + LABEL_GAP_PX, right: 140, bottom: 79 })
  })

  it('labels every note that has room, in priority order', () => {
    const placed = placeLabels([candidate('a', 100, 100), candidate('b', 400, 100), candidate('c', 105, 104)], [], viewport, true)
    expect([...placed.keys()]).toEqual(['a', 'b'])
  })

  it("keeps labels off other notes' circles but not off their own", () => {
    const discs = [{ id: 'a', x: 100, y: 100, radius: 6 }, { id: 'crowd', x: 100, y: 120, radius: 6 }]
    expect(placeLabels([candidate('a', 100, 100)], discs, viewport, true).size).toBe(0)
    expect(placeLabels([candidate('a', 100, 100)], [discs[0]], viewport, true).size).toBe(1)
  })

  it('always shows forced labels, even when crowded or zoomed out, and skips off-screen ones', () => {
    const discs = [{ id: 'crowd', x: 100, y: 120, radius: 6 }]
    const placed = placeLabels([candidate('a', 100, 100, true), candidate('b', 105, 100, true), candidate('c', 500, 300), candidate('d', -400, 100)], discs, viewport, false)
    expect([...placed.keys()]).toEqual(['a', 'b'])
  })
})
