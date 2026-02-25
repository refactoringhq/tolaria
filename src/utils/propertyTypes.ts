import type { FrontmatterValue } from '../components/Inspector'

export type PropertyDisplayMode = 'text' | 'date' | 'boolean' | 'status' | 'url'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/
const COMMON_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/

const STATUS_VALUES = new Set([
  'active', 'done', 'paused', 'archived', 'dropped',
  'open', 'closed', 'not started', 'draft', 'mixed',
  'published', 'in progress', 'blocked', 'cancelled', 'pending',
])

const STATUS_KEY_PATTERNS = ['status']
const DATE_KEY_PATTERNS = ['date', 'deadline', 'due', 'start', 'end', 'scheduled']

function keyMatchesPatterns(key: string, patterns: string[]): boolean {
  const lower = key.toLowerCase()
  return patterns.some(p => lower === p || lower.includes(p))
}

function isDateString(value: string): boolean {
  return ISO_DATE_RE.test(value) || COMMON_DATE_RE.test(value)
}

export function detectPropertyType(key: string, value: FrontmatterValue): PropertyDisplayMode {
  if (value === null || value === undefined) return 'text'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'text'

  const strValue = String(value)

  if (keyMatchesPatterns(key, STATUS_KEY_PATTERNS)) return 'status'
  if (STATUS_VALUES.has(strValue.toLowerCase()) && !keyMatchesPatterns(key, DATE_KEY_PATTERNS)) return 'status'
  if (keyMatchesPatterns(key, DATE_KEY_PATTERNS) && isDateString(strValue)) return 'date'
  if (isDateString(strValue)) return 'date'

  return 'text'
}

const STORAGE_KEY = 'laputa:display-mode-overrides'

export function loadDisplayModeOverrides(): Record<string, PropertyDisplayMode> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDisplayModeOverride(propertyName: string, mode: PropertyDisplayMode): void {
  const overrides = loadDisplayModeOverrides()
  overrides[propertyName] = mode
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function removeDisplayModeOverride(propertyName: string): void {
  const overrides = loadDisplayModeOverrides()
  delete overrides[propertyName]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function getEffectiveDisplayMode(
  key: string,
  value: FrontmatterValue,
  overrides: Record<string, PropertyDisplayMode>,
): PropertyDisplayMode {
  return overrides[key] ?? detectPropertyType(key, value)
}

export function formatDateValue(value: string): string {
  const isoMatch = value.match(ISO_DATE_RE)
  if (isoMatch) {
    const d = new Date(isoMatch[0])
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }
  }
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (parts) {
    const d = new Date(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }
  }
  return value
}

export function toISODate(value: string): string {
  const isoMatch = value.match(ISO_DATE_RE)
  if (isoMatch) {
    const d = new Date(isoMatch[0])
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return value
}
