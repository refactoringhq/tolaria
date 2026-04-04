import type { VaultEntry, ViewDefinition, FilterGroup, FilterNode, FilterCondition } from '../types'

/** Evaluate a view's filters against a list of entries, returning only matches. */
export function evaluateView(definition: ViewDefinition, entries: VaultEntry[]): VaultEntry[] {
  return entries.filter((e) => !e.trashed && !e.archived && evaluateGroup(definition.filters, e))
}

function evaluateGroup(group: FilterGroup, entry: VaultEntry): boolean {
  if ('all' in group) return group.all.every((node) => evaluateNode(node, entry))
  if ('any' in group) return group.any.some((node) => evaluateNode(node, entry))
  return true
}

function isFilterGroup(node: FilterNode): node is FilterGroup {
  return 'all' in node || 'any' in node
}

function evaluateNode(node: FilterNode, entry: VaultEntry): boolean {
  if (isFilterGroup(node)) return evaluateGroup(node, entry)
  return evaluateCondition(node as FilterCondition, entry)
}

function resolveField(entry: VaultEntry, field: string): { scalar?: string | number | boolean | null; array?: string[] } {
  const lower = field.toLowerCase()
  if (lower === 'type' || lower === 'isa') return { scalar: entry.isA }
  if (lower === 'status') return { scalar: entry.status }
  if (lower === 'title') return { scalar: entry.title }
  if (lower === 'filename') return { scalar: entry.filename }
  if (lower === 'archived') return { scalar: entry.archived }
  if (lower === 'trashed') return { scalar: entry.trashed }
  if (lower === 'favorite') return { scalar: entry.favorite }

  // Check relationships first (returns string[])
  const relKey = Object.keys(entry.relationships).find((k) => k.toLowerCase() === lower)
  if (relKey) return { array: entry.relationships[relKey] }

  // Then properties (returns scalar)
  const propKey = Object.keys(entry.properties).find((k) => k.toLowerCase() === lower)
  if (propKey) return { scalar: entry.properties[propKey] }

  return { scalar: null }
}

function wikilinkStem(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('[[')) s = s.slice(2)
  if (s.endsWith(']]')) s = s.slice(0, -2)
  const pipe = s.indexOf('|')
  if (pipe >= 0) s = s.substring(0, pipe)
  return s.toLowerCase()
}

function toString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function evaluateCondition(cond: FilterCondition, entry: VaultEntry): boolean {
  const resolved = resolveField(entry, cond.field)
  const { op, value } = cond

  if (op === 'is_empty') {
    if (resolved.array) return resolved.array.length === 0
    const s = resolved.scalar
    return s == null || s === '' || s === false
  }
  if (op === 'is_not_empty') {
    if (resolved.array) return resolved.array.length > 0
    const s = resolved.scalar
    return s != null && s !== '' && s !== false
  }

  const condVal = toString(value)

  if (resolved.array) {
    const stem = wikilinkStem(condVal)
    const isWikilink = condVal.trim().startsWith('[[')
    const arrayMatch = (arr: string[]) => arr.some((item) =>
      isWikilink ? wikilinkStem(item) === stem : wikilinkStem(item).includes(stem)
    )
    if (op === 'contains') return arrayMatch(resolved.array)
    if (op === 'not_contains') return !arrayMatch(resolved.array)
    if (op === 'any_of' && Array.isArray(value)) {
      const stems = (value as string[]).map(wikilinkStem)
      return resolved.array.some((item) => stems.includes(wikilinkStem(item)))
    }
    if (op === 'none_of' && Array.isArray(value)) {
      const stems = (value as string[]).map(wikilinkStem)
      return !resolved.array.some((item) => stems.includes(wikilinkStem(item)))
    }
    return false
  }

  const fieldStr = toString(resolved.scalar).toLowerCase()
  const condStr = condVal.toLowerCase()

  if (op === 'equals') return fieldStr === condStr
  if (op === 'not_equals') return fieldStr !== condStr
  if (op === 'contains') return fieldStr.includes(condStr)
  if (op === 'not_contains') return !fieldStr.includes(condStr)
  if (op === 'any_of' && Array.isArray(value)) return (value as string[]).some((v) => toString(v).toLowerCase() === fieldStr)
  if (op === 'none_of' && Array.isArray(value)) return !(value as string[]).some((v) => toString(v).toLowerCase() === fieldStr)

  // Date comparisons
  if (op === 'before' || op === 'after') {
    let tsMs: number | null = null
    if (typeof resolved.scalar === 'number') {
      tsMs = resolved.scalar * 1000 // Unix timestamp (seconds) → milliseconds
    } else if (typeof resolved.scalar === 'string') {
      const parsed = Date.parse(resolved.scalar)
      tsMs = isNaN(parsed) ? null : parsed
    }
    if (tsMs == null) return false
    const target = Date.parse(condVal)
    if (isNaN(target)) return false
    return op === 'before' ? tsMs < target : tsMs > target
  }

  return false
}
