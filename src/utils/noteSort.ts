export type SortOption = 'modified' | 'created' | 'title' | 'status' | `property:${string}`
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  option: SortOption
  direction: SortDirection
}

export const DEFAULT_SORT_OPTIONS: SortOption[] = ['modified', 'created', 'title', 'status']
const BUILT_IN_SORT_OPTIONS = new Set<string>(DEFAULT_SORT_OPTIONS)
const STATUS_SORT_ORDER: Record<string, number> = {
  active: 0,
  paused: 1,
  done: 2,
  finished: 3,
}
const STATUS_SORT_ORDER_LOOKUP = new Map(Object.entries(STATUS_SORT_ORDER))
const UNKNOWN_STATUS_SORT_ORDER = 999
const ISO_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/u

export function isBuiltInSortOption(option: string): option is Exclude<SortOption, `property:${string}`> {
  return BUILT_IN_SORT_OPTIONS.has(option)
}

export function getDefaultDirection(option: SortOption): SortDirection {
  if (option === 'modified' || option === 'created') return 'desc'
  return 'asc'
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'modified', label: 'Modified' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
]

export function getSortOptionLabel(option: SortOption): string {
  if (option.startsWith('property:')) return option.slice('property:'.length)
  return SORT_OPTIONS.find((candidate) => candidate.value === option)?.label ?? option
}

export function statusSortRank(status: string | null | undefined): number {
  return STATUS_SORT_ORDER_LOOKUP.get((status ?? '').trim().toLowerCase()) ?? UNKNOWN_STATUS_SORT_ORDER
}

export function compareSortableValues(left: unknown, right: unknown): number {
  const numericResult = compareNumericPair(left, right)
  if (numericResult !== null) return numericResult

  const leftText = String(left)
  const rightText = String(right)
  const leftTimestamp = sortableDateTimestamp(leftText)
  const rightTimestamp = sortableDateTimestamp(rightText)
  if (leftTimestamp !== null && rightTimestamp !== null) return leftTimestamp - rightTimestamp

  return leftText.localeCompare(rightText)
}

/** Serialize a SortConfig to the string format stored in type frontmatter: "option:direction". */
export function serializeSortConfig(config: SortConfig): string {
  return `${config.option}:${config.direction}`
}

/** Parse a frontmatter sort string ("option:direction") back to SortConfig. */
export function parseSortConfig(raw: string | null | undefined): SortConfig | null {
  if (!raw) return null

  const lastColon = raw.lastIndexOf(':')
  if (lastColon <= 0) return null

  const direction = raw.slice(lastColon + 1)
  if (direction !== 'asc' && direction !== 'desc') return null

  const optionName = raw.slice(0, lastColon)
  if (optionName === 'property:') return null

  const option = (
    optionName.startsWith('property:') || isBuiltInSortOption(optionName)
      ? optionName
      : `property:${optionName}`
  ) as SortOption
  return { direction, option }
}

function compareNumericPair(left: unknown, right: unknown): number | null {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right)
  return null
}

function sortableDateTimestamp(value: string): number | null {
  if (!ISO_DATE_PREFIX_PATTERN.test(value)) return null

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}
