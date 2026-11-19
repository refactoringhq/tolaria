import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarLayoutBindings } from '../../../collections/layoutRegistry'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import type { VaultEntry } from '../../../types'
import { addDays } from './calendarDates'
import { CalendarLayout } from './CalendarLayout'

vi.mock('../../../lib/telemetry', () => ({ trackEvent: vi.fn() }))

const NOTE_COUNT = 5000
/** Generous JSDOM ceilings: they catch an accidental O(n²) path, not scheduler noise. */
const BUDGET_MS = { switch: 2500, navigate: 1500, drop: 1500 }

function largeList(): VaultEntry[] {
  return Array.from({ length: NOTE_COUNT }, (_, index) => makeEntry({
    path: `/vault/task-${index}.md`,
    title: `Task ${index}`,
    properties: index % 10 === 0 ? {} : { due: addDays('2026-01-01', index % 365), end: addDays('2026-01-01', (index % 365) + (index % 4)) },
  }))
}

const calendar: CalendarLayoutBindings = {
  settings: { dateProperty: 'due', endDateProperty: 'end', view: 'month', showWeekends: true },
  dateProperty: 'due',
  dateOptions: ['due', 'end'],
  canReschedule: true,
  onSettingsChange: vi.fn(),
  onReschedule: vi.fn().mockResolvedValue(undefined),
  onCreate: vi.fn(),
  onUseList: vi.fn(),
}

function timed(action: () => void): number {
  const start = performance.now()
  act(action)
  return performance.now() - start
}

describe('CalendarLayout on a large list', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 19, 12))
  })
  afterEach(() => vi.useRealTimers())

  it(`switches, navigates and applies a drop on ${NOTE_COUNT} notes within budget`, () => {
    const entries = largeList()
    const props = { allEntries: entries, properties: [], locale: 'en' as const, typeEntryMap: {}, onOpen: vi.fn(), calendar }
    let view: ReturnType<typeof render> | undefined
    const switchMs = timed(() => { view = render(<CalendarLayout entries={entries} {...props} />) })
    const navigateMs = timed(() => fireEvent.click(screen.getByTestId('calendar-next')))
    const moved = entries.map((entry, index) => (index === 1 ? { ...entry, properties: { due: '2026-12-10', end: '2026-12-10' } } : entry))
    const dropMs = timed(() => view?.rerender(<CalendarLayout entries={moved} {...props} />))

    process.stdout.write(`[calendar-perf] notes=${NOTE_COUNT} switch=${switchMs.toFixed(1)}ms navigate=${navigateMs.toFixed(1)}ms drop=${dropMs.toFixed(1)}ms\n`)
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('December 2026')
    expect(switchMs).toBeLessThan(BUDGET_MS.switch)
    expect(navigateMs).toBeLessThan(BUDGET_MS.navigate)
    expect(dropMs).toBeLessThan(BUDGET_MS.drop)
  })
})
