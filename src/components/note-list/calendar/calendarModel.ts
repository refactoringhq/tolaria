import type { VaultEntry } from '../../../types'
import { addDays, type DayKey, daysBetween, localDayKey, parseCalendarDate, rescheduledValue } from './calendarDates'

/** Read-only date sources every note has; a calendar on them can show notes but never reschedule them. */
export const CREATED_DATE_PROPERTY = '$created'
export const MODIFIED_DATE_PROPERTY = '$modified'
const TIMESTAMP_PROPERTIES = [CREATED_DATE_PROPERTY, MODIFIED_DATE_PROPERTY]

/** Names preferred as the default date property, in order. */
const PREFERRED_DATE_PROPERTIES = ['date', 'due', 'start', 'scheduled']

export interface CalendarItem {
  entry: VaultEntry
  start: DayKey
  end: DayKey
}

export interface CalendarDates {
  start: DayKey
  end: DayKey
}

/** Optimistic dates for dropped items, until the vault reports the written values. */
export type PendingDates = Map<string, CalendarDates>

export interface CalendarSources {
  dateProperty: string
  endDateProperty: string | null
}

export interface CalendarPartition {
  items: CalendarItem[]
  /** Notes with no value for the date property. */
  unscheduled: VaultEntry[]
  /** Notes whose date property holds something that is not a date. */
  invalid: VaultEntry[]
}

/** One item's bar within a single week row. */
export interface CalendarSegment {
  item: CalendarItem
  startColumn: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

export interface WeekLayout {
  visible: CalendarSegment[]
  /** Items per day that did not fit and sit behind "+N more". */
  hiddenCounts: number[]
  /** The days with a "+N more", with their column and count. */
  overflow: { day: DayKey; column: number; count: number }[]
}

export function isTimestampProperty(property: string): boolean {
  return TIMESTAMP_PROPERTIES.includes(property)
}

function timestampDay(seconds: number | null): string | null {
  return seconds ? localDayKey(new Date(seconds * 1000)) : null
}

export function entryDateValue(entry: VaultEntry, property: string): unknown {
  if (property === CREATED_DATE_PROPERTY) return timestampDay(entry.createdAt)
  if (property === MODIFIED_DATE_PROPERTY) return timestampDay(entry.modifiedAt)
  return Reflect.get(entry.properties, property)
}

function endFor(entry: VaultEntry, start: DayKey, endDateProperty: string | null): DayKey {
  if (!endDateProperty) return start
  const end = parseCalendarDate(entryDateValue(entry, endDateProperty))
  return end.kind === 'day' && end.day > start ? end.day : start
}

/** Places each note on its day, or sets it aside as unscheduled or invalid; pending drops win. */
export function partitionEntries(entries: VaultEntry[], sources: CalendarSources, pending: PendingDates): CalendarPartition {
  const partition: CalendarPartition = { items: [], unscheduled: [], invalid: [] }
  for (const entry of entries) {
    const optimistic = pending.get(entry.path)
    if (optimistic) {
      partition.items.push({ entry, ...optimistic })
      continue
    }
    const parsed = parseCalendarDate(entryDateValue(entry, sources.dateProperty))
    if (parsed.kind === 'day') partition.items.push({ entry, start: parsed.day, end: endFor(entry, parsed.day, sources.endDateProperty) })
    else if (parsed.kind === 'empty') partition.unscheduled.push(entry)
    else partition.invalid.push(entry)
  }
  return partition
}

/** Pending drops the vault has caught up with are dropped, so later external edits show through. */
export function settlePendingDates(pending: PendingDates, entries: VaultEntry[], sources: CalendarSources): PendingDates {
  if (pending.size === 0) return pending
  const settled = new Map(pending)
  const actual = partitionEntries(entries.filter((entry) => pending.has(entry.path)), sources, new Map())
  for (const item of actual.items) {
    const expected = pending.get(item.entry.path)
    if (expected?.start === item.start && expected.end === item.end) settled.delete(item.entry.path)
  }
  return settled
}

export function withoutPendingDates(pending: PendingDates, path: string, dates: CalendarDates): PendingDates {
  const current = pending.get(path)
  if (!current || current.start !== dates.start || current.end !== dates.end) return pending
  const next = new Map(pending)
  next.delete(path)
  return next
}

export function itemsInRange(items: CalendarItem[], first: DayKey, last: DayKey): CalendarItem[] {
  return items.filter((item) => item.start <= last && item.end >= first)
}

function compareItems(left: CalendarItem, right: CalendarItem): number {
  if (left.start !== right.start) return left.start < right.start ? -1 : 1
  const length = daysBetween(right.start, right.end) - daysBetween(left.start, left.end)
  return length !== 0 ? length : left.entry.title.localeCompare(right.entry.title)
}

export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort(compareItems)
}

function lastColumnOnOrBefore(week: DayKey[], day: DayKey): number {
  let column = -1
  week.forEach((candidate, index) => {
    if (candidate <= day) column = index
  })
  return column
}

/** The item's bar in a row of shown days; null when it only falls on hidden days (weekends turned off). */
function segmentFor(item: CalendarItem, week: DayKey[]): Omit<CalendarSegment, 'lane'> | null {
  const startColumn = week.findIndex((day) => day >= item.start)
  const endColumn = lastColumnOnOrBefore(week, item.end)
  if (startColumn === -1 || endColumn < startColumn) return null
  return {
    item,
    startColumn,
    span: endColumn - startColumn + 1,
    continuesBefore: item.start < week[0],
    continuesAfter: item.end > week[week.length - 1],
  }
}

function firstFreeLane(laneEnds: number[], startColumn: number): number {
  const lane = laneEnds.findIndex((end) => end < startColumn)
  return lane === -1 ? laneEnds.length : lane
}

/** Stacks a week's items into lanes, earliest and longest first, so a bar keeps one lane across its days. */
export function weekSegments(items: CalendarItem[], week: DayKey[]): CalendarSegment[] {
  const laneEnds: number[] = []
  const segments: CalendarSegment[] = []
  for (const item of sortItems(itemsInRange(items, week[0], week[week.length - 1]))) {
    const segment = segmentFor(item, week)
    if (!segment) continue
    const lane = firstFreeLane(laneEnds, segment.startColumn)
    laneEnds.splice(lane, 1, segment.startColumn + segment.span - 1)
    segments.push({ ...segment, lane })
  }
  return segments
}

function coveredColumns(segment: CalendarSegment): number[] {
  return Array.from({ length: segment.span }, (_, index) => segment.startColumn + index)
}

type ColumnCounts = Map<number, number>

function laneDepths(segments: CalendarSegment[]): ColumnCounts {
  const depths: ColumnCounts = new Map()
  for (const segment of segments) {
    for (const column of coveredColumns(segment)) depths.set(column, Math.max(depths.get(column) ?? 0, segment.lane + 1))
  }
  return depths
}

function fitsLastLane(segment: CalendarSegment, depths: ColumnCounts, maxLanes: number): boolean {
  return coveredColumns(segment).every((column) => (depths.get(column) ?? 0) <= maxLanes)
}

/**
 * Keeps the bars that fit in `maxLanes`. A day that overflows gives its last lane to "+N more", so a bar in
 * that lane only shows when every day it covers fits completely.
 */
export function layoutWeek(segments: CalendarSegment[], week: DayKey[], maxLanes: number): WeekLayout {
  const depths = laneDepths(segments)
  const hidden: ColumnCounts = new Map()
  const visible: CalendarSegment[] = []
  for (const segment of segments) {
    const shown = segment.lane < maxLanes - 1 || (segment.lane === maxLanes - 1 && fitsLastLane(segment, depths, maxLanes))
    if (shown) visible.push(segment)
    else coveredColumns(segment).forEach((column) => hidden.set(column, (hidden.get(column) ?? 0) + 1))
  }
  const hiddenCounts = week.map((_, column) => hidden.get(column) ?? 0)
  const overflow = week.flatMap((day, column) => (hidden.has(column) ? [{ day, column, count: hidden.get(column) ?? 0 }] : []))
  return { visible, hiddenCounts, overflow }
}

export function itemsOnDay(items: CalendarItem[], day: DayKey): CalendarItem[] {
  return sortItems(itemsInRange(items, day, day))
}

/** Dates after a drop: the whole range moves by the same number of days, so its duration is kept. */
export function movedDates(dates: CalendarDates, anchor: DayKey, target: DayKey): CalendarDates {
  const offset = daysBetween(anchor, target)
  return { start: addDays(dates.start, offset), end: addDays(dates.end, offset) }
}

export interface DateWrite {
  property: string
  value: string
}

/** The frontmatter writes a reschedule needs: the start date, plus the end date when the note has a range. */
export function rescheduleWrites(item: CalendarItem, next: CalendarDates, sources: CalendarSources): DateWrite[] {
  const writes = [{ property: sources.dateProperty, value: rescheduledValue(entryDateValue(item.entry, sources.dateProperty), next.start) }]
  if (sources.endDateProperty && item.end !== item.start) {
    writes.push({ property: sources.endDateProperty, value: rescheduledValue(entryDateValue(item.entry, sources.endDateProperty), next.end) })
  }
  return writes
}

function isCalendarDateValue(value: unknown): boolean {
  return parseCalendarDate(value).kind === 'day'
}

function preferenceRank(property: string): number {
  const rank = PREFERRED_DATE_PROPERTIES.indexOf(property.toLowerCase())
  return rank === -1 ? PREFERRED_DATE_PROPERTIES.length : rank
}

/** Frontmatter properties holding a date in at least one note, preferred names first. */
export function availableDateProperties(entries: VaultEntry[]): string[] {
  const keys = new Set<string>()
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.properties)) {
      if (key.trim() && isCalendarDateValue(value)) keys.add(key)
    }
  }
  return [...keys].sort((left, right) => preferenceRank(left) - preferenceRank(right) || left.localeCompare(right))
}

/** The configured date property, or the best date property the list has; null when it has none. */
export function resolveDateProperty(configured: string | null, candidates: string[]): string | null {
  if (configured) return configured
  return candidates[0] ?? null
}
