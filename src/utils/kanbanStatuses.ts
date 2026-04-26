export interface KanbanStatusDef {
  key: string
  label: string
  color: string
  order: number
  canonical: boolean
}

const CANONICAL_LIST: ReadonlyArray<Omit<KanbanStatusDef, 'canonical'>> = [
  { key: 'backlog', label: 'Backlog', color: 'var(--muted-foreground)', order: 0 },
  { key: 'doing', label: 'In Progress', color: 'var(--accent-blue)', order: 1 },
  { key: 'review', label: 'Review', color: 'var(--accent-orange)', order: 2 },
  { key: 'done', label: 'Done', color: 'var(--accent-green)', order: 3 },
  { key: 'blocked', label: 'Blocked', color: 'var(--destructive)', order: 4 },
] as const

export const CANONICAL_STATUSES: ReadonlyArray<KanbanStatusDef> = CANONICAL_LIST.map((status) => ({
  ...status,
  canonical: true,
}))

const CANONICAL_BY_KEY = new Map<string, KanbanStatusDef>(
  CANONICAL_STATUSES.map((status) => [status.key, status]),
)

export const DEFAULT_STATUS_KEY = 'backlog'

export function isCanonicalStatus(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && CANONICAL_BY_KEY.has(value)
}

export function getCanonicalStatus(key: string): KanbanStatusDef | undefined {
  return CANONICAL_BY_KEY.get(key)
}

export function statusKeyOf(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) return DEFAULT_STATUS_KEY
  return value
}

export function customStatusDef(key: string): KanbanStatusDef {
  return {
    key,
    label: key,
    color: 'var(--muted-foreground)',
    order: CANONICAL_STATUSES.length + 1,
    canonical: false,
  }
}

export function resolveStatusDef(key: string): KanbanStatusDef {
  return getCanonicalStatus(key) ?? customStatusDef(key)
}
