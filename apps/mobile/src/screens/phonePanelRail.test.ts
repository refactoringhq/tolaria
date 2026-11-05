import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  phoneRailBounds, phoneRailDragOffset, phoneRailFrame, phoneRailIntent,
  phoneRailNearestState, phoneRailOffset, phoneRailSettleDurationMs, phoneRailSettleState,
} from './phonePanelRail'

const width = 390
const geometry = { width }
const states = ['sidebar', 'list', 'editor', 'properties'] as const

it('places the actual panes on one contiguous rail with a sidebar peek', () => {
  expect(states.map(state => phoneRailOffset(state, width)))
    .toEqual([0, -304, -694, -1084])
  expect(phoneRailFrame('list', width)).toEqual({ left: 304, width })
  expect(phoneRailFrame('editor', width)).toEqual({ left: 694, width })
})

it('keeps the exact same pane widths for every navigation position', () => {
  for (const viewport of [320, 390, 844]) {
    for (const state of states) {
      expect(phoneRailFrame(state, viewport).width).toBe(viewport)
    }
  }
})

it('clamps list drags to the sidebar and reserves leftward row swipes for actions', () => {
  const offset = phoneRailOffset('list', width)
  const bounds = phoneRailBounds(offset, width)
  expect(phoneRailDragOffset(offset, 900, bounds)).toBe(0)
  expect(phoneRailDragOffset(offset, -100, bounds)).toBe(offset)
  expect(phoneRailIntent(geometry, offset, { x: 160, y: 200, dx: -30, dy: 0 })).toBe('fail')
  expect(phoneRailIntent(geometry, offset, { x: 160, y: 200, dx: 30, dy: 0 })).toBe('move')
})

it('leaves vertical scrolling and editor text selection with their content', () => {
  const list = phoneRailOffset('list', width), editor = phoneRailOffset('editor', width)
  expect(phoneRailIntent(geometry, list, { x: 160, y: 200, dx: 10, dy: 20 })).toBe('fail')
  expect(phoneRailIntent(geometry, editor, { x: 160, y: 200, dx: 35, dy: 0 })).toBe('fail')
  expect(phoneRailIntent(geometry, editor, { x: 8, y: 200, dx: 35, dy: 0 })).toBe('move')
  expect(phoneRailIntent(geometry, editor, { x: 380, y: 200, dx: -35, dy: 0 })).toBe('move')
})

it('uses the visible edges inside landscape safe areas', () => {
  const landscape = { width: 728 }
  const offset = phoneRailOffset('editor', landscape.width)
  expect(phoneRailIntent(landscape, offset, { x: 8, y: 160, dx: 30, dy: 0 })).toBe('move')
  expect(phoneRailIntent(landscape, offset, { x: 720, y: 160, dx: -30, dy: 0 })).toBe('move')
  expect(phoneRailIntent(landscape, offset, { x: 400, y: 160, dx: 30, dy: 0 })).toBe('fail')
})

it('waits for horizontal intent without stealing a tap', () => {
  expect(phoneRailIntent(geometry, -304, { x: 40, y: 40, dx: 5, dy: 0 })).toBe('wait')
  expect(phoneRailIntent(geometry, -304, { x: 40, y: 40, dx: 15, dy: 12 })).toBe('wait')
})

it('can reverse an interrupted settle from its presented position without jumping', () => {
  const offset = -420, bounds = phoneRailBounds(offset, width)
  expect(phoneRailDragOffset(offset, 0, bounds)).toBe(offset)
  expect(phoneRailDragOffset(offset, -80, bounds)).toBe(-500)
  expect(phoneRailIntent(geometry, offset, { x: 8, y: 100, dx: -30, dy: 0 })).toBe('move')
  expect(phoneRailNearestState(-500, width)).toBe('editor')
})

it('settles only at real pane positions and never overscrolls the rail', () => {
  const origin = phoneRailOffset('editor', width), bounds = phoneRailBounds(origin, width)
  expect(phoneRailSettleState({ offset: origin + 20, velocity: 0, bounds, width })).toBe('editor')
  expect(phoneRailSettleState({ offset: origin + 220, velocity: 0, bounds, width })).toBe('list')
  expect(phoneRailSettleState({ offset: origin - 100, velocity: -1000, bounds, width })).toBe('properties')
  expect(phoneRailDragOffset(origin, -9000, bounds)).toBe(-1084)
})

it('shortens panel settle animation for faster flicks', () => {
  expect(phoneRailSettleDurationMs(0)).toBe(180)
  expect(phoneRailSettleDurationMs(500)).toBe(140)
  expect(phoneRailSettleDurationMs(-500)).toBe(140)
  expect(phoneRailSettleDurationMs(4_000)).toBe(60)
  expect(phoneRailSettleDurationMs(4_000, true)).toBe(0)
})

it('initializes captured helpers before the production worklet transform uses them', () => {
  const require = createRequire(import.meta.url)
  const presetRequire = createRequire(require.resolve('babel-preset-expo'))
  const babel = presetRequire('@babel/core')
  const folder = mkdtempSync(join(tmpdir(), 'tolaria-phone-worklets-'))
  try {
    for (const name of ['phoneWorkspaceTransitions', 'phonePanelRail']) {
      const source = new URL(`./${name}.ts`, import.meta.url).pathname
      const output = babel.transformFileSync(source, {
        configFile: new URL('../../babel.config.js', import.meta.url).pathname,
        babelrc: false,
      })
      writeFileSync(join(folder, `${name}.js`), output.code)
    }
    const load = createRequire(join(folder, 'entry.js'))
    const transformed: typeof import('./phonePanelRail') = load('./phonePanelRail.js')
    expect(transformed.phoneRailIntent(geometry, -304, { x: 8, y: 100, dx: 30, dy: 0 })).toBe('move')
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
