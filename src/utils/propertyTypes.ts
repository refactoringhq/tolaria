import type { FrontmatterValue } from '../components/Inspector'
import { getAppStorageItem } from '../constants/appStorage'
import { isValidCssColor, isColorKeyName } from './colorUtils'
import { updateVaultConfigField } from './vaultConfigStore'
import { CalendarIcon, Type, ToggleLeft, Circle, Link, Tag, Palette, Hash } from 'lucide-react'
import { canonicalSystemMetadataKey } from './systemMetadata'

export type PropertyDisplayMode = 'text' | 'number' | 'date' | 'boolean' | 'status' | 'url' | 'tags' | 'color'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/
const COMMON_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/

const STATUS_VALUES = new Set([
  'active', 'done', 'paused', 'archived', 'dropped',
  'open', 'closed', 'not started', 'draft', 'mixed',
  'published', 'in progress', 'blocked', 'cancelled', 'pending',
])

const STATUS_KEY_PATTERNS = ['status']
const DATE_KEY_PATTERNS = ['date', 'deadline', 'due', 'start', 'end', 'scheduled']
const TAGS_KEY_PATTERNS = ['tags', 'keywords', 'categories', 'labels']

function isIconKey(key: string): boolean {
  return canonicalSystemMetadataKey(key) === '_icon'
}

function keyMatchesPatterns(key: string, patterns: string[]): boolean {
  const lower = key.toLowerCase()
  return patterns.some(p => lower === p || lower.includes(p))
}

function isDateString(value: string): boolean {
  return ISO_DATE_RE.test(value) || COMMON_DATE_RE.test(value)
}

function isStatusKey(key: string): boolean {
  return keyMatchesPatterns(key, STATUS_KEY_PATTERNS)
}

function isDateKey(key: string): boolean {
  return keyMatchesPatterns(key, DATE_KEY_PATTERNS)
}

function isStatusString(key: string, value: string): boolean {
  if (isStatusKey(key)) return true
  if (isDateKey(key)) return false
  return STATUS_VALUES.has(value.toLowerCase())
}

function isColorString(key: string, value: string): boolean {
  return isValidCssColor(value) && (value.startsWith('#') || isColorKeyName(key))
}

function detectStringType(key: string, strValue: string): PropertyDisplayMode {
  if (isIconKey(key)) return 'text'
  if (isStatusString(key, strValue)) return 'status'
  if (isDateString(strValue)) return 'date'
  if (isColorString(key, strValue)) return 'color'
  return 'text'
}

export function detectPropertyType(key: string, value: FrontmatterValue): PropertyDisplayMode {
  if (value === null || value === undefined) return 'text'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (isIconKey(key)) return 'text'
  if (keyMatchesPatterns(key, TAGS_KEY_PATTERNS)) return 'tags'
  if (Array.isArray(value)) return 'text'
  return detectStringType(key, String(value))
}

let vaultOverrides: Record<string, PropertyDisplayMode> | null = null

/** Initialize display mode overrides from vault config (replaces localStorage). */
export function initDisplayModeOverrides(overrides: Record<string, string>): void {
  vaultOverrides = overrides as Record<string, PropertyDisplayMode>
}

export function loadDisplayModeOverrides(): Record<string, PropertyDisplayMode> {
  if (vaultOverrides !== null) return { ...vaultOverrides }
  const raw = getAppStorageItem('propertyModes')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function persistDisplayModeOverrides(overrides: Record<string, PropertyDisplayMode>): void {
  vaultOverrides = { ...overrides }
  const snapshot = Object.keys(overrides).length > 0 ? { ...overrides } : null
  updateVaultConfigField('property_display_modes', snapshot as Record<string, string> | null)
}

export function saveDisplayModeOverride(propertyName: string, mode: PropertyDisplayMode): void {
  const overrides = loadDisplayModeOverrides()
  overrides[propertyName] = mode
  persistDisplayModeOverrides(overrides)
}

export function removeDisplayModeOverride(propertyName: string): void {
  const overrides = loadDisplayModeOverrides()
  delete overrides[propertyName]
  persistDisplayModeOverrides(overrides)
}

export function getEffectiveDisplayMode(
  key: string,
  value: FrontmatterValue,
  overrides: Record<string, PropertyDisplayMode>,
): PropertyDisplayMode {
  return overrides[key] ?? detectPropertyType(key, value)
}

function resolveDateFromValue(value: string): Date | null {
  const isoMatch = value.match(ISO_DATE_RE)
  if (isoMatch) {
    const matched = isoMatch[0]
    const dateOnly = matched.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(matched)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!parts) return null

  const date = new Date(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateValue(value: string): string {
  const date = resolveDateFromValue(value)
  return date
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : value
}

export function toISODate(value: string): string {
  const isoMatch = value.match(ISO_DATE_RE)
  if (isoMatch) {
    const d = new Date(isoMatch[0])
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return value
}

export const DISPLAY_MODE_ICONS: Record<PropertyDisplayMode, typeof Type> = {
  text: Type, number: Hash, date: CalendarIcon, boolean: ToggleLeft, status: Circle, url: Link, tags: Tag, color: Palette,
}

export const DISPLAY_MODE_OPTIONS: { value: PropertyDisplayMode; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'status', label: 'Status' },
  { value: 'url', label: 'URL' },
  { value: 'tags', label: 'Tags' },
  { value: 'color', label: 'Color' },
]
