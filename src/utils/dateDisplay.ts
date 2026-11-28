import { parseDashDateParts, parseSlashDateParts, type DateParts } from './dateStringParts'
import type { AppLocale } from '../lib/i18n'

export type DateDisplayFormat = 'us' | 'european' | 'friendly' | 'iso' | 'short' | 'short-current-year'

export const DEFAULT_DATE_DISPLAY_FORMAT: DateDisplayFormat = 'friendly'
export const DATE_DISPLAY_FORMATS: readonly DateDisplayFormat[] = ['us', 'european', 'friendly', 'short', 'short-current-year', 'iso']

export function isShortDateDisplayFormat(format: DateDisplayFormat): boolean {
  return format === 'short' || format === 'short-current-year'
}

const DEFAULT_DATE_LOCALE: AppLocale = 'en'
const DATE_LOCALE_OVERRIDES = new Map<AppLocale, string>([
  ['en', 'en-US'],
  ['vi', 'vi-VN'],
])

function isDateDisplayFormat(value: string): value is DateDisplayFormat {
  return DATE_DISPLAY_FORMATS.includes(value as DateDisplayFormat)
}

export function normalizeDateDisplayFormat(value: unknown): DateDisplayFormat | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isDateDisplayFormat(normalized) ? normalized : null
}

function twoDigit(value: number): string {
  return String(value).padStart(2, '0')
}

function dateYearStyle(format: DateDisplayFormat, year: number): 'numeric' | undefined {
  return format === 'short-current-year' && year === new Date().getFullYear() ? undefined : 'numeric'
}

export function formatDatePartsForDisplay(
  parts: DateParts,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  locale: AppLocale = DEFAULT_DATE_LOCALE,
): string {
  if (format === 'us') return `${parts.month}/${parts.day}/${parts.year}`
  if (format === 'european') return `${parts.day}/${parts.month}/${parts.year}`
  if (format === 'iso') return `${parts.year}-${twoDigit(parts.month)}-${twoDigit(parts.day)}`
  return new Intl.DateTimeFormat(DATE_LOCALE_OVERRIDES.get(locale) ?? locale, {
    day: 'numeric',
    month: 'short',
    year: dateYearStyle(format, parts.year),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}

function datePartsFromDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

export function formatDateForDisplay(
  date: Date,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  locale: AppLocale = DEFAULT_DATE_LOCALE,
): string {
  return formatDatePartsForDisplay(datePartsFromDate(date), format, locale)
}

export function formatTimestampForDateDisplay(
  timestampSeconds: number | null | undefined,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  locale: AppLocale = DEFAULT_DATE_LOCALE,
): string {
  if (!timestampSeconds) return ''
  return formatDateForDisplay(new Date(timestampSeconds * 1000), format, locale)
}

export function parseDateDisplayParts(value: string): DateParts | null {
  return parseDashDateParts(value) ?? parseSlashDateParts(value)
}

export function formatDateValueForDisplay(
  value: string,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  locale: AppLocale = DEFAULT_DATE_LOCALE,
): string {
  const parts = parseDateDisplayParts(value)
  return parts ? formatDatePartsForDisplay(parts, format, locale) : value
}
