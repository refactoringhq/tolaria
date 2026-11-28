import { getAppStorageItem } from '../constants/appStorage'
import { ACCENT_COLORS } from './typeColors'
import { updateVaultConfigField } from './vaultConfigStore'

export interface StatusStyle {
  bg: string
  color: string
}

/** Built-in chip colors, keyed by lowercase status. Lookups ignore case (TOL-466). */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  active: { bg: 'var(--accent-green-light)', color: 'var(--accent-green-text)' },
  done: { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue-text)' },
  paused: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow-text)' },
  archived: { bg: 'var(--accent-gray-light)', color: 'var(--accent-gray-text)' },
  dropped: { bg: 'var(--accent-red-light)', color: 'var(--accent-red-text)' },
  open: { bg: 'var(--accent-green-light)', color: 'var(--accent-green-text)' },
  closed: { bg: 'var(--accent-gray-light)', color: 'var(--accent-gray-text)' },
  'not started': { bg: 'var(--accent-gray-light)', color: 'var(--accent-gray-text)' },
  draft: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow-text)' },
  mixed: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow-text)' },
  published: { bg: 'var(--accent-green-light)', color: 'var(--accent-green-text)' },
  'in progress': { bg: 'var(--accent-purple-light)', color: 'var(--accent-purple-text)' },
  blocked: { bg: 'var(--accent-red-light)', color: 'var(--accent-red-text)' },
  cancelled: { bg: 'var(--accent-red-light)', color: 'var(--accent-red-text)' },
  pending: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow-text)' },
}

export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: 'var(--accent-gray-light)',
  color: 'var(--accent-gray-text)',
}

/** Default suggested statuses shown in the dropdown */
export const SUGGESTED_STATUSES = [
  'not started',
  'in progress',
  'active',
  'done',
  'blocked',
  'paused',
  'draft',
  'archived',
]

const COLOR_KEY_TO_STYLE: Record<string, StatusStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.cssText }]),
)
const COLOR_KEY_STYLE_LOOKUP = new Map(Object.entries(COLOR_KEY_TO_STYLE))
const STATUS_STYLE_LOOKUP = new Map(Object.entries(STATUS_STYLES))

let colorOverrides: Record<string, string> = loadColorOverrides()

/** Initialize status color overrides from vault config (replaces localStorage). */
export function initStatusColors(overrides: Record<string, string>): void {
  colorOverrides = { ...overrides }
}

function loadColorOverrides(): Record<string, string> {
  const raw = getAppStorageItem('statusColors')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export function getStatusColorOverrides(): Record<string, string> {
  return { ...colorOverrides }
}

function statusLookupKey(status: string): string {
  return status.trim().toLowerCase()
}

function overrideKeysFor(status: string): string[] {
  const lookupKey = statusLookupKey(status)
  return Object.keys(colorOverrides).filter(key => statusLookupKey(key) === lookupKey)
}

export function setStatusColor(status: string, colorKey: string | null): void {
  for (const key of overrideKeysFor(status)) Reflect.deleteProperty(colorOverrides, key)
  if (colorKey === null) {
    Reflect.deleteProperty(colorOverrides, status)
  } else {
    Reflect.set(colorOverrides, status, colorKey)
  }
  const snapshot = { ...colorOverrides }
  updateVaultConfigField('status_colors', Object.keys(snapshot).length > 0 ? snapshot : null)
}

export function getStatusColorKey(status: string): string | null {
  const exact = Reflect.get(colorOverrides, status) as string | undefined
  if (exact) return exact
  const [matchingKey] = overrideKeysFor(status)
  return matchingKey ? (Reflect.get(colorOverrides, matchingKey) as string) : null
}

export function getMappedStatusStyle(status: string): StatusStyle | null {
  const overrideKey = getStatusColorKey(status)
  if (overrideKey) {
    const style = COLOR_KEY_STYLE_LOOKUP.get(overrideKey)
    if (style) return style
  }
  return STATUS_STYLE_LOOKUP.get(statusLookupKey(status)) ?? null
}

export function getStatusStyle(status: string): StatusStyle {
  return getMappedStatusStyle(status) ?? DEFAULT_STATUS_STYLE
}
