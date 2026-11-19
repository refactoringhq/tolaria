import { act, renderHook } from '@testing-library/react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import type { VaultEntry } from '../../../types'
import type { CalendarItem } from './calendarModel'
import { dayDropId, dayFromDropId, useCalendarDrag, usePendingDates } from './useCalendarDrag'

const sources = { dateProperty: 'start', endDateProperty: 'end' }
const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', properties: { start: '2026-11-19', end: '2026-11-21' } })
const launchItem: CalendarItem = { entry: launch, start: '2026-11-19', end: '2026-11-21' }
const someday = makeEntry({ path: '/v/someday.md', title: 'Someday', properties: {} })

function startEvent(item: CalendarItem, fromTray = false) {
  return { active: { id: 'drag', data: { current: { item, fromTray } } } } as unknown as DragStartEvent
}

function overEvent(day: string | null) {
  return { over: day === null ? null : { id: dayDropId(day) } } as unknown as DragOverEvent & DragEndEvent
}

function setup(entries: VaultEntry[] = [launch, someday]) {
  const onDrop = vi.fn()
  const hook = renderHook(({ items }) => {
    const [pending, setPending] = usePendingDates(items, sources)
    return { drag: useCalendarDrag({ setPending, onDrop }), pending }
  }, { initialProps: { items: entries } })
  return { hook, onDrop }
}

describe('useCalendarDrag', () => {
  afterEach(() => vi.useRealTimers())

  it('round-trips day drop ids and ignores anything else', () => {
    expect(dayFromDropId(dayDropId('2026-11-19'))).toBe('2026-11-19')
    expect(dayFromDropId('kanban-column:Done')).toBeUndefined()
    expect(dayFromDropId(undefined)).toBeUndefined()
  })

  it('moves a range by the offset from the day it was picked up on, keeping its duration', () => {
    const { hook, onDrop } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(launchItem)))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-20')))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-27')))
    expect(hook.result.current.drag.preview).toEqual({ start: '2026-11-26', end: '2026-11-28' })

    act(() => hook.result.current.drag.onDragEnd(overEvent('2026-11-27')))

    expect(onDrop).toHaveBeenCalledWith({ item: launchItem, next: { start: '2026-11-26', end: '2026-11-28' }, fromTray: false })
    expect(hook.result.current.pending.get(launch.path)).toEqual({ start: '2026-11-26', end: '2026-11-28' })
    expect(hook.result.current.drag.droppedPath).toBe(launch.path)
  })

  it('schedules a tray note on the day it is dropped on', () => {
    const { hook, onDrop } = setup()
    const trayItem: CalendarItem = { entry: someday, start: '', end: '' }
    act(() => hook.result.current.drag.onDragStart(startEvent(trayItem, true)))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-24')))
    act(() => hook.result.current.drag.onDragEnd(overEvent('2026-11-24')))
    expect(onDrop).toHaveBeenCalledWith({ item: trayItem, next: { start: '2026-11-24', end: '2026-11-24' }, fromTray: true })
  })

  it('ignores drops back on the same day and drops outside the grid', () => {
    const { hook, onDrop } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(launchItem)))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-19')))
    act(() => hook.result.current.drag.onDragEnd(overEvent('2026-11-19')))
    act(() => hook.result.current.drag.onDragStart(startEvent(launchItem)))
    act(() => hook.result.current.drag.onDragEnd(overEvent(null)))
    expect(onDrop).not.toHaveBeenCalled()
    expect(hook.result.current.drag.active).toBeNull()
  })

  it('snaps an unconfirmed drop back, and settles once the vault reports the new dates', () => {
    vi.useFakeTimers()
    const { hook } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(launchItem)))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-19')))
    act(() => hook.result.current.drag.onDragEnd(overEvent('2026-11-22')))
    expect(hook.result.current.pending.size).toBe(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(hook.result.current.pending.size).toBe(0)

    act(() => hook.result.current.drag.onDragStart(startEvent(launchItem)))
    act(() => hook.result.current.drag.onDragOver(overEvent('2026-11-19')))
    act(() => hook.result.current.drag.onDragEnd(overEvent('2026-11-22')))
    const written = { ...launch, properties: { start: '2026-11-22', end: '2026-11-24' } }
    hook.rerender({ items: [written, someday] })
    expect(hook.result.current.pending.size).toBe(0)
  })
})
