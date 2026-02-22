import { useState, useMemo, useCallback, memo } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile } from '../types'
import { Input } from '@/components/ui/input'
import {
  MagnifyingGlass, Plus, CaretDown, CaretRight, Warning,
} from '@phosphor-icons/react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { NoteItem, getTypeIcon } from './NoteItem'
import { SortDropdown } from './SortDropdown'
import {
  type SortOption, type SortDirection, type SortConfig, type RelationshipGroup,
  DEFAULT_DIRECTIONS, getSortComparator,
  buildRelationshipGroups, filterEntries,
  sortByModified, relativeDate, getDisplayDate,
  loadSortPreferences, saveSortPreferences,
} from '../utils/noteListHelpers'

// Re-export for consumers
export { sortByModified, filterEntries, buildRelationshipGroups, getSortComparator }
export type { SortOption }

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  allContent: Record<string, string>
  modifiedFiles?: ModifiedFile[]
  onSelectNote: (entry: VaultEntry) => void
  onCreateNote: () => void
}

function PinnedCard({ entry, typeEntryMap, onSelectNote, showDate }: {
  entry: VaultEntry
  typeEntryMap: Record<string, VaultEntry>
  onSelectNote: (entry: VaultEntry) => void
  showDate?: boolean
}) {
  const te = typeEntryMap[entry.isA ?? '']
  const color = getTypeColor(entry.isA ?? '', te?.color)
  const bgColor = getTypeLightColor(entry.isA ?? '', te?.color)
  const Icon = getTypeIcon(entry.isA, te?.icon)
  return (
    <div className="relative cursor-pointer border-b border-[var(--border)]" style={{ backgroundColor: bgColor, padding: '14px 16px' }} onClick={() => onSelectNote(entry)}>
      <Icon width={16} height={16} className="absolute right-3 top-3.5" style={{ color }} data-testid="type-icon" />
      <div className="pr-6 text-[14px] font-bold" style={{ color }}>{entry.title}</div>
      <div className="mt-1 text-[12px] leading-[1.5] opacity-80" style={{ color, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.snippet}</div>
      {showDate && <div className="mt-1 text-[11px] opacity-60" style={{ color }}>{relativeDate(getDisplayDate(entry))}</div>}
    </div>
  )
}

function RelationshipGroupSection({ group, isCollapsed, sortPrefs, onToggle, handleSortChange, renderItem }: {
  group: RelationshipGroup
  isCollapsed: boolean
  sortPrefs: Record<string, SortConfig>
  onToggle: () => void
  handleSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  renderItem: (entry: VaultEntry) => React.ReactNode
}) {
  const groupConfig = sortPrefs[group.label] ?? { option: 'modified' as SortOption, direction: 'desc' as SortDirection }
  const sortedEntries = [...group.entries].sort(getSortComparator(groupConfig.option, groupConfig.direction))
  return (
    <div>
      <div className="flex w-full items-center justify-between bg-muted" style={{ height: 32, padding: '0 16px' }}>
        <button className="flex flex-1 items-center gap-1.5 border-none bg-transparent cursor-pointer p-0" onClick={onToggle}>
          <span className="font-mono-label text-muted-foreground">{group.label}</span>
          <span className="font-mono-label text-muted-foreground" style={{ fontWeight: 400 }}>{group.entries.length}</span>
        </button>
        <span className="flex items-center gap-1.5">
          <SortDropdown groupLabel={group.label} current={groupConfig.option} direction={groupConfig.direction} onChange={handleSortChange} />
          <button className="flex items-center border-none bg-transparent cursor-pointer p-0 text-muted-foreground" onClick={onToggle}>
            {isCollapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
          </button>
        </span>
      </div>
      {!isCollapsed && sortedEntries.map((entry) => renderItem(entry))}
    </div>
  )
}

function TrashWarningBanner({ expiredCount }: { expiredCount: number }) {
  if (expiredCount === 0) return null
  return (
    <div className="flex items-start gap-2 border-b border-[var(--border)]" style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--destructive) 6%, transparent)' }}>
      <Warning size={16} className="shrink-0" style={{ color: 'var(--destructive)', marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--destructive)' }}>Notes in trash for 30+ days will be permanently deleted</div>
        <div className="text-muted-foreground" style={{ fontSize: 11 }}>{expiredCount} {expiredCount === 1 ? 'note is' : 'notes are'} past the 30-day retention period</div>
      </div>
    </div>
  )
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">{text}</div>
}

function resolveHeaderTitle(selection: SidebarSelection, typeDocument: VaultEntry | null): string {
  if (selection.kind === 'entity') return selection.entry.title
  if (typeDocument) return typeDocument.title
  if (selection.kind === 'filter' && selection.filter === 'archived') return 'Archive'
  if (selection.kind === 'filter' && selection.filter === 'trash') return 'Trash'
  return 'Notes'
}

function useTypeEntryMap(entries: VaultEntry[]) {
  return useMemo(() => {
    const map: Record<string, VaultEntry> = {}
    for (const e of entries) {
      if (e.isA === 'Type') map[e.title] = e
    }
    return map
  }, [entries])
}

// --- View sub-components ---

function EntityView({ entity, groups, query, collapsedGroups, sortPrefs, onToggleGroup, onSortChange, renderItem, typeEntryMap, onSelectNote }: {
  entity: VaultEntry; groups: RelationshipGroup[]; query: string
  collapsedGroups: Set<string>; sortPrefs: Record<string, SortConfig>
  onToggleGroup: (label: string) => void; onSortChange: (label: string, opt: SortOption, dir: SortDirection) => void
  renderItem: (entry: VaultEntry) => React.ReactNode
  typeEntryMap: Record<string, VaultEntry>; onSelectNote: (entry: VaultEntry) => void
}) {
  return (
    <div className="h-full overflow-y-auto">
      <PinnedCard entry={entity} typeEntryMap={typeEntryMap} onSelectNote={onSelectNote} showDate />
      {groups.length === 0
        ? <EmptyMessage text={query ? 'No matching items' : 'No related items'} />
        : groups.map((group) => (
          <RelationshipGroupSection key={group.label} group={group} isCollapsed={collapsedGroups.has(group.label)} sortPrefs={sortPrefs} onToggle={() => onToggleGroup(group.label)} handleSortChange={onSortChange} renderItem={renderItem} />
        ))
      }
    </div>
  )
}

function ListView({ typeDocument, isTrashView, expiredTrashCount, searched, query, renderItem, typeEntryMap, onSelectNote }: {
  typeDocument: VaultEntry | null; isTrashView: boolean; expiredTrashCount: number
  searched: VaultEntry[]; query: string
  renderItem: (entry: VaultEntry) => React.ReactNode
  typeEntryMap: Record<string, VaultEntry>; onSelectNote: (entry: VaultEntry) => void
}) {
  const emptyText = isTrashView ? 'Trash is empty' : (query ? 'No matching notes' : 'No notes found')
  return (
    <div className="h-full overflow-y-auto">
      {typeDocument && <PinnedCard entry={typeDocument} typeEntryMap={typeEntryMap} onSelectNote={onSelectNote} />}
      <TrashWarningBanner expiredCount={isTrashView ? expiredTrashCount : 0} />
      {searched.length === 0
        ? <EmptyMessage text={emptyText} />
        : searched.map((entry) => renderItem(entry))
      }
    </div>
  )
}

// --- Pure helpers ---

function filterByQuery<T extends { title: string }>(items: T[], query: string): T[] {
  return query ? items.filter((e) => e.title.toLowerCase().includes(query)) : items
}

function filterGroupsByQuery(groups: RelationshipGroup[], query: string): RelationshipGroup[] {
  if (!query) return groups
  return groups.map((g) => ({ ...g, entries: filterByQuery(g.entries, query) })).filter((g) => g.entries.length > 0)
}

function countExpiredTrash(entries: VaultEntry[]): number {
  const now = Date.now() / 1000
  return entries.filter((e) => e.trashedAt && (now - e.trashedAt) >= 86400 * 30).length
}

// --- Data hooks ---

interface NoteListDataParams {
  entries: VaultEntry[]; selection: SidebarSelection; allContent: Record<string, string>
  query: string; listSort: SortOption; listDirection: SortDirection; modifiedFiles?: ModifiedFile[]
}

function useNoteListData({ entries, selection, allContent, query, listSort, listDirection, modifiedFiles }: NoteListDataParams) {
  const isEntityView = selection.kind === 'entity'
  const isTrashView = selection.kind === 'filter' && selection.filter === 'trash'

  const typeDocument = useMemo(() => {
    if (selection.kind !== 'sectionGroup') return null
    return entries.find((e) => e.isA === 'Type' && e.title === selection.type) ?? null
  }, [selection, entries])

  const searched = useMemo(() => {
    if (isEntityView) return []
    const sorted = [...filterEntries(entries, selection, modifiedFiles)].sort(getSortComparator(listSort, listDirection))
    return filterByQuery(sorted, query)
  }, [entries, selection, modifiedFiles, isEntityView, listSort, listDirection, query])

  const searchedGroups = useMemo(() => {
    if (!isEntityView) return []
    const groups = buildRelationshipGroups(selection.entry, entries, allContent)
    return filterGroupsByQuery(groups, query)
  }, [isEntityView, selection, entries, allContent, query])

  const expiredTrashCount = useMemo(
    () => isTrashView ? countExpiredTrash(searched) : 0,
    [isTrashView, searched],
  )

  return { isEntityView, isTrashView, typeDocument, searched, searchedGroups, expiredTrashCount }
}

// --- Main component ---

function NoteListInner({ entries, selection, selectedNote, allContent, modifiedFiles, onSelectNote, onCreateNote }: NoteListProps) {
  const [search, setSearch] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortPrefs, setSortPrefs] = useState<Record<string, SortConfig>>(loadSortPreferences)

  const handleSortChange = useCallback((groupLabel: string, option: SortOption, direction: SortDirection) => {
    setSortPrefs((prev) => { const next = { ...prev, [groupLabel]: { option, direction } }; saveSortPreferences(next); return next })
  }, [])

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => { const next = new Set(prev); next.has(label) ? next.delete(label) : next.add(label); return next })
  }, [])

  const typeEntryMap = useTypeEntryMap(entries)
  const query = search.trim().toLowerCase()
  const listConfig = sortPrefs['__list__'] ?? { option: 'modified' as SortOption, direction: 'desc' as SortDirection }
  const listSort = listConfig.option
  const listDirection = listConfig.direction
  const { isEntityView, isTrashView, typeDocument, searched, searchedGroups, expiredTrashCount } = useNoteListData({ entries, selection, allContent, query, listSort, listDirection, modifiedFiles })

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} typeEntryMap={typeEntryMap} onSelectNote={onSelectNote} />
  ), [selectedNote?.path, onSelectNote, typeEntryMap])

  return (
    <div className="flex flex-col overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <div className="flex h-[45px] shrink-0 items-center justify-between border-b border-border px-4" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <h3 className="m-0 min-w-0 flex-1 truncate text-[14px] font-semibold">{resolveHeaderTitle(selection, typeDocument)}</h3>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {!isEntityView && <SortDropdown groupLabel="__list__" current={listSort} direction={listDirection} onChange={handleSortChange} />}
          <button className="flex items-center text-muted-foreground transition-colors hover:text-foreground" onClick={() => { setSearchVisible(!searchVisible); if (searchVisible) setSearch('') }} title="Search notes">
            <MagnifyingGlass size={16} />
          </button>
          <button className="flex items-center text-muted-foreground transition-colors hover:text-foreground" onClick={() => onCreateNote()} title="Create new note">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {searchVisible && (
        <div className="border-b border-border px-3 py-2">
          <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-[13px]" autoFocus />
        </div>
      )}

      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {isEntityView && selection.kind === 'entity' ? (
          <EntityView entity={selection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onSelectNote={onSelectNote} />
        ) : (
          <ListView typeDocument={typeDocument} isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} searched={searched} query={query} renderItem={renderItem} typeEntryMap={typeEntryMap} onSelectNote={onSelectNote} />
        )}
      </div>
    </div>
  )
}

export const NoteList = memo(NoteListInner)
