import { useCallback, useEffect, useMemo } from 'react'
import { collectionFromSelection } from '../../collections/collectionFromSelection'
import { useAppLocale, useDateDisplayFormat } from '../../hooks/useAppPreferences'
import type { MultiSelectState } from '../../hooks/useMultiSelect'
import type { ImmediateCreateOptions } from '../../hooks/useNoteCreation'
import { prefetchNoteContent } from '../../hooks/useTabManagement'
import type { AppLocale } from '../../lib/i18n'
import type {
  InboxPeriod,
  ModifiedFile,
  NoteStatus,
  SidebarSelection,
  VaultEntry,
  ViewDefinition,
  ViewFile,
} from '../../types'
import type { AllNotesFileVisibility } from '../../utils/allNotesFileVisibility'
import type { GitRepositoryOption } from '../../utils/gitRepositories'
import type { NoteListFilter, RelationshipGroup } from '../../utils/noteListHelpers'
import { countAllByFilter, countAllNotesByFilter, countByFilter } from '../../utils/noteListHelpers'
import { addNoteListSearchToggleListener, dispatchNoteListSearchAvailability } from '../../utils/noteListSearchEvents'
import { NoteItem } from '../NoteItem'
import { useChangesContextMenu } from './NoteListChangesMenu'
import { useNoteListContextMenu } from './NoteListContextMenu'
import { useNoteListFullTextSearch } from './noteListFullTextSearch'
import {
  useChangeStatusResolver,
  useListPropertyPicker,
  useModifiedFilesState,
  useNoteListData,
  useNoteListInteractions,
  useNoteListSort,
  useTypeEntryMap,
  useVisibleNotesSync,
} from './noteListHooks'
import { filterEntriesByNoteListQuery, filterGroupsByNoteListQuery } from './noteListSearch'
import { type DeletedNoteEntry, isDeletedNoteEntry, resolveHeaderTitle } from './noteListUtils'
import { useNoteListPreload } from './useNoteListPreload'
import { useNoteListSearchState } from './useNoteListSearchState'

type EntitySelection = Extract<SidebarSelection, { kind: 'entity' }>

function resolveViewFlags(selection: SidebarSelection) {
  const isSectionGroup = selection.kind === 'sectionGroup'
  const isFolderView = selection.kind === 'folder'
  const filter = selection.kind === 'filter' ? selection.filter : null
  const isInboxView = filter === 'inbox'
  const isAllNotesView = filter === 'all'
  const isChangesView = filter === 'changes'
  const showFilterPills = isSectionGroup || isFolderView
  return {
    isSectionGroup,
    isFolderView,
    isInboxView,
    isAllNotesView,
    isChangesView,
    showFilterPills,
  }
}

function useBulkActions(
  multiSelect: MultiSelectState,
  onBulkArchive: NoteListProps['onBulkArchive'],
  onBulkDeletePermanently: NoteListProps['onBulkDeletePermanently'],
  isArchivedView: boolean,
) {
  const handleBulkArchive = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkArchive?.(paths)
  }, [multiSelect, onBulkArchive])

  const handleBulkDeletePermanently = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkDeletePermanently?.(paths)
  }, [multiSelect, onBulkDeletePermanently])

  const handleBulkUnarchive = useCallback(() => {
    const paths = [...multiSelect.selectedPaths]
    multiSelect.clear()
    onBulkArchive?.(paths)
  }, [multiSelect, onBulkArchive])

  const bulkArchiveOrUnarchive = isArchivedView ? handleBulkUnarchive : handleBulkArchive

  return {
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    bulkArchiveOrUnarchive,
  }
}

function useFilterCounts(
  entries: VaultEntry[],
  selection: SidebarSelection,
  allNotesFileVisibility?: AllNotesFileVisibility,
) {
  return useMemo(() => {
    if (selection.kind === 'sectionGroup') return countByFilter(entries, selection.type)
    if (selection.kind === 'folder') return countAllByFilter(entries)
    if (selection.kind === 'filter' && selection.filter === 'all') {
      return countAllNotesByFilter(entries, allNotesFileVisibility)
    }
    return { open: 0, archived: 0 }
  }, [allNotesFileVisibility, entries, selection])
}

interface UseNoteListContentParams {
  entries: VaultEntry[]
  selection: SidebarSelection
  noteListFilter: NoteListFilter
  inboxPeriod: InboxPeriod
  modifiedFiles?: ModifiedFile[]
  modifiedSuffixes: string[]
  modifiedPathSet: Set<string>
  isInboxView: boolean
  selectedNotePath: string | null
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: (value: string[] | null) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>, rootPath?: string) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
  allNotesFileVisibility?: AllNotesFileVisibility
}

function useFilteredNoteListSearch(options: {
  entries: VaultEntry[]
  sortedEntries: VaultEntry[]
  sortedGroups: RelationshipGroup[]
  query: string
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  dateDisplayFormat: ReturnType<typeof useDateDisplayFormat>
  appLocale: ReturnType<typeof useAppLocale>
}) {
  const { entries, sortedEntries, sortedGroups, query, typeEntryMap, displayPropsOverride, dateDisplayFormat, appLocale } = options
  const fullTextSearch = useNoteListFullTextSearch(entries, query)
  const searchContext = useMemo(
    () => ({
    allEntries: entries,
    typeEntryMap,
    displayPropsOverride,
    dateDisplayFormat,
    appLocale,
    fullTextResultPaths: fullTextSearch.resultPaths,
    }),
    [appLocale, dateDisplayFormat, displayPropsOverride, entries, fullTextSearch.resultPaths, typeEntryMap],
  )
  const searched = useMemo(
    () => filterEntriesByNoteListQuery(sortedEntries, query, searchContext),
    [query, searchContext, sortedEntries],
  )
  const searchedGroups = useMemo(
    () => filterGroupsByNoteListQuery(sortedGroups, query, searchContext),
    [query, searchContext, sortedGroups],
  )

  return {
    isFullTextSearching: fullTextSearch.loading,
    searched,
    searchedGroups,
  }
}

function useNoteListContent(options: UseNoteListContentParams) {
  const { entries, selection, noteListFilter, inboxPeriod, isInboxView, selectedNotePath, visibleNotesRef } = options
  const dateDisplayFormat = useDateDisplayFormat('note-list')
  const appLocale = useAppLocale()
  const subFilter = selection.kind === 'sectionGroup' || selection.kind === 'folder' ? noteListFilter : undefined
  const scopedOptions = { ...options, subFilter, inboxPeriod: isInboxView ? inboxPeriod : undefined }
  const sort = useNoteListSort(scopedOptions)
  const searchState = useNoteListSearchState()
  const typeEntryMap = useTypeEntryMap(entries)
  const properties = useListPropertyPicker({ ...options, typeDocument: sort.typeDocument, typeEntryMap })
  const data = useNoteListData({ ...scopedOptions, ...sort, query: '' })
  const { isFullTextSearching, searched, searchedGroups } = useFilteredNoteListSearch({
    entries,
    sortedEntries: data.searched,
    sortedGroups: data.searchedGroups,
    query: searchState.query,
    typeEntryMap,
    displayPropsOverride: properties.displayPropsOverride,
    dateDisplayFormat,
    appLocale,
  })
  const visibleEntries = useVisibleNotesSync({
    visibleNotesRef,
    isEntityView: data.isEntityView,
    entityEntry: data.entityEntry,
    searched,
    searchedGroups,
  })
  useNoteListPreload(searched, selectedNotePath)
  return {
    ...sort,
    ...properties,
    ...data,
    ...searchState,
    isSearching: searchState.isSearching || isFullTextSearching,
    searched,
    searchedGroups,
    visibleEntries,
    typeEntryMap,
  }
}

    interface UseNoteListInteractionStateParams {
      searched: VaultEntry[]
      visibleEntries: VaultEntry[]
      selectedNotePath: string | null
      selection: SidebarSelection
      noteListFilter: NoteListFilter
      isArchivedView: boolean
      isChangesView: boolean
      searchVisible: boolean
      toggleSearch: () => void
      modifiedFiles?: ModifiedFile[]
      onReplaceActiveTab: (entry: VaultEntry) => void
      onEnterNeighborhood?: (entry: VaultEntry) => void
      onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
      onOpenInNewWindow?: (entry: VaultEntry) => void
      onRenameFilename?: (path: string, newFilenameStem: string) => void
      onExportPdf?: (entry: VaultEntry) => void
      onToggleFavorite?: (path: string) => void
      onToggleOrganized?: (path: string) => void
      onRevealFile?: (path: string) => void
      onCopyFilePath?: (path: string) => void
      canCopyGitUrl?: (entry: VaultEntry) => boolean
      onCopyGitUrl?: (entry: VaultEntry) => void
      onAutoTriggerDiff?: () => void
      onDiscardFile?: (relativePath: string) => Promise<void>
      onCreateNote: (type?: string, options?: ImmediateCreateOptions) => void
      onBulkArchive?: (paths: string[]) => void
      onBulkDeletePermanently?: (paths: string[]) => void
      locale: AppLocale
    }

function useNoteListInteractionState(options: UseNoteListInteractionStateParams) {
  const { isChangesView, modifiedFiles, onBulkArchive, onBulkDeletePermanently, isArchivedView } = options
  const changesContextMenu = useChangesContextMenu(options)
  const noteListContextMenu = useNoteListContextMenu({
    ...options,
    onArchivePaths: onBulkArchive,
    onDeletePaths: onBulkDeletePermanently,
  })
  const interactions = useNoteListInteractions({
    ...options,
    openContextMenuForEntry: changesContextMenu.openContextMenuForEntry,
  })
  const getChangeStatus = useChangeStatusResolver(isChangesView, modifiedFiles)
  const bulkActions = useBulkActions(interactions.multiSelect, onBulkArchive, onBulkDeletePermanently, isArchivedView)
  return { ...interactions, ...bulkActions, changesContextMenu, noteListContextMenu, getChangeStatus }
}

    interface UseRenderItemParams {
      entries: VaultEntry[]
      selectedNotePath: string | null
      typeEntryMap: Record<string, VaultEntry>
      displayPropsOverride?: string[] | null
      isChangesView: boolean
      onDiscardFile?: (relativePath: string) => Promise<void>
      resolvedGetNoteStatus: (path: string) => NoteStatus
      getChangeStatus: (path: string) => ModifiedFile['status'] | undefined
      handleClickNote: (entry: VaultEntry, event: React.MouseEvent) => void
      changesContextMenu?: ((entry: VaultEntry, event: React.MouseEvent) => void) | undefined
      noteListContextMenu?: ((entry: VaultEntry, event: React.MouseEvent) => void) | undefined
      multiSelect: MultiSelectState
      noteListKeyboard: { highlightedPath: string | null }
    }

    function useRenderItem(functionOptions: UseRenderItemParams) {
  const { entries, selectedNotePath, typeEntryMap, displayPropsOverride, isChangesView, onDiscardFile, resolvedGetNoteStatus, getChangeStatus, handleClickNote, changesContextMenu, noteListContextMenu, multiSelect, noteListKeyboard } = functionOptions
  const contextMenuHandler = isChangesView && onDiscardFile ? changesContextMenu : noteListContextMenu

  return useCallback(
    (entry: VaultEntry, options?: { forceSelected?: boolean }) =>
    (
      <NoteItem
        key={entry.path}
        entry={entry}
        isSelected={options?.forceSelected || selectedNotePath === entry.path}
        isMultiSelected={multiSelect.selectedPaths.has(entry.path)}
        isHighlighted={entry.path === noteListKeyboard.highlightedPath}
        noteStatus={resolvedGetNoteStatus(entry.path)}
        changeStatus={getChangeStatus(entry.path)}
        typeEntryMap={typeEntryMap}
        allEntries={entries}
        displayPropsOverride={displayPropsOverride}
        onClickNote={handleClickNote}
        onPrefetch={isDeletedNoteEntry(entry) ? undefined : prefetchNoteContent}
        onContextMenu={contextMenuHandler}
      />
      ),
    [
    contextMenuHandler,
    displayPropsOverride,
    entries,
    getChangeStatus,
    handleClickNote,
    multiSelect.selectedPaths,
    noteListKeyboard.highlightedPath,
    resolvedGetNoteStatus,
    selectedNotePath,
    typeEntryMap,
    ],
  )
}

export interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  loading?: boolean
  noteListFilter: NoteListFilter
  onNoteListFilterChange: (filter: NoteListFilter) => void
  inboxPeriod?: InboxPeriod
  onInboxPeriodChange?: (period: InboxPeriod) => void
  modifiedFiles?: ModifiedFile[]
  modifiedFilesError?: string | null
  gitRepositories?: GitRepositoryOption[]
  selectedGitRepositoryPath?: string
  onGitRepositoryChange?: (path: string) => void
  getNoteStatus?: (path: string) => NoteStatus
  sidebarCollapsed?: boolean
  onSelectNote: (entry: VaultEntry) => void
  onReplaceActiveTab: (entry: VaultEntry) => void
  onEnterNeighborhood?: (entry: VaultEntry) => void
  onCreateNote: (type?: string) => void
  onBulkArchive?: (paths: string[]) => void
  onBulkDeletePermanently?: (paths: string[]) => void
  onUpdateTypeSort?: (path: string, key: string, value: string | number | boolean | string[] | null) => void
  updateEntry?: (path: string, patch: Partial<VaultEntry>) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  onExportPdf?: (entry: VaultEntry) => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onRevealFile?: (path: string) => void
  onCopyFilePath?: (path: string) => void
  canCopyGitUrl?: (entry: VaultEntry) => boolean
  onCopyGitUrl?: (entry: VaultEntry) => void
  onDiscardFile?: (relativePath: string) => Promise<void>
  onAutoTriggerDiff?: () => void
  onOpenDeletedNote?: (entry: DeletedNoteEntry) => void
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: (value: string[] | null) => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: (value: string[] | null) => void
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>, rootPath?: string) => void
  views?: ViewFile[]
  visibleNotesRef?: React.MutableRefObject<VaultEntry[]>
  allNotesFileVisibility?: AllNotesFileVisibility
  vaultPath?: string
  locale?: AppLocale
}

type NoteListLayoutModelParams = {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  vaultPath?: NoteListProps['vaultPath']
  views?: ViewFile[]
  onUpdateViewDefinition?: NoteListProps['onUpdateViewDefinition']
  onUpdateTypeSort?: NoteListProps['onUpdateTypeSort']
  sidebarCollapsed?: boolean
  loading: boolean
  modifiedFilesError?: string | null
  gitRepositories?: GitRepositoryOption[]
  selectedGitRepositoryPath?: string
  onGitRepositoryChange?: (path: string) => void
  noteListFilter: NoteListFilter
  filterCounts: ReturnType<typeof useFilterCounts>
  onNoteListFilterChange: (filter: NoteListFilter) => void
  onOpenType: (entry: VaultEntry) => void
  locale: AppLocale
  content: ReturnType<typeof useNoteListContent> & {
    handleSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  }
  interaction: ReturnType<typeof useNoteListInteractionState> & {
    renderItem: (entry: VaultEntry, options?: { forceSelected?: boolean }) => React.ReactNode
    entitySelection: EntitySelection | null
  }
}

function noteListHeaderModel(params: NoteListLayoutModelParams) {
  const flags = resolveViewFlags(params.selection)
  return {
    ...flags,
    title: resolveHeaderTitle(params.selection, params.content.typeDocument, params.views, params.locale),
    loading: params.loading,
    locale: params.locale,
    typeDocument: params.content.typeDocument,
    isEntityView: params.content.isEntityView,
    listSort: params.content.listSort,
    listDirection: params.content.listDirection,
    customProperties: params.content.customProperties,
    sidebarCollapsed: params.sidebarCollapsed,
    searchVisible: params.content.searchVisible,
    search: params.content.search,
    isSearching: params.content.isSearching,
    searchInputRef: params.content.searchInputRef,
    propertyPicker: params.content.propertyPicker,
    handleSortChange: params.content.handleSortChange,
    handleCreateNote: params.interaction.handleCreateNote,
    onOpenType: params.onOpenType,
    toggleSearch: params.content.toggleSearch,
    setSearch: params.content.setSearch,
    handleSearchKeyDown: params.content.handleSearchKeyDown,
  }
}

function noteListKeyboardBindings(keyboard: NoteListLayoutModelParams['interaction']['noteListKeyboard']) {
  return {
    noteListPanelRef: keyboard.panelRef,
    handleNoteListPanelBlurCapture: keyboard.handlePanelBlurCapture,
    handleNoteListPanelFocusCapture: keyboard.handlePanelFocusCapture,
    noteListContainerRef: keyboard.containerRef,
    handleNoteListBlur: keyboard.handleBlur,
    handleNoteListFocus: keyboard.handleFocus,
    focusNoteList: keyboard.focusList,
    noteListVirtuosoRef: keyboard.virtuosoRef,
  }
}

function noteListInteractionModel(params: NoteListLayoutModelParams) {
  const { gitRepositories = [], selectedGitRepositoryPath = '' } = params
  return {
    handleListKeyDown: params.interaction.handleListKeyDown,
    ...noteListKeyboardBindings(params.interaction.noteListKeyboard),
    entitySelection: params.interaction.entitySelection,
    searchedGroups: params.content.searchedGroups,
    collapsedGroups: params.interaction.collapsedGroups,
    sortPrefs: params.content.sortPrefs,
    toggleGroup: params.interaction.toggleGroup,
    renderItem: params.interaction.renderItem,
    typeEntryMap: params.content.typeEntryMap,
    displayPropsOverride: params.content.displayPropsOverride,
    allEntries: params.entries,
    selectedNotePath: params.selectedNote?.path ?? null,
    handleClickNote: params.interaction.handleClickNote,
    isArchivedView: params.content.isArchivedView,
    gitRepositories,
    selectedGitRepositoryPath,
    onGitRepositoryChange: params.onGitRepositoryChange,
    modifiedFilesError: params.modifiedFilesError,
    visibleEntries: params.content.visibleEntries,
    selection: params.selection,
    presentation: collectionFromSelection(params.selection, { views: params.views }).presentation,
    vaultPath: params.vaultPath,
    onUpdateViewDefinition: params.onUpdateViewDefinition,
    views: params.views,
    onUpdateTypeSort: params.onUpdateTypeSort,
    searched: params.content.searched,
    query: params.content.query,
    noteListFilter: params.noteListFilter,
    filterCounts: params.filterCounts,
    onNoteListFilterChange: params.onNoteListFilterChange,
    multiSelect: params.interaction.multiSelect,
    handleBulkArchive: params.interaction.handleBulkArchive,
    handleBulkDeletePermanently: params.interaction.handleBulkDeletePermanently,
    handleBulkUnarchive: params.interaction.handleBulkUnarchive,
    contextMenuNode: (
      <>
        {params.interaction.changesContextMenu.contextMenuNode}
        {params.interaction.noteListContextMenu.contextMenuNode}
      </>
    ),
    dialogNode: params.interaction.changesContextMenu.dialogNode,
  }
}

function buildNoteListLayoutModel(params: NoteListLayoutModelParams) {
  return {
    ...noteListHeaderModel(params),
    ...noteListInteractionModel(params),
  }
}

export function useNoteListModel(options: NoteListProps) {
  const { entries, selection, selectedNote, loading = false, inboxPeriod = 'all', modifiedFiles, getNoteStatus, onReplaceActiveTab, allNotesFileVisibility, locale = 'en' } = options
  const selectedNotePath = selectedNote?.path ?? null
  const { modifiedPathSet, modifiedSuffixes, resolvedGetNoteStatus } = useModifiedFilesState(modifiedFiles, getNoteStatus)
  const { isInboxView, isChangesView } = resolveViewFlags(selection)
  const filterCounts = useFilterCounts(entries, selection, allNotesFileVisibility)
  const content = useNoteListContent({ ...options, inboxPeriod, modifiedSuffixes, modifiedPathSet, isInboxView, selectedNotePath })
  const interaction = useNoteListInteractionState({ ...options, ...content, selectedNotePath, isChangesView, locale })
  const renderItem = useRenderItem({
    ...options, ...content, ...interaction, selectedNotePath, isChangesView, resolvedGetNoteStatus,
    changesContextMenu: interaction.changesContextMenu.handleNoteContextMenu,
    noteListContextMenu: interaction.noteListContextMenu.handleNoteContextMenu,
  })
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    content.closeSearch()
    requestAnimationFrame(() => interaction.noteListKeyboard.focusList())
  }
  const { isPanelActive: isNoteListSearchActive, toggleSearchShortcut } = interaction.noteListKeyboard
  useEffect(() => {
    dispatchNoteListSearchAvailability(isNoteListSearchActive)
    return () => dispatchNoteListSearchAvailability(false)
  }, [isNoteListSearchActive])
  useEffect(() => {
    return addNoteListSearchToggleListener(() => {
      if (isNoteListSearchActive) toggleSearchShortcut()
    })
  }, [isNoteListSearchActive, toggleSearchShortcut])
  return buildNoteListLayoutModel({
    ...options, loading, filterCounts, locale, onOpenType: onReplaceActiveTab,
    content: { ...content, handleSearchKeyDown },
    interaction: {
      ...interaction,
      renderItem,
      entitySelection: selection.kind === 'entity'
        ? { ...selection, entry: content.entityEntry ?? selection.entry }
        : null,
    },
  })
}
