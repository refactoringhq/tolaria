import type { VaultEntry, VaultPropertyValue } from '../../../types'

/**
 * Graph search and color-group queries. Space-separated terms that must all match:
 * - `type:Project` matches the note type,
 * - `status:done` (any `key:value`) matches a frontmatter property or the note status,
 * - anything else matches the title, like the note list search.
 * Matching is case-insensitive and by substring.
 */
interface QueryTerm {
  key: string | null
  value: string
}

const TYPE_KEYS = new Set(['type', 'is', 'isa'])

function parseTerm(raw: string): QueryTerm {
  const separator = raw.indexOf(':')
  if (separator <= 0 || separator === raw.length - 1) return { key: null, value: raw }
  return { key: raw.slice(0, separator), value: raw.slice(separator + 1) }
}

export function parseGraphQuery(query: string): QueryTerm[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean).map(parseTerm)
}

function propertyText(value: VaultPropertyValue | undefined): string {
  if (value === null || value === undefined) return ''
  return Array.isArray(value) ? value.join(' ') : String(value)
}

function propertyValue(entry: VaultEntry, key: string): string {
  if (key === 'status' && entry.status) return entry.status
  const match = Object.entries(entry.properties ?? {}).find(([name]) => name.toLowerCase() === key)
  return propertyText(match?.[1])
}

function termMatches(entry: VaultEntry, { key, value }: QueryTerm): boolean {
  if (key === null) return entry.title.toLowerCase().includes(value)
  if (TYPE_KEYS.has(key)) return (entry.isA ?? '').toLowerCase().includes(value)
  return propertyValue(entry, key).toLowerCase().includes(value)
}

/** True when every term of the parsed query matches the note; an empty query matches everything. */
export function matchesGraphQuery(entry: VaultEntry, terms: readonly QueryTerm[]): boolean {
  return terms.every((term) => termMatches(entry, term))
}
