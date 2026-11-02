// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureNotes } from '../../fixtures/workspaceFixtures'
import { MobileSwipeableNoteRow } from './MobileSwipeableNoteRow'

const nativeSwipe = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => null>(() => null))
const input = vi.hoisted(() => ({
  onEnd: undefined as ((event: { translationX: number }) => void) | undefined,
  onLayout: undefined as ((event: { nativeEvent: { layout: { width: number } } }) => void) | undefined,
  onArchive: vi.fn(),
}))
vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({ default: nativeSwipe }))
vi.mock('react-native', () => ({ View: ({ children, onLayout }: { children: ReactNode; onLayout: typeof input.onLayout }) => {
  input.onLayout = onLayout
  return children
} }))
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  Gesture: { Pan: () => {
    const pan = {
      activeOffsetX: () => pan,
      failOffsetX: () => pan,
      failOffsetY: () => pan,
      onEnd: (handler: typeof input.onEnd) => { input.onEnd = handler; return pan },
    }
    return pan
  } },
}))
vi.mock('react-native-reanimated', () => ({
  useSharedValue: (initial: number) => {
    let value = initial
    return Object.freeze({ get: () => value, set: (next: number) => { value = next } })
  },
  runOnJS: (callback: unknown) => callback,
}))
vi.mock('../../ui/theme/useMobileTheme', () => ({ useMobileColors: () => ({ card: '#fff' }) }))
vi.mock('../../analytics/useMobileAnalytics', () => ({ useMobileAnalytics: () => ({ capture: vi.fn() }) }))
vi.mock('./MobileNoteSwipeActions', () => ({ MobileNoteSwipeActions: () => null }))

afterEach(() => { nativeSwipe.mockClear(); input.onArchive.mockClear() })

describe('note row input ownership', () => {
  it('leaves two-finger trackpad scrolling to the note list', () => {
    const props = renderRow()
    expect(props.enableTrackpadTwoFingerGesture).toBe(false)
    expect(props.renderLeftActions).toBeUndefined()
    expect(props.dragOffsetFromLeftEdge).toBe(Number.MAX_SAFE_INTEGER)
    expect(props.renderRightActions).toEqual(expect.any(Function))
  })

  it('does not install swipe actions on a disabled row', () => {
    renderRow(true)
    expect(nativeSwipe).not.toHaveBeenCalled()
  })

  it('uses the measured width to commit a full swipe with compiler-safe shared values', () => {
    renderRow()
    input.onLayout?.({ nativeEvent: { layout: { width: 300 } } })
    input.onEnd?.({ translationX: -290 })
    expect(input.onArchive).toHaveBeenCalledWith([fixtureNotes[0].id], !fixtureNotes[0].archived)
  })

  it('does not favorite or archive on a full right swipe', () => {
    renderRow()
    input.onLayout?.({ nativeEvent: { layout: { width: 300 } } })
    input.onEnd?.({ translationX: 290 })
    expect(input.onArchive).not.toHaveBeenCalled()
  })
})

function renderRow(disabled = false) {
  const root = createRoot(document.createElement('div'))
  try {
    flushSync(() => root.render(createElement(MobileSwipeableNoteRow, {
      note: fixtureNotes[0],
      disabled,
      children: 'Note',
      actions: { onArchive: input.onArchive, onDelete: vi.fn(), onToggleFavorite: vi.fn() },
    })))
    return nativeSwipe.mock.calls.at(-1)?.[0] as {
      enableTrackpadTwoFingerGesture?: boolean
      renderLeftActions?: unknown
      renderRightActions?: unknown
      dragOffsetFromLeftEdge?: number
    }
  } finally { root.unmount() }
}
