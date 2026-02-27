import type { VaultEntry, SidebarSelection } from '../types'

export interface RelationshipGroup {
  label: string
  entries: VaultEntry[]
}

export function relativeDate(ts: number | null): string {
  if (!ts) return ''
  const now = Math.floor(Date.now() / 1000)
  const diff = now - ts
  if (diff < 0) {
    const date = new Date(ts * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  const date = new Date(ts * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getDisplayDate(entry: VaultEntry): number | null {
  return entry.modifiedAt ?? entry.createdAt
}

export function formatSubtitle(entry: VaultEntry): string {
  const parts: string[] = []
  const date = getDisplayDate(entry)
  if (date) parts.push(relativeDate(date))
  if (entry.wordCount > 0) {
    parts.push(`${entry.wordCount.toLocaleString()} words`)
  } else {
    parts.push('Empty')
  }
  if (entry.outgoingLinks.length > 0) {
    parts.push(`${entry.outgoingLinks.length} ${entry.outgoingLinks.length === 1 ? 'link' : 'links'}`)
  }
  return parts.join(' \u00b7 ')
}

export function formatSearchSubtitle(entry: VaultEntry): string {
  const parts: string[] = []
  const modified = entry.modifiedAt ?? entry.createdAt
  if (modified) parts.push(relativeDate(modified))
  if (entry.createdAt && entry.modifiedAt && entry.createdAt !== entry.modifiedAt) {
    parts.push(`Created ${relativeDate(entry.createdAt)}`)
  }
  if (entry.wordCount > 0) {
    parts.push(`${entry.wordCount.toLocaleString()} words`)
  } else {
    parts.push('Empty')
  }
  if (entry.outgoingLinks.length > 0) {
    parts.push(`${entry.outgoingLinks.length} ${entry.outgoingLinks.length === 1 ? 'link' : 'links'}`)
  }
  return parts.join(' \u00b7 ')
}

function refsMatch(refs: string[], entry: VaultEntry): boolean {
  const stem = entry.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
  const fileStem = entry.filename.replace(/\.md$/, '')
  return refs.some((ref) => {
    const inner = ref.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0]
    return inner === stem || inner.split('/').pop() === fileStem
  })
}

function resolveRefs(refs: string[], entries: VaultEntry[]): VaultEntry[] {
  return refs
    .map((ref) => {
      const inner = ref.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0]
      return entries.find((e) => {
        const stem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
        if (stem === inner) return true
        const fileStem = e.filename.replace(/\.md$/, '')
        return fileStem === inner.split('/').pop()
      })
    })
    .filter((e): e is VaultEntry => e !== undefined)
}

export function sortByModified(a: VaultEntry, b: VaultEntry): number {
  return (getDisplayDate(b) ?? 0) - (getDisplayDate(a) ?? 0)
}

export type SortOption = 'modified' | 'created' | 'title' | 'status'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  option: SortOption
  direction: SortDirection
}

export const DEFAULT_DIRECTIONS: Record<SortOption, SortDirection> = {
  modified: 'desc',
  created: 'desc',
  title: 'asc',
  status: 'asc',
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'modified', label: 'Modified' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
]

const STATUS_ORDER: Record<string, number> = {
  Active: 0, Paused: 1, Done: 2, Finished: 3,
}

export function getSortComparator(option: SortOption, direction?: SortDirection): (a: VaultEntry, b: VaultEntry) => number {
  const dir = direction ?? DEFAULT_DIRECTIONS[option]
  const flip = dir === 'asc' ? 1 : -1
  switch (option) {
    case 'modified':
      return (a, b) => flip * ((getDisplayDate(a) ?? 0) - (getDisplayDate(b) ?? 0))
    case 'created':
      return (a, b) => flip * ((a.createdAt ?? a.modifiedAt ?? 0) - (b.createdAt ?? b.modifiedAt ?? 0))
    case 'title':
      return (a, b) => flip * a.title.localeCompare(b.title)
    case 'status':
      return (a, b) => {
        const sa = STATUS_ORDER[a.status ?? ''] ?? 999
        const sb = STATUS_ORDER[b.status ?? ''] ?? 999
        if (sa !== sb) return flip * (sa - sb)
        // Tiebreaker: always newest first regardless of direction
        return (getDisplayDate(b) ?? 0) - (getDisplayDate(a) ?? 0)
      }
  }
}

const SORT_STORAGE_KEY = 'laputa-sort-preferences'

export function loadSortPreferences(): Record<string, SortConfig> {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const result: Record<string, SortConfig> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        // Migrate old format: bare SortOption string → SortConfig
        const opt = value as SortOption
        result[key] = { option: opt, direction: DEFAULT_DIRECTIONS[opt] }
      } else {
        result[key] = value as SortConfig
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveSortPreferences(prefs: Record<string, SortConfig>) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

function findBacklinks(entity: VaultEntry, allEntries: VaultEntry[], allContent: Record<string, string>): VaultEntry[] {
  const stem = entity.filename.replace(/\.md$/, '')
  const pathStem = entity.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
  const targets = [entity.title, ...entity.aliases]

  return allEntries.filter((e) => {
    if (e.path === entity.path) return false
    const content = allContent[e.path]
    if (!content) return false
    for (const t of targets) {
      if (content.includes(`[[${t}]]`)) return true
    }
    if (content.includes(`[[${stem}]]`)) return true
    if (content.includes(`[[${pathStem}]]`)) return true
    return content.includes(`[[${pathStem}|`)
  })
}

class GroupBuilder {
  readonly groups: RelationshipGroup[] = []
  private readonly seen: Set<string>
  private readonly allEntries: VaultEntry[]

  constructor(entityPath: string, allEntries: VaultEntry[]) {
    this.seen = new Set([entityPath])
    this.allEntries = allEntries
  }

  add(label: string, entries: VaultEntry[]) {
    const unseen = entries.filter((e) => !this.seen.has(e.path))
    if (unseen.length > 0) {
      this.groups.push({ label, entries: unseen })
      unseen.forEach((e) => this.seen.add(e.path))
    }
  }

  addFromRefs(label: string, refs: string[]) {
    if (refs.length > 0) {
      this.add(label, resolveRefs(refs, this.allEntries).sort(sortByModified))
    }
  }

  filterAndAdd(label: string, predicate: (e: VaultEntry) => boolean) {
    this.add(label, this.allEntries.filter((e) => !this.seen.has(e.path) && predicate(e)).sort(sortByModified))
  }
}

export function buildRelationshipGroups(
  entity: VaultEntry,
  allEntries: VaultEntry[],
  allContent: Record<string, string>,
): RelationshipGroup[] {
  const b = new GroupBuilder(entity.path, allEntries)
  const rels = entity.relationships ?? {}

  if (entity.isA === 'Type') {
    b.filterAndAdd('Instances', (e) => e.isA === entity.title)
  }

  b.addFromRefs('Has', rels['Has'] ?? [])
  b.filterAndAdd('Children', (e) => e.isA !== 'Event' && refsMatch(e.belongsTo, entity))
  b.filterAndAdd('Events', (e) => e.isA === 'Event' && (refsMatch(e.belongsTo, entity) || refsMatch(e.relatedTo, entity)))
  b.addFromRefs('Topics', rels['Topics'] ?? [])

  const handledKeys = new Set(['Has', 'Topics'])
  Object.keys(rels)
    .filter((k) => !handledKeys.has(k) && k.toLowerCase() !== 'type')
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => b.addFromRefs(key, rels[key] ?? []))

  b.filterAndAdd('Referenced By', (e) => e.isA !== 'Event' && refsMatch(e.relatedTo, entity))
  b.add('Backlinks', findBacklinks(entity, allEntries, allContent).sort(sortByModified))

  return b.groups
}

const isActive = (e: VaultEntry) => !e.archived && !e.trashed

function filterByKind(entries: VaultEntry[], selection: SidebarSelection): VaultEntry[] {
  if (selection.kind === 'entity') return []
  if (selection.kind === 'sectionGroup') {
    return entries.filter((e) => e.isA === selection.type && isActive(e))
  }
  if (selection.kind === 'topic') {
    return entries.filter((e) => refsMatch(e.relatedTo, selection.entry) && isActive(e))
  }
  return filterByFilterType(entries, selection.filter)
}

function filterByFilterType(entries: VaultEntry[], filter: string): VaultEntry[] {
  if (filter === 'all') return entries.filter(isActive)
  if (filter === 'archived') return entries.filter((e) => e.archived && !e.trashed)
  if (filter === 'trash') return entries.filter((e) => e.trashed)
  return []
}

export function filterEntries(entries: VaultEntry[], selection: SidebarSelection): VaultEntry[] {
  return filterByKind(entries, selection)
}
