import { describe, expect, it } from 'vitest'
import {
  addDays,
  calendarTitle,
  isWeekend,
  parseCalendarDate,
  rescheduledValue,
  shiftAnchor,
  startOfWeek,
  visibleWeeks,
  weekdayLabels,
  weekStartForLocale,
} from './calendarDates'

describe('calendarDates', () => {
  it('does day arithmetic across month, year and daylight-saving boundaries', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('starts the week on Sunday for en-US and on Monday for most other locales', () => {
    expect(weekStartForLocale('en')).toBe(0)
    expect(weekStartForLocale('ja-JP')).toBe(0)
    expect(weekStartForLocale('it-IT')).toBe(1)
    expect(weekStartForLocale('de-DE')).toBe(1)
    expect(startOfWeek('2026-11-19', 0)).toBe('2026-11-15')
    expect(startOfWeek('2026-11-19', 1)).toBe('2026-11-16')
  })

  it('shows every week touching the month, padded with muted days from the neighbours', () => {
    const sundayWeeks = visibleWeeks('2026-11-19', 'month', 0)
    expect(sundayWeeks).toHaveLength(5)
    expect(sundayWeeks[0][0]).toBe('2026-11-01')
    expect(sundayWeeks[4][6]).toBe('2026-12-05')
    const mondayWeeks = visibleWeeks('2026-11-19', 'month', 1)
    expect(mondayWeeks).toHaveLength(6)
    expect(mondayWeeks[0][0]).toBe('2026-10-26')
    expect(visibleWeeks('2026-11-19', 'week', 1)).toEqual([[
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]])
  })

  it('moves a month or a week at a time', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01')
    expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01')
    expect(shiftAnchor('2026-11-19', 'week', -1)).toBe('2026-11-12')
  })

  it('titles the view and weekdays with Intl for the active locale', () => {
    const week = visibleWeeks('2026-11-19', 'week', 1)[0]
    expect(calendarTitle('2026-11-19', week, 'month', 'en')).toBe('November 2026')
    expect(calendarTitle('2026-11-19', week, 'month', 'it-IT')).toBe('novembre 2026')
    expect(calendarTitle('2026-11-19', week, 'week', 'en')).toMatch(/^Nov 16\s*–\s*22, 2026$/)
    expect(calendarTitle('2026-11-19', week.filter((day) => !isWeekend(day)), 'week', 'en')).toMatch(/^Nov 16\s*–\s*20, 2026$/)
    expect(weekdayLabels(visibleWeeks('2026-11-19', 'week', 1)[0], 'de-DE')[0]).toEqual({ day: '2026-11-16', label: expect.stringMatching(/^Mo/) })
  })

  it('marks Saturdays and Sundays as weekend days', () => {
    expect(isWeekend('2026-11-21')).toBe(true)
    expect(isWeekend('2026-11-22')).toBe(true)
    expect(isWeekend('2026-11-23')).toBe(false)
  })

  it('reads ISO and slash dates, and tells empty values from invalid ones', () => {
    expect(parseCalendarDate('2026-11-19')).toEqual({ kind: 'day', day: '2026-11-19' })
    expect(parseCalendarDate('2026-11-19T09:30')).toEqual({ kind: 'day', day: '2026-11-19' })
    expect(parseCalendarDate('11/19/2026')).toEqual({ kind: 'day', day: '2026-11-19' })
    expect(parseCalendarDate(undefined)).toEqual({ kind: 'empty' })
    expect(parseCalendarDate('  ')).toEqual({ kind: 'empty' })
    expect(parseCalendarDate('next week')).toEqual({ kind: 'invalid' })
    expect(parseCalendarDate(42)).toEqual({ kind: 'invalid' })
    expect(parseCalendarDate('2026-02-30')).toEqual({ kind: 'invalid' })
  })

  it('rewrites only the day of a stored value and keeps its time of day', () => {
    expect(rescheduledValue('2026-11-19', '2026-11-25')).toBe('2026-11-25')
    expect(rescheduledValue('2026-11-19T09:30', '2026-11-25')).toBe('2026-11-25T09:30')
    expect(rescheduledValue(undefined, '2026-11-25')).toBe('2026-11-25')
    expect(rescheduledValue('11/19/2026', '2026-11-25')).toBe('2026-11-25')
  })
})
