import { ACCENT_COLORS } from './typeColors'

export interface StatusStyle {
  bg: string
  color: string
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  Active: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Done: { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)' },
  Paused: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Archived: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Dropped: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Open: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Closed: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  'Not started': { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Draft: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Mixed: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Published: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  'In progress': { bg: 'var(--accent-purple-light)', color: 'var(--accent-purple)' },
  Blocked: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Cancelled: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Pending: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
}

export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: 'var(--accent-blue-light)',
  color: 'var(--muted-foreground)',
}

/** Default suggested statuses shown in the dropdown */
export const SUGGESTED_STATUSES = [
  'Not started',
  'In progress',
  'Active',
  'Done',
  'Blocked',
  'Paused',
  'Draft',
  'Archived',
]

const STORAGE_KEY = 'laputa:status-color-overrides'

const COLOR_KEY_TO_STYLE: Record<string, StatusStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.css }]),
)

const colorOverrides: Record<string, string> = loadColorOverrides()

function loadColorOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function getStatusColorOverrides(): Record<string, string> {
  return { ...colorOverrides }
}

export function setStatusColor(status: string, colorKey: string | null): void {
  if (colorKey === null) {
    delete colorOverrides[status]
  } else {
    colorOverrides[status] = colorKey
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colorOverrides))
  } catch { /* storage full — silently ignore */ }
}

export function getStatusColorKey(status: string): string | null {
  return colorOverrides[status] ?? null
}

export function getStatusStyle(status: string): StatusStyle {
  const overrideKey = colorOverrides[status]
  if (overrideKey) {
    const style = COLOR_KEY_TO_STYLE[overrideKey]
    if (style) return style
  }
  return STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE
}
