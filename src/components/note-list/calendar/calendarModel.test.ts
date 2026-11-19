import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import { visibleWeeks } from './calendarDates'
import {
  availableDateProperties,
  CREATED_DATE_PROPERTY,
  entryDateValue,
  itemsOnDay,
  layoutWeek,
  movedDates,
  partitionEntries,
  rescheduleWrites,
  resolveDateProperty,
  settlePendingDates,
  weekSegments,
  withoutPendingDates,
} from './calendarModel'

const sources = { dateProperty: 'start', endDateProperty: 'end' }
const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', properties: { start: '2026-11-19', end: '2026-11-24' } })
const review = makeEntry({ path: '/v/review.md', title: 'Review', properties: { start: '2026-11-19' } })
const someday = makeEntry({ path: '/v/someday.md', title: 'Someday', properties: {} })
const broken = makeEntry({ path: '/v/broken.md', title: 'Broken', properties: { start: 'soon' } })
const backwards = makeEntry({ path: '/v/back.md', title: 'Backwards', properties: { start: '2026-11-10', end: '2026-11-02' } })

describe('calendarModel', () => {
  it('places notes on their days and sets aside unscheduled and invalid ones', () => {
    const partition = partitionEntries([launch, review, someday, broken, backwards], sources, new Map())
    expect(partition.items.map((item) => [item.entry.title, item.start, item.end])).toEqual([
      ['Launch', '2026-11-19', '2026-11-24'],
      ['Review', '2026-11-19', '2026-11-19'],
      ['Backwards', '2026-11-10', '2026-11-10'],
    ])
    expect(partition.unscheduled.map((entry) => entry.title)).toEqual(['Someday'])
    expect(partition.invalid.map((entry) => entry.title)).toEqual(['Broken'])
  })

  it('lets a pending drop win until the vault reports the written dates', () => {
    const pending = new Map([[someday.path, { start: '2026-11-20', end: '2026-11-20' }]])
    expect(partitionEntries([someday], sources, pending).items[0].start).toBe('2026-11-20')
    expect(settlePendingDates(pending, [someday], sources).size).toBe(1)
    const written = { ...someday, properties: { start: '2026-11-20' } }
    expect(settlePendingDates(pending, [written], sources).size).toBe(0)
    expect(withoutPendingDates(pending, someday.path, { start: '2026-11-21', end: '2026-11-21' })).toBe(pending)
    expect(withoutPendingDates(pending, someday.path, { start: '2026-11-20', end: '2026-11-20' }).size).toBe(0)
  })

  it('splits a range into one bar per week row, marking where it continues', () => {
    const { items } = partitionEntries([launch, review], sources, new Map())
    const [first, second] = visibleWeeks('2026-11-19', 'month', 1).slice(3, 5)
    const firstRow = weekSegments(items, first)
    expect(firstRow.map((segment) => [segment.item.entry.title, segment.startColumn, segment.span, segment.lane])).toEqual([
      ['Launch', 3, 4, 0],
      ['Review', 3, 1, 1],
    ])
    expect(firstRow[0].continuesAfter).toBe(true)
    const secondRow = weekSegments(items, second)
    expect(secondRow).toHaveLength(1)
    expect(secondRow[0]).toMatchObject({ startColumn: 0, span: 2, continuesBefore: true, continuesAfter: false })
  })

  it('skips weekend-only items and clips ranges when weekends are hidden', () => {
    const weekendOnly = makeEntry({ path: '/v/sat.md', title: 'Saturday', properties: { start: '2026-11-21' } })
    const { items } = partitionEntries([launch, weekendOnly], sources, new Map())
    const weekdays = visibleWeeks('2026-11-19', 'week', 1)[0].slice(0, 5)
    const segments = weekSegments(items, weekdays)
    expect(segments.map((segment) => [segment.item.entry.title, segment.startColumn, segment.span])).toEqual([['Launch', 3, 2]])
    expect(segments[0].continuesAfter).toBe(true)
  })

  it('hides what does not fit behind "+N more" without leaving a bar half-shown', () => {
    const busy = Array.from({ length: 5 }, (_, index) => makeEntry({ path: `/v/${index}.md`, title: `Busy ${index}`, properties: { start: '2026-11-18' } }))
    const { items } = partitionEntries([...busy, launch], sources, new Map())
    const week = visibleWeeks('2026-11-19', 'week', 1)[0]
    const layout = layoutWeek(weekSegments(items, week), week.length, 3)
    expect(layout.visible.map((segment) => segment.item.entry.title)).toEqual(['Busy 0', 'Busy 1', 'Launch'])
    expect(layout.hiddenCounts).toEqual([0, 0, 3, 0, 0, 0, 0])
    expect(layoutWeek(weekSegments(items, week), week.length, 10).hiddenCounts.every((count) => count === 0)).toBe(true)
    expect(itemsOnDay(items, '2026-11-18')).toHaveLength(5)
  })

  it('moves a range by the drop offset and writes both of its dates', () => {
    const [item] = partitionEntries([launch], sources, new Map()).items
    const next = movedDates(item, '2026-11-20', '2026-11-27')
    expect(next).toEqual({ start: '2026-11-26', end: '2026-12-01' })
    expect(rescheduleWrites(item, next, sources)).toEqual([
      { property: 'start', value: '2026-11-26' },
      { property: 'end', value: '2026-12-01' },
    ])
    const [single] = partitionEntries([review], sources, new Map()).items
    expect(rescheduleWrites(single, movedDates(single, single.start, '2026-11-02'), sources)).toEqual([{ property: 'start', value: '2026-11-02' }])
  })

  it('offers date properties with the usual names first and defaults to the best one', () => {
    const entries = [
      makeEntry({ properties: { reviewed: '2026-01-02', due: '2026-01-03', owner: 'Ada' } }),
      makeEntry({ properties: { date: '2026-01-04' } }),
    ]
    const candidates = availableDateProperties(entries)
    expect(candidates).toEqual(['date', 'due', 'reviewed'])
    expect(resolveDateProperty(null, candidates)).toBe('date')
    expect(resolveDateProperty('reviewed', candidates)).toBe('reviewed')
    expect(resolveDateProperty(null, [])).toBeNull()
  })

  it('reads the created date as a read-only day', () => {
    const created = makeEntry({ createdAt: Date.UTC(2026, 10, 19, 12) / 1000 })
    expect(entryDateValue(created, CREATED_DATE_PROPERTY)).toBe('2026-11-19')
    expect(entryDateValue(makeEntry({ createdAt: null }), CREATED_DATE_PROPERTY)).toBeNull()
  })
})
