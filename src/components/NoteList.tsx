import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus, InboxPeriod, ViewFile } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import { countByFilter, countAllByFilter } from '../utils/noteListHelpers'
import { NoteItem } from './NoteItem'
import type { MultiSelectState } from '../hooks/useMultiSelect'
import { BulkActionBar } from './BulkActionBar'
import { NoteListHeader } from './note-list/NoteListHeader'
import { FilterPills } from './note-list/FilterPills'
import { EntityView, ListView } from './note-list/NoteListViews'
import { type DeletedNoteEntry, resolveHeaderTitle } from './note-list/noteListUtils'
import {
  useChangeStatusResolver,
  useListPropertyPicker,
  useModifiedFilesState,
  useMultiSelectKeyboard,
  useNoteListData,
  useNoteListInteractions,
  useNoteListSearch,
  useNoteListSort,
  useTypeEntryMap,
  useVisibleNotesSync,
} from './note-list/noteListHooks'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function useViewFlags(selection: SidebarSelection) {
  const isSectionGroup = selection.kind === 'sectionGroup'
  const isFolderView = selection.kind === 'folder'
  const isInboxView = selection.kind === 'filter' && selection.filter === 'inbox'
  const isAllNotesView = selection.kind === 'filter' && selection.filter === 'all'
  const isChangesView = selection.kind === 'filter' && selection.filter === 'changes'
  const showFilterPills = isSectionGroup || isFolderView || isAllNotesView
  return { isSectionGroup, isFolderView, isInboxView, isAllNotesView, isChangesView, showFilterPills }
}

function useBulkActions(
  multiSelect: MultiSelectState,
  onBulkArchive: NoteListProps['onBulkArchive'],
  onBulkDeletePermanently: NoteListProps['onBulkDeletePermanently'],
  isArchivedView: boolean,
) {
  const handleBulkArchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkArchive?.(paths) }, [multiSelect, onBulkArchive])
  const handleBulkDeletePermanently = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkDeletePermanently?.(paths) }, [multiSelect, onBulkDeletePermanently])
  const handleBulkUnarchive = useCallback(() => { const paths = [...multiSelect.selectedPaths]; multiSelect.clear(); onBulkArchive?.(paths) }, [multiSelect, onBulkArchive])
  const bulkArchiveOrUnarchive = isArchivedView ? handleBulkUnarchive : handleBulkArchive
  return { handleBulkArchive, handleBulkDeletePermanently, handleBulkUnarchive, bulkArchiveOrUnarchive }
}

function ChangesContextMenu({ isChangesView, onDiscardFile, modifiedFiles }: { isChangesView: boolean; onDiscardFile?: (relativePath: string) => Promise<void>; modifiedFiles?: ModifiedFile[] }) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: VaultEntry } | null>(null)
  const [actionTarget, setActionTarget] = useState<{ entry: VaultEntry; action: 'discard' | 'restore'; relativePath: string } | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const resolveActionTarget = useCallback((entry: VaultEntry) => {
    const file = modifiedFiles?.find((modified) => modified.path === entry.path || entry.path.endsWith('/' + modified.relativePath))
    if (!file) return null
    return {
      entry,
      action: file.status === 'deleted' ? 'restore' as const : 'discard' as const,
      relativePath: file.relativePath,
    }
  }, [modifiedFiles])

  const openContextMenuForEntry = useCallback((entry: VaultEntry, point: { x: number; y: number }) => {
    if (!isChangesView || !onDiscardFile) return
    setCtxMenu({ x: point.x, y: point.y, entry })
  }, [isChangesView, onDiscardFile])

  const handleNoteContextMenu = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenuForEntry(entry, { x: e.clientX, y: e.clientY })
  }, [openContextMenuForEntry])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) closeCtxMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu, closeCtxMenu])

  const handleChangeConfirm = useCallback(async () => {
    if (!actionTarget || !onDiscardFile) return
    await onDiscardFile(actionTarget.relativePath)
    setActionTarget(null)
  }, [actionTarget, onDiscardFile])

  const menuActionTarget = ctxMenu ? resolveActionTarget(ctxMenu.entry) : null
  const menuActionLabel = menuActionTarget?.action === 'restore' ? 'Restore note' : 'Discard changes'

  const contextMenuNode = ctxMenu ? (
    <div ref={ctxMenuRef} className="fixed z-50 rounded-md border bg-popover p-1 shadow-md" style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 180 }} data-testid="changes-context-menu">
      <button
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default hover:bg-accent hover:text-accent-foreground transition-colors border-none bg-transparent text-left text-destructive"
        onClick={() => {
          if (!menuActionTarget) return
          setActionTarget(menuActionTarget)
          closeCtxMenu()
        }}
        data-testid={menuActionTarget?.action === 'restore' ? 'restore-note-button' : 'discard-changes-button'}
      >
        {menuActionLabel}
      </button>
    </div>
  ) : null

  const dialogNode = (
    <Dialog open={!!actionTarget} onOpenChange={(open) => { if (!open) setActionTarget(null) }}>
      <DialogContent showCloseButton={false} data-testid={actionTarget?.action === 'restore' ? 'restore-confirm-dialog' : 'discard-confirm-dialog'}>
        <DialogHeader>
          <DialogTitle>{actionTarget?.action === 'restore' ? 'Restore note' : 'Discard changes'}</DialogTitle>
          <DialogDescription>
            {actionTarget?.action === 'restore'
              ? <>Restore <strong>{actionTarget?.entry.filename ?? 'this file'}</strong> from Git?</>
              : <>Discard changes to <strong>{actionTarget?.entry.title ?? 'this file'}</strong>? This cannot be undone.</>
            }
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
          <Button variant={actionTarget?.action === 'restore' ? 'default' : 'destructive'} onClick={handleChangeConfirm} data-testid={actionTarget?.action === 'restore' ? 'restore-confirm-button' : 'discard-confirm-button'}>
            {actionTarget?.action === 'restore' ? 'Restore' : 'Discard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { handleNoteContextMenu, openContextMenuForEntry, contextMenuNode, dialogNode }
}

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
  onBulkDeletePermanently?: (paths: string[]) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  onAutoTriggerDiff?: () => void
  onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
}

function NoteListInner({ entries, selection, selectedNote, noteListFilter, onNoteListFilterChange, inboxPeriod = 'all', modifiedFiles, modifiedFilesError, getNoteStatus, sidebarCollapsed, onSelectNote, onReplaceActiveTab, onCreateNote, onBulkArchive, onBulkDeletePermanently, onUpdateTypeSort, updateEntry, onOpenInNewWindow, onDiscardFile, onAutoTriggerDiff, onOpenDeletedNote, inboxNoteListProperties, onUpdateInboxNoteListProperties, views, visibleNotesRef }: NoteListProps) {
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)

  const { isSectionGroup, isFolderView, isInboxView, isAllNotesView, isChangesView, showFilterPills } = useViewFlags(selection)
  const subFilter = showFilterPills ? noteListFilter : undefined

  const filterCounts = useMemo(
    () => isSectionGroup && selection.kind === 'sectionGroup' ? countByFilter(entries, selection.type) : (isAllNotesView || isFolderView) ? countAllByFilter(entries) : { open: 0, archived: 0 },
    [entries, isSectionGroup, isAllNotesView, isFolderView, selection],
  )

  const { listSort, listDirection, customProperties, handleSortChange, sortPrefs, typeDocument } = useNoteListSort({ entries, selection, modifiedPathSet, modifiedSuffixes, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined, onUpdateTypeSort, updateEntry })
  const { search, setSearch, query, searchVisible, toggleSearch } = useNoteListSearch()
  const typeEntryMap = useTypeEntryMap(entries)
  const { inboxDisplayOverride, propertyPicker } = useListPropertyPicker({
    entries,
    selection,
    inboxPeriod,
    typeDocument,
    typeEntryMap,
    inboxNoteListProperties,
    onUpdateInboxNoteListProperties,
    onUpdateTypeSort,
  })
  const { isEntityView, isArchivedView, searched, searchedGroups } = useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes, modifiedFiles, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined, views })
  useVisibleNotesSync({ visibleNotesRef, isEntityView, searched, searchedGroups })
  const entitySelection = isEntityView && selection.kind === 'entity' ? selection : null

  const { handleNoteContextMenu, openContextMenuForEntry, contextMenuNode, dialogNode } = ChangesContextMenu({ isChangesView, onDiscardFile, modifiedFiles })
  const {
    collapsedGroups,
    handleClickNote,
    handleCreateNote,
    handleListKeyDown,
    multiSelect,
    noteListKeyboard,
    toggleGroup,
  } = useNoteListInteractions({
    searched,
    selectedNotePath: selectedNote?.path ?? null,
    selection,
    noteListFilter,
    isEntityView,
    isChangesView,
    onReplaceActiveTab,
    onSelectNote,
    onOpenDeletedNote,
    onOpenInNewWindow,
    onAutoTriggerDiff,
    onDiscardFile,
    openContextMenuForEntry,
    onCreateNote,
  })
  const getChangeStatus = useChangeStatusResolver(isChangesView, modifiedFiles)

  const { handleBulkArchive, handleBulkDeletePermanently, handleBulkUnarchive, bulkArchiveOrUnarchive } = useBulkActions(multiSelect, onBulkArchive, onBulkDeletePermanently, isArchivedView)
  useMultiSelectKeyboard(multiSelect, isEntityView, bulkArchiveOrUnarchive, handleBulkDeletePermanently)

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} isHighlighted={entry.path === noteListKeyboard.highlightedPath} noteStatus={resolvedGetNoteStatus(entry.path)} changeStatus={getChangeStatus(entry.path)} typeEntryMap={typeEntryMap} allEntries={entries} displayPropsOverride={inboxDisplayOverride} onClickNote={handleClickNote} onContextMenu={isChangesView && onDiscardFile ? handleNoteContextMenu : undefined} />
  ), [entries, selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, getChangeStatus, multiSelect.selectedPaths, noteListKeyboard.highlightedPath, isChangesView, onDiscardFile, handleNoteContextMenu, inboxDisplayOverride])
  const title = resolveHeaderTitle(selection, typeDocument, views)

  return (
    <div className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground" style={{ height: '100%' }}>
      <NoteListHeader title={title} typeDocument={typeDocument} isEntityView={isEntityView} listSort={listSort} listDirection={listDirection} customProperties={customProperties} sidebarCollapsed={sidebarCollapsed} searchVisible={searchVisible} search={search} propertyPicker={propertyPicker} onSortChange={handleSortChange} onCreateNote={handleCreateNote} onOpenType={onReplaceActiveTab} onToggleSearch={toggleSearch} onSearchChange={setSearch} />
      <div className="relative flex flex-1 flex-col overflow-hidden outline-none" style={{ minHeight: 0 }} tabIndex={0} onKeyDown={handleListKeyDown} onFocus={noteListKeyboard.handleFocus} data-testid="note-list-container">
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {entitySelection ? (
            <EntityView entity={entitySelection.entry} groups={searchedGroups} query={query} collapsedGroups={collapsedGroups} sortPrefs={sortPrefs} onToggleGroup={toggleGroup} onSortChange={handleSortChange} renderItem={renderItem} typeEntryMap={typeEntryMap} onClickNote={handleClickNote} />
          ) : (
            <ListView isArchivedView={isArchivedView} isChangesView={isChangesView} isInboxView={isInboxView} changesError={modifiedFilesError} searched={searched} query={query} renderItem={renderItem} virtuosoRef={noteListKeyboard.virtuosoRef} />
          )}
        </div>
        {showFilterPills && <FilterPills active={noteListFilter} counts={filterCounts} onChange={onNoteListFilterChange} position="bottom" />}
      </div>
      {multiSelect.isMultiSelecting && (
        <BulkActionBar count={multiSelect.selectedPaths.size} isArchivedView={isArchivedView} onArchive={handleBulkArchive} onDelete={handleBulkDeletePermanently} onUnarchive={handleBulkUnarchive} onClear={multiSelect.clear} />
      )}
      {contextMenuNode}
      {dialogNode}
    </div>
  )
}

export const NoteList = memo(NoteListInner)
