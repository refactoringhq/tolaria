import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import type { VaultEntry, SidebarSelection, ModifiedFile, NoteStatus, InboxPeriod, ViewFile } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import { countByFilter, countAllByFilter, filterInboxEntries } from '../utils/noteListHelpers'
import { NoteItem } from './NoteItem'
import { prefetchNoteContent } from '../hooks/useTabManagement'
import { BulkActionBar } from './BulkActionBar'
import { useMultiSelect } from '../hooks/useMultiSelect'
import { useNoteListKeyboard } from '../hooks/useNoteListKeyboard'
import { NoteListHeader } from './note-list/NoteListHeader'
import { FilterPills } from './note-list/FilterPills'
import { EntityView, ListView } from './note-list/NoteListViews'
import { type DeletedNoteEntry, isDeletedNoteEntry, routeNoteClick, toggleSetMember, resolveHeaderTitle } from './note-list/noteListUtils'
import {
  useTypeEntryMap, useNoteListData, useNoteListSearch,
  useNoteListSort, useMultiSelectKeyboard, useModifiedFilesState,
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

function collectAvailableProperties(entries: VaultEntry[]): string[] {
  const keys = new Set<string>()
  for (const entry of entries) {
    for (const key of Object.keys(entry.properties ?? {})) keys.add(key)
    for (const key of Object.keys(entry.relationships ?? {})) keys.add(key)
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function collectTypeAvailableProperties(entries: VaultEntry[], typeName: string): string[] {
  return collectAvailableProperties(entries.filter((entry) => entry.isA === typeName))
}

function deriveInboxDefaultDisplay(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    for (const key of typeEntryMap[entry.isA ?? '']?.listPropertiesDisplay ?? []) {
      if (seen.has(key)) continue
      seen.add(key)
      ordered.push(key)
    }
  }

  return ordered
}

function useBulkActions(
  multiSelect: ReturnType<typeof useMultiSelect>,
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const typeEntryMap = useTypeEntryMap(entries)
  const inboxEntries = useMemo(
    () => isInboxView ? filterInboxEntries(entries, inboxPeriod) : [],
    [entries, inboxPeriod, isInboxView],
  )
  const typeAvailableProperties = useMemo(
    () => typeDocument ? collectTypeAvailableProperties(entries, typeDocument.title) : [],
    [entries, typeDocument],
  )
  const inboxAvailableProperties = useMemo(
    () => collectAvailableProperties(inboxEntries),
    [inboxEntries],
  )
  const inboxDefaultDisplay = useMemo(
    () => deriveInboxDefaultDisplay(inboxEntries, typeEntryMap),
    [inboxEntries, typeEntryMap],
  )
  const hasCustomInboxProperties = !!(inboxNoteListProperties && inboxNoteListProperties.length > 0)
  const inboxDisplayOverride = isInboxView && hasCustomInboxProperties ? inboxNoteListProperties : null
  const propertyPicker = useMemo(() => {
    if (isInboxView && onUpdateInboxNoteListProperties) {
      return {
        scope: 'inbox' as const,
        availableProperties: inboxAvailableProperties,
        currentDisplay: hasCustomInboxProperties ? inboxNoteListProperties ?? [] : inboxDefaultDisplay,
        onSave: onUpdateInboxNoteListProperties,
        triggerTitle: 'Customize Inbox columns',
      }
    }

    if (isSectionGroup && typeDocument && onUpdateTypeSort) {
      return {
        scope: 'type' as const,
        availableProperties: typeAvailableProperties,
        currentDisplay: typeDocument.listPropertiesDisplay ?? [],
        onSave: (value: string[] | null) => onUpdateTypeSort(typeDocument.path, '_list_properties_display', value),
        triggerTitle: 'Customize columns',
      }
    }

    return null
  }, [
    hasCustomInboxProperties,
    inboxAvailableProperties,
    inboxDefaultDisplay,
    inboxNoteListProperties,
    isInboxView,
    isSectionGroup,
    onUpdateInboxNoteListProperties,
    onUpdateTypeSort,
    typeAvailableProperties,
    typeDocument,
  ])
  const changeStatusMap = useMemo(() => {
    if (!isChangesView || !modifiedFiles) return undefined
    const map = new Map<string, ModifiedFile['status']>()
    for (const mf of modifiedFiles) {
      map.set(mf.path, mf.status)
      // Also index by suffix for matching (vault entries may use different path formats)
      map.set('/' + mf.relativePath, mf.status)
    }
    return map
  }, [isChangesView, modifiedFiles])
  const { isEntityView, isArchivedView, searched, searchedGroups } = useNoteListData({ entries, selection, query, listSort, listDirection, modifiedPathSet, modifiedSuffixes, modifiedFiles, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined, views })
  // Keep the visible notes ref in sync for keyboard navigation (Cmd+Option+Arrow)
  if (visibleNotesRef) {
    visibleNotesRef.current = isEntityView
      ? searchedGroups.flatMap((g) => g.entries).filter((entry) => !isDeletedNoteEntry(entry))
      : searched.filter((entry) => !isDeletedNoteEntry(entry))
  }
  const entitySelection = isEntityView && selection.kind === 'entity' ? selection : null

  const handleKeyboardOpen = useCallback((entry: VaultEntry) => {
    if (isDeletedNoteEntry(entry)) {
      onOpenDeletedNote?.(entry)
      return
    }
    onReplaceActiveTab(entry)
  }, [onOpenDeletedNote, onReplaceActiveTab])
  const handleKeyboardPrefetch = useCallback((entry: VaultEntry) => {
    if (!isDeletedNoteEntry(entry)) prefetchNoteContent(entry.path)
  }, [])
  const noteListKeyboard = useNoteListKeyboard({ items: searched, selectedNotePath: selectedNote?.path ?? null, onOpen: handleKeyboardOpen, onPrefetch: handleKeyboardPrefetch, enabled: !isEntityView })
  const multiSelect = useMultiSelect(searched, selectedNote?.path ?? null)
  useEffect(() => { multiSelect.clear() }, [selection, noteListFilter]) // eslint-disable-line react-hooks/exhaustive-deps -- clear on selection/filter change

  const handleClickNote = useCallback((entry: VaultEntry, e: React.MouseEvent) => {
    if (isDeletedNoteEntry(entry)) {
      routeNoteClick(entry, e, {
        onReplace: () => onOpenDeletedNote?.(entry),
        onSelect: () => onOpenDeletedNote?.(entry),
        multiSelect,
      })
      return
    }
    routeNoteClick(entry, e, { onReplace: onReplaceActiveTab, onSelect: onSelectNote, onOpenInNewWindow, multiSelect })
    if (isChangesView && onAutoTriggerDiff) {
      // Small delay to let the tab open before triggering diff
      setTimeout(onAutoTriggerDiff, 50)
    }
  }, [onOpenDeletedNote, onReplaceActiveTab, onSelectNote, onOpenInNewWindow, multiSelect, isChangesView, onAutoTriggerDiff])

  const { handleBulkArchive, handleBulkDeletePermanently, handleBulkUnarchive, bulkArchiveOrUnarchive } = useBulkActions(multiSelect, onBulkArchive, onBulkDeletePermanently, isArchivedView)
  useMultiSelectKeyboard(multiSelect, isEntityView, bulkArchiveOrUnarchive, handleBulkDeletePermanently)

  const { handleNoteContextMenu, openContextMenuForEntry, contextMenuNode, dialogNode } = ChangesContextMenu({ isChangesView, onDiscardFile, modifiedFiles })

  const getChangeStatus = useCallback((path: string) => {
    if (!changeStatusMap) return undefined
    const direct = changeStatusMap.get(path)
    if (direct) return direct
    // Try suffix match
    for (const [key, status] of changeStatusMap) {
      if (path.endsWith(key) || key.endsWith(path.split('/').slice(-1)[0])) return status
    }
    return undefined
  }, [changeStatusMap])

  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isChangesView && onDiscardFile && e.shiftKey && e.key === 'F10' && noteListKeyboard.highlightedPath) {
      const entry = searched.find((candidate) => candidate.path === noteListKeyboard.highlightedPath)
      if (!entry) return
      e.preventDefault()
      e.stopPropagation()
      const row = document.querySelector<HTMLElement>(`[data-note-path="${entry.path}"]`)
      const rect = row?.getBoundingClientRect()
      openContextMenuForEntry(entry, {
        x: rect ? rect.left + 24 : 160,
        y: rect ? rect.bottom - 8 : 160,
      })
      return
    }
    noteListKeyboard.handleKeyDown(e)
  }, [isChangesView, onDiscardFile, noteListKeyboard, searched, openContextMenuForEntry])

  const renderItem = useCallback((entry: VaultEntry) => (
    <NoteItem key={entry.path} entry={entry} isSelected={selectedNote?.path === entry.path} isMultiSelected={multiSelect.selectedPaths.has(entry.path)} isHighlighted={entry.path === noteListKeyboard.highlightedPath} noteStatus={resolvedGetNoteStatus(entry.path)} changeStatus={getChangeStatus(entry.path)} typeEntryMap={typeEntryMap} displayPropsOverride={inboxDisplayOverride} onClickNote={handleClickNote} onPrefetch={isDeletedNoteEntry(entry) ? undefined : prefetchNoteContent} onContextMenu={isChangesView && onDiscardFile ? handleNoteContextMenu : undefined} />
  ), [selectedNote?.path, handleClickNote, typeEntryMap, resolvedGetNoteStatus, getChangeStatus, multiSelect.selectedPaths, noteListKeyboard.highlightedPath, isChangesView, onDiscardFile, handleNoteContextMenu, inboxDisplayOverride])

  const handleCreateNote = useCallback(() => {
    onCreateNote(selection.kind === 'sectionGroup' ? selection.type : undefined)
  }, [onCreateNote, selection])
  const toggleGroup = useCallback((label: string) => { setCollapsedGroups((prev) => toggleSetMember(prev, label)) }, [])
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
