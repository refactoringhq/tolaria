import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus, InboxPeriod, ViewFile } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import { countByFilter, countAllByFilter } from '../utils/noteListHelpers'
import { NoteItem } from './NoteItem'
import { prefetchNoteContent } from '../hooks/useTabManagement'
import { BulkActionBar } from './BulkActionBar'
import { useMultiSelect } from '../hooks/useMultiSelect'
import { useNoteListKeyboard } from '../hooks/useNoteListKeyboard'
import { NoteListHeader } from './note-list/NoteListHeader'
import { FilterPills } from './note-list/FilterPills'
import { EntityView, ListView } from './note-list/NoteListViews'
import { DeletedNotesBanner } from './note-list/TrashWarningBanner'
import { routeNoteClick, toggleSetMember, resolveHeaderTitle } from './note-list/noteListUtils'
import {
  useTypeEntryMap, useNoteListData, useNoteListSearch,
  useNoteListSort, useMultiSelectKeyboard, useModifiedFilesState,
} from './note-list/noteListHooks'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  noteListFilter: NoteListFilter
  onNoteListFilterChange: (filter: NoteListFilter) => void
  inboxPeriod?: InboxPeriod
  onInboxPeriodChange?: (period: InboxPeriod) => void
  modifiedFiles?: ModifiedFile[]
  modifiedFilesError?: string | null
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onCreateNote: (type?: string) => void
  onBulkArchive?: (paths: string[]) => void
  onBulkTrash?: (paths: string[]) => void
  onBulkRestore?: (paths: string[]) => void
  onBulkDeletePermanently?: (paths: string[]) => void
  onEmptyTrash?: () => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  views?: ViewFile[]
}

function NoteListInner({ entries, selection, selectedNote, noteListFilter, onNoteListFilterChange, inboxPeriod = 'all', modifiedFiles, modifiedFilesError, getNoteStatus, sidebarCollapsed, onSelectNote, onReplaceActiveTab, onCreateNote, onBulkArchive, onBulkTrash, onBulkRestore, onBulkDeletePermanently, onEmptyTrash, onUpdateTypeSort, updateEntry, onOpenInNewWindow, onDiscardFile, views }: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)

  const isSectionGroup = selection.kind === 'sectionGroup'
  const isFolderView = selection.kind === 'folder'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  const isAllNotesView = selection.kind === 'filter' && selection.filter === 'all'
  const showFilterPills = isSectionGroup || isFolderView || isAllNotesView
  const subFilter = showFilterPills ? noteListFilter : undefined

  const filterCounts = useMemo(
    () => isSectionGroup ? countByFilter(entries, selection.type) : (isAllNotesView || isFolderView) ? countAllByFilter(entries) : { open: 0, archived: 0, trashed: 0 },
    [entries, isSectionGroup, isAllNotesView, isFolderView, selection],
  )

  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined, onUpdateTypeSort, updateEntry })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const typeEntryMap = useTypeEntryMap(entries)
  const { isEntityView, isTrashView, isArchivedView, searched, searchedGroups, expiredTrashCount } = useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined, views })
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const deletedCount = useMemo(
    () => isChangesView ? (modifiedFiles ?? []).filter((f) => f.status === 'deleted').length : 0,
    [isChangesView, modifiedFiles],
  )
  const entitySelection = isEntityView && selection.kind === 'entity' ? selection : null

  const noteListKeyboard = useNoteListKeyboard({ items: searched, selectedNotePath: selectedNote?.path ?? null, onOpen: onReplaceActiveTab, enabled: !isEntityView })
  const multiSelect = useMultiSelect(searched, selectedNote?.path ?? null)
  useEffect(() => { multiSelect.clear() }, [selection, noteListFilter]) // eslint-disable-line react-hooks/exhaustive-deps -- clear on selection/filter change

  const handleClickNote = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    routeNoteClick(entry, e, { onReplace: onReplaceActiveTab, onSelect: onSelectNote, onOpenInNewWindow, multiSelect })
  }, [onReplaceActiveTab, onSelectNote, onOpenInNewWindow, multiSelect])

  const handleBulkArchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkArchive?.(paths) }, [multiSelect, onBulkArchive])
  const handleBulkTrash = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkTrash?.(paths) }, [multiSelect, onBulkTrash])
  const handleBulkRestore = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkRestore?.(paths) }, [multiSelect, onBulkRestore])
  const handleBulkDeletePermanently = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkDeletePermanently?.(paths) }, [multiSelect, onBulkDeletePermanently])
  const handleBulkUnarchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkRestore?.(paths) }, [multiSelect, onBulkRestore])
  const bulkArchiveOrRestore = isTrashView ? handleBulkRestore : isArchivedView ? handleBulkUnarchive : handleBulkArchive
  const bulkTrashOrDelete = isTrashView ? handleBulkDeletePermanently : handleBulkTrash
  useMultiSelectKeyboard(multiSelect, isEntityView, bulkArchiveOrRestore, bulkTrashOrDelete)

  // ── Changes view: context menu + discard confirmation ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: VaultEntry } | null>(null)
  const [discardTarget, setDiscardTarget] = useState<VaultEntry | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const handleNoteContextMenu = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    if (!isChangesView || !onDiscardFile) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }, [isChangesView, onDiscardFile])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) closeCtxMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu, closeCtxMenu])

  const handleDiscardConfirm = useCallback(async () => {
    if (!discardTarget || !onDiscardFile) return
    const mf = modifiedFiles?.find((f) => f.path === discardTarget.path)
    if (!mf) return
    await onDiscardFile(mf.relativePath)
    setDiscardTarget(null)
  }, [discardTarget, onDiscardFile, modifiedFiles])

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} isHighlighted={entry.path === noteListKeyboard.highlightedPath} noteStatus={resolvedGetNoteStatus(entry.path)} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} onPrefetch={prefetchNoteContent} onContextMenu={isChangesView && onDiscardFile ? handleNoteContextMenu : undefined} />
  ), [selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, multiSelect.selectedPaths, noteListKeyboard.highlightedPath, isChangesView, onDiscardFile, handleNoteContextMenu])

  const handleCreateNote = useCallback(() => {
    onCreateNote(selection.kind === 'sectionGroup' ? selection.type : undefined)
  }, [onCreateNote, selection])
  const toggleGroup = useCallback((label: string) => { setCollapsedGroups((prev) => toggleSetMember(prev, label)) }, [])
  const title = resolveHeaderTitle(selection, typeDocument, views)

  return (
    <div className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <NoteListHeader title={title} typeDocument={typeDocument} isEntityView={isEntityView} isTrashView={isTrashView} trashCount={searched.length} listSort={listSort} listDirection={listDirection} customProperties={customProperties} sidebarCollapsed={sidebarCollapsed} searchVisible={searchVisible} search={search} isSectionGroup={isSectionGroup} entries={entries} onSortChange={handleSortChange} onCreateNote={handleCreateNote} onOpenType={onReplaceActiveTab} onToggleSearch={toggleSearch} onSearchChange={setSearch} onEmptyTrash={onEmptyTrash} onUpdateTypeProperty={onUpdateTypeSort} />
      <div className="relative flex flex-1 flex-col overflow-hidden outline-none" style={{ minHeight: 0 }} tabIndex={0} onKeyDown={noteListKeyboard.handleKeyDown} onFocus={noteListKeyboard.handleFocus} data-testid="note-list-container">
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {entitySelection ? (
            <EntityView entity={entitySelection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
          ) : (
            <ListView isTrashView={isTrashView} isArchivedView={isArchivedView} isChangesView={isChangesView} isInboxView={isInboxView} changesError={modifiedFilesError} expiredTrashCount={expiredTrashCount} deletedCount={deletedCount} searched={searched} query={query} renderItem={renderItem} virtuosoRef={noteListKeyboard.virtuosoRef} />
          )}
        </div>
        {isChangesView && deletedCount > 0 && <DeletedNotesBanner count={deletedCount} />}
        {showFilterPills && <FilterPills active={noteListFilter} counts={filterCounts} onChange={onNoteListFilterChange} position="bottom" />}
      </div>
      {multiSelect.isMultiSelecting && (
        <BulkActionBar count={multiSelect.selectedPaths.size} isTrashView={isTrashView} isArchivedView={isArchivedView} onArchive={handleBulkArchive} onTrash={handleBulkTrash} onRestore={handleBulkRestore} onDeletePermanently={handleBulkDeletePermanently} onUnarchive={handleBulkUnarchive} onClear={multiSelect.clear} />
      )}

      {/* Changes view: context menu */}
      {ctxMenu && (
        <div ref={ctxMenuRef} className="fixed z-50 rounded-md border bg-popover p-1 shadow-md" style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 180 }} data-testid="changes-context-menu">
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default hover:bg-accent hover:text-accent-foreground transition-colors border-none bg-transparent text-left text-destructive"
            onClick={() => { setDiscardTarget(ctxMenu.entry); closeCtxMenu() }}
            data-testid="discard-changes-button"
          >
            Discard changes
          </button>
        </div>
      )}

      {/* Discard confirmation dialog */}
      <Dialog open={!!discardTarget} onOpenChange={(open) => { if (!open) setDiscardTarget(null) }}>
        <DialogContent showCloseButton={false} data-testid="discard-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Discard changes</DialogTitle>
            <DialogDescription>
              Discard changes to <strong>{discardTarget?.title ?? 'this file'}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDiscardConfirm} data-testid="discard-confirm-button">Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const NoteList = memo(NoteListInner)
