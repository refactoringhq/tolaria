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

export function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE
}
