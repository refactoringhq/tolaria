import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { useDragRegion } from '../hooks/useDragRegion'
import { Virtuoso } from 'react-virtuoso'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus } from '../types'
import { Input } from '@/components/ui/input'
import {
  MagnifyingGlass, Plus, CaretDown, CaretRight, Warning,
} from '@phosphor-icons/react'
import { getTypeColor, getTypeLightColor, buildTypeEntryMap } from '../utils/typeColors'
import { NoteItem, getTypeIcon } from './NoteItem'
import { SortDropdown } from './SortDropdown'
import { BulkActionBar } from './BulkActionBar'
import { useMultiSelect } from '../hooks/useMultiSelect'
import {
  type SortOption, type SortDirection, type SortConfig, type RelationshipGroup,
  getSortComparator,
  buildRelationshipGroups, filterEntries,
  relativeDate, getDisplayDate,
  loadSortPreferences, saveSortPreferences,
} from '../utils/noteListHelpers'

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  allContent: Record<string, string>
  modifiedFiles?: ModifiedFile[]
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onCreateNote: () => void
  onBulkArchive?: (paths: string[]) => void
  onBulkTrash?: (paths: string[]) => void
}

function PinnedCard({ entry, typeEntryMap, onClickNote, showDate }: {
  entry: VaultEntry
  typeEntryMap: Record<string, VaultEntry>
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
  showDate?: boolean
}) {
  const te = typeEntryMap[entry.isA ?? '']
  const color = getTypeColor(entry.isA ?? '', te?.color)
  const bgColor = getTypeLightColor(entry.isA ?? '', te?.color)
  const Icon = getTypeIcon(entry.isA, te?.icon)
  return (
    <div className="relative cursor-pointer border-b border-[var(--border)]" style={{ backgroundColor: bgColor, padding: '14px 16px' }} onClick={(e: React.MouseEvent) => onClickNote(entry, e)}>
      {/* eslint-disable-next-line react-hooks/static-components */}
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
  if (selection.kind === 'filter' && selection.filter === 'changes') return 'Changes'
  return 'Notes'
}

function useTypeEntryMap(entries: VaultEntry[]) {
  return useMemo(() => buildTypeEntryMap(entries), [entries])
}

// --- View sub-components ---

function EntityView({ entity, groups, query, collapsedGroups, sortPrefs, onToggleGroup, onSortChange, renderItem, typeEntryMap, onClickNote }: {
  entity: VaultEntry; groups: RelationshipGroup[]; query: string
  collapsedGroups: Set<string>; sortPrefs: Record<string, SortConfig>
  onToggleGroup: (label: string) => void; onSortChange: (label: string, opt: SortOption, dir: SortDirection) => void
  renderItem: (entry: VaultEntry) => React.ReactNode
  typeEntryMap: Record<string, VaultEntry>; onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  return (
    <div className="h-full overflow-y-auto">
      <PinnedCard entry={entity} typeEntryMap={typeEntryMap} onClickNote={onClickNote} showDate />
      {groups.length === 0
        ? <EmptyMessage text={query ? 'No matching items' : 'No related items'} />
        : groups.map((group) => (
          <RelationshipGroupSection key={group.label} group={group} isCollapsed={collapsedGroups.has(group.label)} sortPrefs={sortPrefs} onToggle={() => onToggleGroup(group.label)} handleSortChange={onSortChange} renderItem={renderItem} />
        ))
      }
    </div>
  )
}

function ListViewHeader({ typeDocument, isTrashView, expiredTrashCount, typeEntryMap, onClickNote }: {
  typeDocument: VaultEntry | null; isTrashView: boolean; expiredTrashCount: number
  typeEntryMap: Record<string, VaultEntry>; onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  return (
    <>
      {typeDocument && <PinnedCard entry={typeDocument} typeEntryMap={typeEntryMap} onClickNote={onClickNote} />}
      <TrashWarningBanner expiredCount={isTrashView ? expiredTrashCount : 0} />
    </>
  )
}

function ListView({ typeDocument, isTrashView, isChangesView, expiredTrashCount, searched, query, renderItem, typeEntryMap, onClickNote }: {
  typeDocument: VaultEntry | null; isTrashView: boolean; isChangesView?: boolean; expiredTrashCount: number
  searched: VaultEntry[]; query: string
  renderItem: (entry: VaultEntry) => React.ReactNode
  typeEntryMap: Record<string, VaultEntry>; onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  const emptyText = isChangesView ? 'No pending changes' : isTrashView ? 'Trash is empty' : (query ? 'No matching notes' : 'No notes found')
  const hasHeader = typeDocument || (isTrashView && expiredTrashCount > 0)

  if (searched.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        {hasHeader && <ListViewHeader typeDocument={typeDocument} isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} typeEntryMap={typeEntryMap} onClickNote={onClickNote} />}
        <EmptyMessage text={emptyText} />
      </div>
    )
  }

  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={searched}
      overscan={200}
      components={{
        Header: hasHeader ? () => <ListViewHeader typeDocument={typeDocument} isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} typeEntryMap={typeEntryMap} onClickNote={onClickNote} /> : undefined,
      }}
      itemContent={(_index, entry) => renderItem(entry)}
    />
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

// --- Click routing ---

type MultiSelectActions = { selectRange: (path: string) => void; clear: () => void; setAnchor: (path: string) => void }

function routeNoteClick(
  entry: VaultEntry, e: React.MouseEvent,
  onReplaceActiveTab: (entry: VaultEntry) => void,
  onSelectNote: (entry: VaultEntry) => void,
  multiSelect: MultiSelectActions,
) {
  if (e.shiftKey) { multiSelect.selectRange(entry.path) }
  else if (e.metaKey || e.ctrlKey) { multiSelect.clear(); onSelectNote(entry) }
  else { multiSelect.clear(); multiSelect.setAnchor(entry.path); onReplaceActiveTab(entry) }
}

// --- Pure helpers extracted from NoteListInner to reduce cyclomatic complexity ---

function createNoteStatusResolver(
  getNoteStatus: ((path: string) => NoteStatus) | undefined,
  modifiedFiles: ModifiedFile[] | undefined,
  modifiedPathSet: Set<string>,
): (path: string) => NoteStatus {
  if (getNoteStatus) return getNoteStatus
  if (modifiedFiles && modifiedFiles.length > 0) {
    return (path: string) => modifiedPathSet.has(path) ? 'modified' : 'clean'
  }
  return defaultGetNoteStatus
}

function toggleSetMember<T>(set: Set<T>, member: T): Set<T> {
  const next = new Set(set)
  if (next.has(member)) next.delete(member)
  else next.add(member)
  return next
}

// --- Data hooks ---

interface NoteListDataParams {
  entries: VaultEntry[]; selection: SidebarSelection; allContent: Record<string, string>
  query: string; listSort: SortOption; listDirection: SortDirection
  modifiedPathSet: Set<string>
}

function useNoteListData({ entries, selection, allContent, query, listSort, listDirection, modifiedPathSet }: NoteListDataParams) {
  const isEntityView = selection.kind === 'entity'
  const isTrashView = selection.kind === 'filter' && selection.filter === 'trash'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'

  const typeDocument = useMemo(() => {
    if (selection.kind !== 'sectionGroup') return null
    return entries.find((e) => e.isA === 'Type' && e.title === selection.type) ?? null
  }, [selection, entries])

  const searched = useMemo(() => {
    if (isEntityView) return []
    if (isChangesView) {
      const sorted = [...entries.filter((e) => modifiedPathSet.has(e.path))].sort(getSortComparator(listSort, listDirection))
      return filterByQuery(sorted, query)
    }
    const sorted = [...filterEntries(entries, selection)].sort(getSortComparator(listSort, listDirection))
    return filterByQuery(sorted, query)
  }, [entries, selection, isEntityView, isChangesView, listSort, listDirection, query, modifiedPathSet])

  const searchedGroups = useMemo(() => {
    if (!isEntityView) return []
    const groups = buildRelationshipGroups(selection.entry, entries, allContent)
    return filterGroupsByQuery(groups, query)
  }, [isEntityView, selection, entries, allContent, query])

  const expiredTrashCount = useMemo(
    () => isTrashView ? countExpiredTrash(searched) : 0,
    [isTrashView, searched],
  )

  return { isEntityView, isTrashView, isChangesView, typeDocument, searched, searchedGroups, expiredTrashCount }
}

// --- Main component ---

const defaultGetNoteStatus = (): NoteStatus => 'clean'

function NoteListInner({ entries, selection, selectedNote, allContent, modifiedFiles, getNoteStatus, sidebarCollapsed, onSelectNote, onReplaceActiveTab, onCreateNote, onBulkArchive, onBulkTrash }: NoteListProps) {
  const [search, setSearch] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortPrefs, setSortPrefs] = useState<Record<string, SortConfig>>(loadSortPreferences)
  const { onMouseDown: onDragMouseDown } = useDragRegion()

  const modifiedPathSet = useMemo(
    () => new Set((modifiedFiles ?? []).map((f) => f.path)),
    [modifiedFiles],
  )

  const resolvedGetNoteStatus = useMemo<(path: string) => NoteStatus>(
    () => createNoteStatusResolver(getNoteStatus, modifiedFiles, modifiedPathSet),
    [getNoteStatus, modifiedFiles, modifiedPathSet],
  )

  const handleSortChange = useCallback((groupLabel: string, option: SortOption, direction: SortDirection) => {
    setSortPrefs((prev) => { const next = { ...prev, [groupLabel]: { option, direction } }; saveSortPreferences(next); return next })
  }, [])

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => toggleSetMember(prev, label))
  }, [])

  const typeEntryMap = useTypeEntryMap(entries)
  const query = search.trim().toLowerCase()
  const listConfig = sortPrefs['__list__'] ?? { option: 'modified' as SortOption, direction: 'desc' as SortDirection }
  const listSort = listConfig.option
  const listDirection = listConfig.direction
  const { isEntityView, isTrashView, isChangesView, typeDocument, searched, searchedGroups, expiredTrashCount } = useNoteListData({ entries, selection, allContent, query, listSort, listDirection, modifiedPathSet })

  const multiSelect = useMultiSelect(searched, selectedNote?.path ?? null)

  // Clear multi-select when sidebar selection changes
  useEffect(() => { multiSelect.clear() }, [selection]) // eslint-disable-line react-hooks/exhaustive-deps -- clear on selection change only

  const handleClickNote = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    routeNoteClick(entry, e, onReplaceActiveTab, onSelectNote, multiSelect)
  }, [onReplaceActiveTab, onSelectNote, multiSelect])

  const handleBulkArchive = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkArchive?.(paths)
  }, [multiSelect, onBulkArchive])

  const handleBulkTrash = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkTrash?.(paths)
  }, [multiSelect, onBulkTrash])

  // Keyboard: Escape to clear, Cmd+A to select all, Cmd+E/Cmd+Delete for bulk actions
  // Uses capture phase so bulk shortcuts preempt the global single-note handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && multiSelect.isMultiSelecting) {
        e.preventDefault()
        multiSelect.clear()
      }
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !isEntityView) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active as HTMLElement)?.isContentEditable
        if (!isInput) {
          e.preventDefault()
          multiSelect.selectAll()
        }
      }
      if (multiSelect.isMultiSelecting && (e.metaKey || e.ctrlKey)) {
        if (e.key === 'e') {
          e.preventDefault()
          e.stopPropagation()
          handleBulkArchive()
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          e.stopPropagation()
          handleBulkTrash()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [multiSelect, isEntityView, handleBulkArchive, handleBulkTrash])

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} noteStatus={resolvedGetNoteStatus(entry.path)} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
  ), [selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, multiSelect.selectedPaths])

  return (
    <div className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4" onMouseDown={onDragMouseDown} style={{ cursor: 'default', paddingLeft: sidebarCollapsed ? 80 : undefined }}>
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
          <EntityView entity={selection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
        ) : (
          <ListView typeDocument={typeDocument} isTrashView={isTrashView} isChangesView={isChangesView} expiredTrashCount={expiredTrashCount} searched={searched} query={query} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
        )}
      </div>

      {multiSelect.isMultiSelecting && (
        <BulkActionBar count={multiSelect.selectedPaths.size} onArchive={handleBulkArchive} onTrash={handleBulkTrash} onClear={multiSelect.clear} />
      )}
    </div>
  )
}

export const NoteList = memo(NoteListInner)
