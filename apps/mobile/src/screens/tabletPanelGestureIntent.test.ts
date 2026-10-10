import { expect, it } from 'vitest'
import { tabletPanelGestureIntent } from './tabletPanelGestureIntent'

const context = { width: 1366, left: 0, minimumLeft: -600, properties: 300 }

it('waits for horizontal intent and yields vertical movement to scrolling', () => {
  expect(tabletPanelGestureIntent(context, { x: 500, dx: -8, dy: 2 })).toBe('wait')
  expect(tabletPanelGestureIntent(context, { x: 500, dx: -10, dy: 18 })).toBe('fail')
  expect(tabletPanelGestureIntent(context, { x: 500, dx: -30, dy: 8 })).toBe('left')
})

it('uses the whole note list for sequential collapse, not just an edge', () => {
  expect(tabletPanelGestureIntent(context, { x: 450, dx: -30, dy: 0 })).toBe('left')
  expect(tabletPanelGestureIntent({ ...context, left: -260 }, { x: 450, dx: -30, dy: 0 })).toBe('left')
  expect(tabletPanelGestureIntent({ ...context, left: -600 }, { x: 450, dx: -30, dy: 0 })).toBe('fail')
})

it('opens Properties only from the right edge and closes it from its own surface', () => {
  expect(tabletPanelGestureIntent(context, { x: 1350, dx: -30, dy: 0 })).toBe('properties')
  expect(tabletPanelGestureIntent({ ...context, properties: 0 }, { x: 1100, dx: 30, dy: 0 })).toBe('properties')
  expect(tabletPanelGestureIntent({ ...context, properties: 0 }, { x: 500, dx: -30, dy: 0 })).toBe('left')
})
