import { type AppLocale, translate } from '../../lib/i18n'
import type { VaultEntry, VaultPropertyValue } from '../../types'

export const KANBAN_CARD_PREFIX = 'card:'
export const KANBAN_COLUMN_PREFIX = 'column:'

/** A frontmatter property name, such as `status`. */
export type PropertyName = string
/** A column's group value; the empty value is the "No value" column. */
export type ColumnValue = string
export type NotePath = string
export type DragId = string | number

export type PendingMoves = ReadonlyMap<NotePath, ColumnValue>

export function propertyValueFor(entry: VaultEntry, property: PropertyName): VaultPropertyValue | undefined {
  if (property === 'status') return entry.status
  return Object.entries(entry.properties).find(([key]) => key === property)?.[1]
}

export function groupValueFor(entry: VaultEntry, property: PropertyName): ColumnValue {
  const value = propertyValueFor(entry, property)
  if (Array.isArray(value)) return value.join(', ')
  return value === null || value === undefined ? '' : String(value)
}

/** Groups entries by property value, keeping input order inside each column; pending drops win over stale values. */
export function groupEntries(entries: VaultEntry[], property: PropertyName, pending: PendingMoves = new Map()) {
  const groups = new Map<ColumnValue, VaultEntry[]>()
  for (const entry of entries) {
    const value = pending.get(entry.path) ?? groupValueFor(entry, property)
    const group = groups.get(value) ?? []
    group.push(entry)
    groups.set(value, group)
  }
  return groups
}

/** Saved order first, then new values alphabetically, with the "No value" column last unless it was placed. */
export function orderColumns(groupValues: Iterable<ColumnValue>, savedOrder: ColumnValue[]): ColumnValue[] {
  const values = [...[...groupValues].filter(Boolean).sort((left, right) => left.localeCompare(right)), '']
  return [...savedOrder.filter((value) => values.includes(value)), ...values.filter((value) => !savedOrder.includes(value))]
}

export function moveColumn(columns: ColumnValue[], from: ColumnValue, to: ColumnValue): ColumnValue[] {
  const fromIndex = columns.indexOf(from)
  const toIndex = columns.indexOf(to)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return columns
  const next = columns.filter((value) => value !== from)
  next.splice(toIndex, 0, from)
  return next
}

/** Drops pending moves once the vault entry reports the dropped value. */
export function settlePendingMoves(pending: PendingMoves, entries: VaultEntry[], property: PropertyName): PendingMoves {
  if (pending.size === 0) return pending
  const byPath = new Map(entries.map((entry) => [entry.path, entry]))
  const next = new Map(pending)
  for (const [path, value] of pending) {
    const entry = byPath.get(path)
    if (!entry || groupValueFor(entry, property) === value) next.delete(path)
  }
  return next.size === pending.size ? pending : next
}

export function cardDisplayProperties(
  entry: VaultEntry,
  cardProperties: PropertyName[],
  typeEntryMap: Record<string, VaultEntry>,
  displayPropsOverride?: PropertyName[] | null,
): PropertyName[] {
  if (cardProperties.length > 0) return cardProperties
  if (displayPropsOverride && displayPropsOverride.length > 0) return displayPropsOverride
  return typeEntryMap[entry.isA ?? '']?.listPropertiesDisplay ?? []
}

export function columnId(group: ColumnValue): DragId {
  return `${KANBAN_COLUMN_PREFIX}${group}`
}

export function cardId(path: NotePath): DragId {
  return `${KANBAN_CARD_PREFIX}${path}`
}

export function columnFromId(id: unknown): ColumnValue | undefined {
  if (typeof id !== 'string' || !id.startsWith(KANBAN_COLUMN_PREFIX)) return undefined
  return id.slice(KANBAN_COLUMN_PREFIX.length)
}

export function isCardId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(KANBAN_CARD_PREFIX)
}

export function columnTitle(group: ColumnValue, locale: AppLocale): string {
  return group || translate(locale, 'layout.noValue')
}

export function withoutPendingMove(pending: PendingMoves, path: NotePath, value: ColumnValue): PendingMoves {
  if (pending.get(path) !== value) return pending
  const next = new Map(pending)
  next.delete(path)
  return next
}
