import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { useDragRegion } from '../hooks/useDragRegion'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus } from '../types'
import { Input } from '@/components/ui/input'
import {
  MagnifyingGlass, Plus, CaretDown, CaretRight, Warning,
} from '@phosphor-icons/react'
import { getTypeColor, getTypeLightColor, buildTypeEntryMap } from '../utils/typeColors'
import { NoteItem, getTypeIcon } from './NoteItem'
import { prefetchNoteContent } from '../hooks/useTabManagement'
import { SortDropdown } from './SortDropdown'
import { BulkActionBar } from './BulkActionBar'
import { useMultiSelect, type MultiSelectState } from '../hooks/useMultiSelect'
import { useNoteListKeyboard } from '../hooks/useNoteListKeyboard'
import {
  type SortOption, type SortDirection, type SortConfig, type RelationshipGroup,
  getSortComparator, extractSortableProperties,
  buildRelationshipGroups, filterEntries,
  relativeDate, getDisplayDate,
  loadSortPreferences, saveSortPreferences,
  parseSortConfig, serializeSortConfig, clearListSortFromLocalStorage,
} from '../utils/noteListHelpers'

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  modifiedFiles?: ModifiedFile[]
  modifiedFilesError?: string | null
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onCreateNote: () => void
  onBulkArchive?: (paths: string[]) => void
  onBulkTrash?: (paths: string[]) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
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
  const customProperties = useMemo(() => extractSortableProperties(group.entries), [group.entries])
  return (
    <div>
      <div className="flex w-full items-center justify-between bg-muted" style={{ height: 32, padding: '0 16px' }}>
        <button className="flex flex-1 items-center gap-1.5 border-none bg-transparent cursor-pointer p-0" onClick={onToggle}>
          <span className="font-mono-label text-muted-foreground">{group.label}</span>
          <span className="font-mono-label text-muted-foreground" style={{ fontWeight: 400 }}>{group.entries.length}</span>
        </button>
        <span className="flex items-center gap-1.5">
          <SortDropdown groupLabel={group.label} current={groupConfig.option} direction={groupConfig.direction} customProperties={customProperties} onChange={handleSortChange} />
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

function ListViewHeader({ isTrashView, expiredTrashCount }: {
  isTrashView: boolean; expiredTrashCount: number
}) {
  return <TrashWarningBanner expiredCount={isTrashView ? expiredTrashCount : 0} />
}

function resolveEmptyText(isChangesView: boolean, changesError: string | null | undefined, isTrashView: boolean, query: string): string {
  if (isChangesView && changesError) return `Failed to load changes: ${changesError}`
  if (isChangesView) return 'No pending changes'
  if (isTrashView) return 'Trash is empty'
  return query ? 'No matching notes' : 'No notes found'
}

function ListView({ isTrashView, isChangesView, changesError, expiredTrashCount, searched, query, renderItem, virtuosoRef }: {
  isTrashView: boolean; isChangesView?: boolean; changesError?: string | null; expiredTrashCount: number
  searched: VaultEntry[]; query: string
  renderItem: (entry: VaultEntry) => React.ReactNode
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>
}) {
  const emptyText = resolveEmptyText(!!isChangesView, changesError ?? null, isTrashView, query)
  const hasHeader = isTrashView && expiredTrashCount > 0

  if (searched.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        {hasHeader && <ListViewHeader isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} />}
        <EmptyMessage text={emptyText} />
      </div>
    )
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: '100%' }}
      data={searched}
      overscan={200}
      components={{
        Header: hasHeader ? () => <ListViewHeader isTrashView={isTrashView} expiredTrashCount={expiredTrashCount} /> : undefined,
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

interface ClickActions {
  onReplace: (entry: VaultEntry) => void
  onSelect: (entry: VaultEntry) => void
  multiSelect: { selectRange: (path: string) => void; clear: () => void; setAnchor: (path: string) => void }
}

function routeNoteClick(entry: VaultEntry, e: React.MouseEvent, actions: ClickActions) {
  if (e.shiftKey) { actions.multiSelect.selectRange(entry.path) }
  else if (e.metaKey || e.ctrlKey) { actions.multiSelect.clear(); actions.onSelect(entry) }
  else { actions.multiSelect.clear(); actions.multiSelect.setAnchor(entry.path); actions.onReplace(entry) }
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
  entries: VaultEntry[]; selection: SidebarSelection
  query: string; listSort: SortOption; listDirection: SortDirection
  modifiedPathSet: Set<string>; modifiedSuffixes: string[]
}

function isModifiedEntry(path: string, pathSet: Set<string>, suffixes: string[]): boolean {
  if (pathSet.has(path)) return true
  return suffixes.some((suffix) => path.endsWith(suffix))
}

function useFilteredEntries(entries: VaultEntry[], selection: SidebarSelection, modifiedPathSet: Set<string>, modifiedSuffixes: string[]) {
  const isEntityView = selection.kind === 'entity'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  return useMemo(() => {
    if (isEntityView) return []
    if (isChangesView) return entries.filter((e) => isModifiedEntry(e.path, modifiedPathSet, modifiedSuffixes))
    return filterEntries(entries, selection)
  }, [entries, selection, isEntityView, isChangesView, modifiedPathSet, modifiedSuffixes])
}

function useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes }: NoteListDataParams) {
  const isEntityView = selection.kind === 'entity'
  const isTrashView = selection.kind === 'filter' && selection.filter === 'trash'

  const filteredEntries = useFilteredEntries(entries, selection, modifiedPathSet, modifiedSuffixes)

  const searched = useMemo(() => {
    const sorted = [...filteredEntries].sort(getSortComparator(listSort, listDirection))
    return filterByQuery(sorted, query)
  }, [filteredEntries, listSort, listDirection, query])

  const searchedGroups = useMemo(() => {
    if (!isEntityView) return []
    const groups = buildRelationshipGroups(selection.entry, entries)
    return filterGroupsByQuery(groups, query)
  }, [isEntityView, selection, entries, query])

  const expiredTrashCount = useMemo(
    () => isTrashView ? countExpiredTrash(searched) : 0,
    [isTrashView, searched],
  )

  return { isEntityView, isTrashView, searched, searchedGroups, expiredTrashCount }
}

// --- Pure helpers ---

const DEFAULT_LIST_CONFIG: SortConfig = { option: 'modified', direction: 'desc' }

function resolveListSortConfig(typeDocument: VaultEntry | null, sortPrefs: Record<string, SortConfig>): SortConfig {
  if (typeDocument?.sort) {
    const parsed = parseSortConfig(typeDocument.sort)
    if (parsed) return parsed
  }
  return sortPrefs['__list__'] ?? DEFAULT_LIST_CONFIG
}

// --- Extracted hooks ---

interface SortPersistence {
  onUpdateTypeSort: (path: string, key: string, value: string) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
}

function persistSortToType(path: string, config: SortConfig, persistence: SortPersistence) {
  const serialized = serializeSortConfig(config)
  persistence.onUpdateTypeSort(path, 'sort', serialized)
  persistence.updateEntry(path, { sort: serialized })
  clearListSortFromLocalStorage()
}

function migrateListSortToType(typeDoc: VaultEntry, sortPrefs: Record<string, SortConfig>, migrationDone: Set<string>, persistence: SortPersistence) {
  if (typeDoc.sort || migrationDone.has(typeDoc.path)) return
  const lsConfig = sortPrefs['__list__']
  if (!lsConfig) return
  migrationDone.add(typeDoc.path)
  persistSortToType(typeDoc.path, lsConfig, persistence)
}

function saveGroupSort(groupLabel: string, option: SortOption, direction: SortDirection, setSortPrefs: React.Dispatch<React.SetStateAction<Record<string, SortConfig>>>) {
  setSortPrefs((prev) => { const next = { ...prev, [groupLabel]: { option, direction } }; saveSortPreferences(next); return next })
}

function deriveEffectiveSort(configOption: SortOption, customProperties: string[]): SortOption {
  if (!configOption.startsWith('property:')) return configOption
  return customProperties.includes(configOption.slice('property:'.length)) ? configOption : 'modified'
}

interface UseNoteListSortParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  modifiedPathSet: Set<string>
  modifiedSuffixes: string[]
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
}

function useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, onUpdateTypeSort, updateEntry }: UseNoteListSortParams) {
  const [sortPrefs, setSortPrefs] = useState<Record<string, SortConfig>>(loadSortPreferences)

  const typeDocument = useMemo(() => {
    if (selection.kind !== 'sectionGroup') return null
    return entries.find((e) => e.isA === 'Type' && e.title === selection.type) ?? null
  }, [selection, entries])

  const listConfig = resolveListSortConfig(typeDocument, sortPrefs)
  const persistence = useMemo<SortPersistence | null>(
    () => (onUpdateTypeSort && updateEntry) ? { onUpdateTypeSort, updateEntry } : null,
    [onUpdateTypeSort, updateEntry],
  )

  const migrationDoneRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!typeDocument || !persistence) return
    migrateListSortToType(typeDocument, sortPrefs, migrationDoneRef.current, persistence)
  }, [typeDocument, sortPrefs, persistence])

  const handleSortChange = useCallback((groupLabel: string, option: SortOption, direction: SortDirection) => {
    if (groupLabel === '__list__' && typeDocument && persistence) {
      persistSortToType(typeDocument.path, { option, direction }, persistence)
    } else {
      saveGroupSort(groupLabel, option, direction, setSortPrefs)
    }
  }, [typeDocument, persistence])

  const filteredEntries = useFilteredEntries(entries, selection, modifiedPathSet, modifiedSuffixes)
  const customProperties = useMemo(() => extractSortableProperties(filteredEntries), [filteredEntries])
  const listSort = useMemo<SortOption>(() => deriveEffectiveSort(listConfig.option, customProperties), [listConfig.option, customProperties])
  const listDirection = listSort === listConfig.option ? listConfig.direction : 'desc'

  return { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument }
}

function useNoteListSearch() {
  const [search, setSearch] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const query = search.trim().toLowerCase()

  const toggleSearch = useCallback(() => {
    setSearchVisible((v) => { if (v) setSearch(''); return !v })
  }, [])

  return { search, setSearch, query, searchVisible, toggleSearch }
}

function isInputFocused(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || !!(el as HTMLElement)?.isContentEditable
}

function handleEscapeKey(e: KeyboardEvent, multiSelect: MultiSelectState) {
  if (e.key !== 'Escape' || !multiSelect.isMultiSelecting) return
  e.preventDefault()
  multiSelect.clear()
}

function handleSelectAllKey(e: KeyboardEvent, multiSelect: MultiSelectState, isEntityView: boolean) {
  if (e.key !== 'a' || !(e.metaKey || e.ctrlKey) || isEntityView || isInputFocused()) return
  e.preventDefault()
  multiSelect.selectAll()
}

function handleBulkActionKey(e: KeyboardEvent, multiSelect: MultiSelectState, onArchive: () => void, onTrash: () => void) {
  if (!multiSelect.isMultiSelecting || !(e.metaKey || e.ctrlKey)) return
  if (e.key === 'e') { e.preventDefault(); e.stopPropagation(); onArchive() }
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); onTrash() }
}

function useMultiSelectKeyboard(multiSelect: MultiSelectState, isEntityView: boolean, onBulkArchive: () => void, onBulkTrash: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      handleEscapeKey(e, multiSelect)
      handleSelectAllKey(e, multiSelect, isEntityView)
      handleBulkActionKey(e, multiSelect, onBulkArchive, onBulkTrash)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [multiSelect, isEntityView, onBulkArchive, onBulkTrash])
}

// --- Header component ---

function NoteListHeader({ title, typeDocument, isEntityView, listSort, listDirection, customProperties, sidebarCollapsed, searchVisible, search, onSortChange, onCreateNote, onOpenType, onToggleSearch, onSearchChange }: {
  title: string
  typeDocument: VaultEntry | null
  isEntityView: boolean
  listSort: SortOption
  listDirection: SortDirection
  customProperties: string[]
  sidebarCollapsed?: boolean
  searchVisible: boolean
  search: string
  onSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  onCreateNote: () => void
  onOpenType: (entry: VaultEntry) => void
  onToggleSearch: () => void
  onSearchChange: (value: string) => void
}) {
  const { onMouseDown: onDragMouseDown } = useDragRegion()
  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4" onMouseDown={onDragMouseDown} style={{ cursor: 'default', paddingLeft: sidebarCollapsed ? 80 : undefined }}>
        <h3
          className="m-0 min-w-0 flex-1 truncate text-[14px] font-semibold"
          style={typeDocument ? { cursor: 'pointer' } : undefined}
          onClick={typeDocument ? () => onOpenType(typeDocument) : undefined}
          data-testid={typeDocument ? 'type-header-link' : undefined}
        >
          {title}
        </h3>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {!isEntityView && <SortDropdown groupLabel="__list__" current={listSort} direction={listDirection} customProperties={customProperties} onChange={onSortChange} />}
          <button className="flex items-center text-muted-foreground transition-colors hover:text-foreground" onClick={onToggleSearch} title="Search notes">
            <MagnifyingGlass size={16} />
          </button>
          <button className="flex items-center text-muted-foreground transition-colors hover:text-foreground" onClick={() => onCreateNote()} title="Create new note">
            <Plus size={16} />
          </button>
        </div>
      </div>
      {searchVisible && (
        <div className="border-b border-border px-3 py-2">
          <Input placeholder="Search notes..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="h-8 text-[13px]" autoFocus />
        </div>
      )}
    </>
  )
}

// --- Main component ---

const defaultGetNoteStatus = (): NoteStatus => 'clean'

function useModifiedFilesState(modifiedFiles: ModifiedFile[] | undefined, getNoteStatus: ((path: string) => NoteStatus) | undefined) {
  const modifiedPathSet = useMemo(() => new Set((modifiedFiles ?? []).map((f) => f.path)), [modifiedFiles])
  const modifiedSuffixes = useMemo(() => (modifiedFiles ?? []).map((f) => '/' + f.relativePath), [modifiedFiles])
  const resolvedGetNoteStatus = useMemo<(path: string) => NoteStatus>(
    () => createNoteStatusResolver(getNoteStatus, modifiedFiles, modifiedPathSet),
    [getNoteStatus, modifiedFiles, modifiedPathSet],
  )
  return { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus }
}

function NoteListInner({ entries, selection, selectedNote, modifiedFiles, modifiedFilesError, getNoteStatus, sidebarCollapsed, onSelectNote, onReplaceActiveTab, onCreateNote, onBulkArchive, onBulkTrash, onUpdateTypeSort, updateEntry }: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, onUpdateTypeSort, updateEntry })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const typeEntryMap = useTypeEntryMap(entries)
  const { isEntityView, isTrashView, searched, searchedGroups, expiredTrashCount } = useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes })
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const entitySelection = isEntityView && selection.kind === 'entity' ? selection : null

  const noteListKeyboard = useNoteListKeyboard({ items: searched, selectedNotePath: selectedNote?.path ?? null, onOpen: onReplaceActiveTab, enabled: !isEntityView })
  const multiSelect = useMultiSelect(searched, selectedNote?.path ?? null)
  useEffect(() => { multiSelect.clear() }, [selection]) // eslint-disable-line react-hooks/exhaustive-deps -- clear on selection change only

  const handleClickNote = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    routeNoteClick(entry, e, { onReplace: onReplaceActiveTab, onSelect: onSelectNote, multiSelect })
  }, [onReplaceActiveTab, onSelectNote, multiSelect])

  const handleBulkArchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkArchive?.(paths) }, [multiSelect, onBulkArchive])
  const handleBulkTrash = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkTrash?.(paths) }, [multiSelect, onBulkTrash])
  useMultiSelectKeyboard(multiSelect, isEntityView, handleBulkArchive, handleBulkTrash)

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} isHighlighted={entry.path === noteListKeyboard.highlightedPath} noteStatus={resolvedGetNoteStatus(entry.path)} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} onPrefetch={prefetchNoteContent} />
  ), [selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, multiSelect.selectedPaths, noteListKeyboard.highlightedPath])

  const toggleGroup = useCallback((label: string) => { setCollapsedGroups((prev) => toggleSetMember(prev, label)) }, [])
  const title = resolveHeaderTitle(selection, typeDocument)

  return (
    <div className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <NoteListHeader title={title} typeDocument={typeDocument} isEntityView={isEntityView} listSort={listSort} listDirection={listDirection} customProperties={customProperties} sidebarCollapsed={sidebarCollapsed} searchVisible={searchVisible} search={search} onSortChange={handleSortChange} onCreateNote={onCreateNote} onOpenType={onReplaceActiveTab} onToggleSearch={toggleSearch} onSearchChange={setSearch} />
      <div className="flex-1 overflow-hidden outline-none" style={{ minHeight: 0 }} tabIndex={0} onKeyDown={noteListKeyboard.handleKeyDown} onFocus={noteListKeyboard.handleFocus} data-testid="note-list-container">
        {entitySelection ? (
          <EntityView entity={entitySelection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
        ) : (
          <ListView isTrashView={isTrashView} isChangesView={isChangesView} changesError={modifiedFilesError} expiredTrashCount={expiredTrashCount} searched={searched} query={query} renderItem={renderItem} virtuosoRef={noteListKeyboard.virtuosoRef} />
        )}
      </div>
      {multiSelect.isMultiSelecting && (
        <BulkActionBar count={multiSelect.selectedPaths.size} onArchive={handleBulkArchive} onTrash={handleBulkTrash} onClear={multiSelect.clear} />
      )}
    </div>
  )
}

export const NoteList = memo(NoteListInner)
