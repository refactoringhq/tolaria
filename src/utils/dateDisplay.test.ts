import { describe, expect, it } from 'vitest'
import {
  formatDatePartsForDisplay,
  formatDateValueForDisplay,
  normalizeDateDisplayFormat,
} from './dateDisplay'

describe('dateDisplay', () => {
  it('normalizes supported date display formats', () => {
    expect(normalizeDateDisplayFormat(' ISO ')).toBe('iso')
    expect(normalizeDateDisplayFormat('friendly')).toBe('friendly')
    expect(normalizeDateDisplayFormat('long')).toBeNull()
    expect(normalizeDateDisplayFormat(null)).toBeNull()
  })

  it('formats date parts in every supported display style', () => {
    const parts = { year: 2026, month: 5, day: 11 }

    expect(formatDatePartsForDisplay(parts, 'us')).toBe('5/11/2026')
    expect(formatDatePartsForDisplay(parts, 'european')).toBe('11/5/2026')
    expect(formatDatePartsForDisplay(parts, 'friendly')).toBe('May 11, 2026')
    expect(formatDatePartsForDisplay({ year: 2026, month: 12, day: 16 }, 'friendly')).toBe('Dec 16, 2026')
    expect(formatDatePartsForDisplay({ year: 2026, month: 12, day: 16 }, 'friendly', 'it-IT')).toBe('16 dic 2026')
    expect(formatDatePartsForDisplay(parts, 'iso')).toBe('2026-05-11')
    expect(formatDatePartsForDisplay(parts, 'us', 'it-IT')).toBe('5/11/2026')
    expect(formatDatePartsForDisplay(parts, 'european', 'it-IT')).toBe('11/5/2026')
    expect(formatDatePartsForDisplay(parts, 'iso', 'it-IT')).toBe('2026-05-11')
  })

  it('formats ISO and slash date values without changing non-dates', () => {
    expect(formatDateValueForDisplay('2026-05-11', 'european')).toBe('11/5/2026')
    expect(formatDateValueForDisplay('05/11/2026', 'friendly')).toBe('May 11, 2026')
    expect(formatDateValueForDisplay('next Monday', 'iso')).toBe('next Monday')
  })

  it('abbreviates the month and omits only the current year when requested', () => {
    const year = new Date().getFullYear()
    const today = { year, month: 11, day: 21 }
    expect(normalizeDateDisplayFormat('short')).toBe('short')
    expect(normalizeDateDisplayFormat('short-current-year')).toBe('short-current-year')
    expect(formatDatePartsForDisplay(today, 'short')).toBe(`Nov 21, ${year}`)
    expect(formatDatePartsForDisplay(today, 'short-current-year')).toBe('Nov 21')
    expect(formatDatePartsForDisplay({ ...today, year: year - 1 }, 'short-current-year')).toBe(`Nov 21, ${year - 1}`)
    expect(formatDatePartsForDisplay({ ...today, year: year + 1 }, 'short-current-year')).toBe(`Nov 21, ${year + 1}`)
  })
})
