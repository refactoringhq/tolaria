import { BulkActionBar } from '../BulkActionBar'
import { CollectionLayoutBody } from './CollectionLayoutBody'
import { type CollectionLayoutState, useCollectionLayout } from './useCollectionLayout'
import { CollectionLayoutHeaderControls } from './CollectionLayoutControls'
import { KanbanEditorPanelClose } from './KanbanEditorPanel'
import { useKanbanPanelOutsideClose } from './useKanbanPanelOutsideClose'
import { layoutPropertyPicker } from './kanbanCardFieldsPicker'
import { FilterPills } from './FilterPills'
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME, NoteListHeader } from './NoteListHeader'
import { EntityView, ListView } from './NoteListViews'
import type { useNoteListModel } from './useNoteListModel'

type NoteListLayoutProps = ReturnType<typeof useNoteListModel> & {
  handleBulkOrganize?: () => void
}

const NOTE_LIST_LOADING_ROWS = [
  { id: 'wide', title: 184, line: 254, selected: false },
  { id: 'selected', title: 142, line: 220, selected: true },
  { id: 'short', title: 98, line: 242, selected: false },
  { id: 'long', title: 212, line: 198, selected: false },
]

function NoteListLoadingBar({ width }: { width: number }) {
  return <span aria-hidden="true" className="block h-4 rounded bg-muted" style={{ width }} />
}

function NoteListLoadingRow({ title, line, selected }: { title: number; line: number; selected: boolean }) {
  return (
    <div
      className="border-b border-border"
      style={{
        padding: '12px 12px 10px',
        background: selected ? 'var(--accent-green-light)' : undefined,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <NoteListLoadingBar width={title} />
        <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <NoteListLoadingBar width={line} />
        <NoteListLoadingBar width={Math.round(line * 0.72)} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <NoteListLoadingBar width={44} />
        <NoteListLoadingBar width={82} />
      </div>
    </div>
  )
}

function NoteListLoadingSkeleton() {
  return (
    <div data-testid="note-list-loading-skeleton" className="animate-pulse">
      {NOTE_LIST_LOADING_ROWS.map((row) => (
        <NoteListLoadingRow key={row.id} {...row} />
      ))}
    </div>
  )
}

function MultiSelectBar({
  multiSelect,
  isArchivedView,
  handleBulkOrganize,
  handleBulkArchive,
  handleBulkDeletePermanently,
  handleBulkUnarchive,
}: Pick<
  NoteListLayoutProps,
  | 'multiSelect'
  | 'isArchivedView'
  | 'handleBulkOrganize'
  | 'handleBulkArchive'
  | 'handleBulkDeletePermanently'
  | 'handleBulkUnarchive'
>) {
  if (!multiSelect.isMultiSelecting) return null

  return (
    <BulkActionBar
      count={multiSelect.selectedPaths.size}
      isArchivedView={isArchivedView}
      onOrganize={handleBulkOrganize}
      onArchive={handleBulkArchive}
      onDelete={handleBulkDeletePermanently}
      onUnarchive={handleBulkUnarchive}
      onClear={multiSelect.clear}
    />
  )
}

function NoteListContent(
  options: Pick<
  NoteListLayoutProps,
  | 'entitySelection'
  | 'searchedGroups'
  | 'query'
  | 'collapsedGroups'
  | 'sortPrefs'
  | 'toggleGroup'
  | 'handleSortChange'
  | 'renderItem'
  | 'isArchivedView'
  | 'isChangesView'
  | 'isInboxView'
  | 'modifiedFilesError'
  | 'searched'
  | 'noteListVirtuosoRef'
  | 'locale'
  | 'loading'
  | 'showFilterPills'
  >,
) {
  const {
    entitySelection,
    searchedGroups,
    query,
    collapsedGroups,
    sortPrefs,
    toggleGroup,
    handleSortChange,
    renderItem,
    isArchivedView,
    isChangesView,
    isInboxView,
    modifiedFilesError,
    searched,
    noteListVirtuosoRef,
    locale,
    loading,
    showFilterPills,
  } = options
  return (
    <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {loading ? (
        <NoteListLoadingSkeleton />
      ) : entitySelection ? (
        <EntityView
          entity={entitySelection.entry}
          groups={searchedGroups}
          query={query}
          collapsedGroups={collapsedGroups}
          sortPrefs={sortPrefs}
          onToggleGroup={toggleGroup}
          onSortChange={handleSortChange}
          renderItem={renderItem}
          locale={locale}
        />
      ) : (
        <ListView
          isArchivedView={isArchivedView}
          isChangesView={isChangesView}
          isInboxView={isInboxView}
          changesError={modifiedFilesError}
          searched={searched}
          query={query}
          renderItem={renderItem}
          virtuosoRef={noteListVirtuosoRef}
          locale={locale}
          hasBottomOverlay={showFilterPills}
        />
      )}
    </div>
  )
}

export function NoteListBody(
  options: Pick<
  NoteListLayoutProps,
  | 'handleListKeyDown'
  | 'noteListContainerRef'
  | 'handleNoteListBlur'
  | 'handleNoteListFocus'
  | 'focusNoteList'
  | 'noteListVirtuosoRef'
  | 'entitySelection'
  | 'searchedGroups'
  | 'query'
  | 'collapsedGroups'
  | 'sortPrefs'
  | 'toggleGroup'
  | 'handleSortChange'
  | 'renderItem'
  | 'isArchivedView'
  | 'isChangesView'
  | 'isInboxView'
  | 'modifiedFilesError'
  | 'searched'
  | 'locale'
  | 'showFilterPills'
  | 'noteListFilter'
  | 'filterCounts'
  | 'onNoteListFilterChange'
  | 'loading'
  >,
) {
  const {
    handleListKeyDown,
    noteListContainerRef,
    handleNoteListBlur,
    handleNoteListFocus,
    focusNoteList,
    noteListVirtuosoRef,
    entitySelection,
    searchedGroups,
    query,
    collapsedGroups,
    sortPrefs,
    toggleGroup,
    handleSortChange,
    renderItem,
    isArchivedView,
    isChangesView,
    isInboxView,
    modifiedFilesError,
    searched,
    locale,
    showFilterPills,
    noteListFilter,
    filterCounts,
    onNoteListFilterChange,
    loading,
  } = options
  return (
    <div
      ref={noteListContainerRef}
      className="relative flex flex-1 flex-col overflow-hidden outline-none"
      style={{ minHeight: 0 }}
      role="listbox"
      aria-label="Notes"
      tabIndex={0}
      onBlur={handleNoteListBlur}
      onKeyDown={handleListKeyDown}
      onFocus={handleNoteListFocus}
      onClickCapture={focusNoteList}
      data-testid="note-list-container"
    >
      <NoteListContent
        entitySelection={entitySelection}
        searchedGroups={searchedGroups}
        query={query}
        collapsedGroups={collapsedGroups}
        sortPrefs={sortPrefs}
        toggleGroup={toggleGroup}
        handleSortChange={handleSortChange}
        renderItem={renderItem}
        isArchivedView={isArchivedView}
        isChangesView={isChangesView}
        isInboxView={isInboxView}
        modifiedFilesError={modifiedFilesError}
        searched={searched}
        noteListVirtuosoRef={noteListVirtuosoRef}
        locale={locale}
        loading={loading}
        showFilterPills={showFilterPills}
      />
      {showFilterPills && (
        <FilterPills
          active={noteListFilter}
          counts={filterCounts}
          onChange={onNoteListFilterChange}
          position="bottom"
          locale={locale}
        />
      )}
    </div>
  )
}

function NoteListLayoutHeader(
  options: Pick<
  NoteListLayoutProps,
  | 'title'
  | 'typeDocument'
  | 'isEntityView'
  | 'isChangesView'
  | 'listSort'
  | 'listDirection'
  | 'customProperties'
  | 'gitRepositories'
  | 'selectedGitRepositoryPath'
  | 'onGitRepositoryChange'
  | 'locale'
  | 'sidebarCollapsed'
  | 'searchVisible'
  | 'search'
  | 'isSearching'
  | 'searchInputRef'
  | 'propertyPicker'
  | 'handleSortChange'
  | 'handleCreateNote'
  | 'onOpenType'
  | 'toggleSearch'
  | 'setSearch'
  | 'handleSearchKeyDown'
  > & { layoutControls?: React.ReactNode },
) {
  const {
    layoutControls,
    title,
    typeDocument,
    isEntityView,
    isChangesView,
    listSort,
    listDirection,
    customProperties,
    gitRepositories,
    selectedGitRepositoryPath,
    onGitRepositoryChange,
    locale,
    sidebarCollapsed,
    searchVisible,
    search,
    isSearching,
    searchInputRef,
    propertyPicker,
    handleSortChange,
    handleCreateNote,
    onOpenType,
    toggleSearch,
    setSearch,
    handleSearchKeyDown,
  } = options
  return (
    <NoteListHeader
      title={title}
      typeDocument={typeDocument}
      isEntityView={isEntityView}
      isChangesView={isChangesView}
      listSort={listSort}
      listDirection={listDirection}
      customProperties={customProperties}
      gitRepositories={gitRepositories}
      selectedGitRepositoryPath={selectedGitRepositoryPath}
      onGitRepositoryChange={onGitRepositoryChange}
      locale={locale}
      sidebarCollapsed={sidebarCollapsed}
      searchVisible={searchVisible}
      search={search}
      isSearching={isSearching}
      searchInputRef={searchInputRef}
      propertyPicker={propertyPicker}
      layoutControls={layoutControls}
      onSortChange={handleSortChange}
      onCreateNote={handleCreateNote}
      onOpenType={onOpenType}
      onToggleSearch={toggleSearch}
      onSearchChange={setSearch}
      onSearchKeyDown={handleSearchKeyDown}
    />
  )
}

function NoteListFooter(
  options: Pick<
  NoteListLayoutProps,
  | 'multiSelect'
  | 'isArchivedView'
  | 'handleBulkOrganize'
  | 'handleBulkArchive'
  | 'handleBulkDeletePermanently'
  | 'handleBulkUnarchive'
  | 'contextMenuNode'
  | 'dialogNode'
  >,
) {
  const {
    multiSelect,
    isArchivedView,
    handleBulkOrganize,
    handleBulkArchive,
    handleBulkDeletePermanently,
    handleBulkUnarchive,
    contextMenuNode,
    dialogNode,
  } = options
  return (
    <>
      <MultiSelectBar
        multiSelect={multiSelect}
        isArchivedView={isArchivedView}
        handleBulkOrganize={handleBulkOrganize}
        handleBulkArchive={handleBulkArchive}
        handleBulkDeletePermanently={handleBulkDeletePermanently}
        handleBulkUnarchive={handleBulkUnarchive}
      />
      {contextMenuNode}
      {dialogNode}
    </>
  )
}

function LayoutHeaderControls({ layout, locale }: { layout: CollectionLayoutState; locale: NoteListLayoutProps['locale'] }) {
  if (!layout.enabled) return null
  return (
    <CollectionLayoutHeaderControls
      layout={layout.layout}
      groupBy={layout.groupBy}
      groups={layout.groups}
      calendar={{ settings: layout.calendar, dateProperty: layout.dateProperty, dateOptions: layout.dateOptions, onChange: layout.changeCalendar }}
      locale={locale}
      triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
      onLayoutChange={layout.changeLayout}
      onGroupByChange={layout.changeGroupBy}
    />
  )
}

export function NoteListLayout({
  noteListPanelRef,
  handleNoteListPanelBlurCapture,
  handleNoteListPanelFocusCapture,
  ...contentProps
}: NoteListLayoutProps) {
  const layout = useCollectionLayout(contentProps)
  const { locale } = contentProps
  useKanbanPanelOutsideClose({ rootRef: noteListPanelRef, ...layout.panel })
  return (
    <div
      ref={noteListPanelRef}
      className="flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground"
      style={{ height: '100%' }}
      onBlurCapture={handleNoteListPanelBlurCapture}
      onFocusCapture={handleNoteListPanelFocusCapture}
      data-collection-layout={layout.layout}
      data-kanban-panel={layout.panel.open ? 'open' : 'closed'}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <NoteListLayoutHeader
          {...contentProps}
          propertyPicker={layoutPropertyPicker(layout, contentProps.propertyPicker, locale)}
          layoutControls={<LayoutHeaderControls layout={layout} locale={locale} />}
        />
        <CollectionLayoutBody
          layout={layout}
          listContent={<NoteListBody {...contentProps} />}
          entries={contentProps.visibleEntries}
          allEntries={contentProps.allEntries}
          locale={locale}
          typeEntryMap={contentProps.typeEntryMap}
          displayPropsOverride={contentProps.displayPropsOverride}
          selectedNotePath={contentProps.selectedNotePath}
          onOpen={contentProps.handleClickNote}
          onMove={(entry, property, value) => contentProps.onUpdateTypeSort?.(entry.path, property, value)}
          onCreate={contentProps.handleCreateNote}
        />
      </div>
      <NoteListFooter {...contentProps} />
      <KanbanEditorPanelClose open={layout.panel.open} locale={locale} onClose={layout.panel.close} />
    </div>
  )
}
