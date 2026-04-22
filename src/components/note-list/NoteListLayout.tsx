import { BulkActionBar } from '../BulkActionBar'
import { FilterPills } from './FilterPills'
import { NoteListHeader } from './NoteListHeader'
import { EntityView, ListView } from './NoteListViews'
import type { useNoteListModel } from './useNoteListModel'

type NoteListLayoutProps = ReturnType<typeof useNoteListModel> & {
  handleBulkOrganize?: () => void
}

function MultiSelectBar({
  multiSelect,
  isArchivedView,
  handleBulkOrganize,
  handleBulkArchive,
  handleBulkDeletePermanently,
  handleBulkUnarchive,
}: Pick<NoteListLayoutProps, 'multiSelect' | 'isArchivedView' | 'handleBulkOrganize' | 'handleBulkArchive' | 'handleBulkDeletePermanently' | 'handleBulkUnarchive'>) {
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

function NoteListContent({
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
}: Pick<
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
>) {
  return (
    <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {entitySelection ? (
        <EntityView
          entity={entitySelection.entry}
          groups={searchedGroups}
          query={query}
          collapsedGroups={collapsedGroups}
          sortPrefs={sortPrefs}
          onToggleGroup={toggleGroup}
          onSortChange={handleSortChange}
          renderItem={renderItem}
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
        />
      )}
    </div>
  )
}

function NoteListBody({
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
  showFilterPills,
  noteListFilter,
  filterCounts,
  onNoteListFilterChange,
}: Pick<
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
  | 'showFilterPills'
  | 'noteListFilter'
  | 'filterCounts'
  | 'onNoteListFilterChange'
>) {
  return (
    <div
      ref={noteListContainerRef}
      className="relative flex flex-1 flex-col overflow-hidden outline-none"
      style={{ minHeight: 0 }}
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
      />
      {showFilterPills && (
        <FilterPills
          active={noteListFilter}
          counts={filterCounts}
          onChange={onNoteListFilterChange}
          position="bottom"
        />
      )}
    </div>
  )
}

export function NoteListLayout({
  title,
  typeDocument,
  isEntityView,
  listSort,
  listDirection,
  customProperties,
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
  noteListPanelRef,
  handleNoteListPanelBlurCapture,
  handleNoteListPanelFocusCapture,
  handleListKeyDown,
  noteListContainerRef,
  handleNoteListBlur,
  handleNoteListFocus,
  focusNoteList,
  noteListVirtuosoRef,
  entitySelection,
  searchedGroups,
  collapsedGroups,
  sortPrefs,
  toggleGroup,
  renderItem,
  isArchivedView,
  isChangesView,
  isInboxView,
  modifiedFilesError,
  searched,
  query,
  showFilterPills,
  noteListFilter,
  filterCounts,
  onNoteListFilterChange,
  multiSelect,
  handleBulkOrganize,
  handleBulkArchive,
  handleBulkDeletePermanently,
  handleBulkUnarchive,
  contextMenuNode,
  dialogNode,
}: NoteListLayoutProps) {
  return (
    <div
      ref={noteListPanelRef}
      className="chrome-panel chrome-panel--stack flex flex-col select-none overflow-hidden border-r border-border bg-card text-foreground"
      style={{ height: '100%' }}
      onBlurCapture={handleNoteListPanelBlurCapture}
      onFocusCapture={handleNoteListPanelFocusCapture}
    >
      <NoteListHeader
        title={title}
        typeDocument={typeDocument}
        isEntityView={isEntityView}
        listSort={listSort}
        listDirection={listDirection}
        customProperties={customProperties}
        sidebarCollapsed={sidebarCollapsed}
        searchVisible={searchVisible}
        search={search}
        isSearching={isSearching}
        searchInputRef={searchInputRef}
        propertyPicker={propertyPicker}
        onSortChange={handleSortChange}
        onCreateNote={handleCreateNote}
        onOpenType={onOpenType}
        onToggleSearch={toggleSearch}
        onSearchChange={setSearch}
        onSearchKeyDown={handleSearchKeyDown}
      />
      <NoteListBody
        handleListKeyDown={handleListKeyDown}
        noteListContainerRef={noteListContainerRef}
        handleNoteListBlur={handleNoteListBlur}
        handleNoteListFocus={handleNoteListFocus}
        focusNoteList={focusNoteList}
        noteListVirtuosoRef={noteListVirtuosoRef}
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
        showFilterPills={showFilterPills}
        noteListFilter={noteListFilter}
        filterCounts={filterCounts}
        onNoteListFilterChange={onNoteListFilterChange}
      />
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
    </div>
  )
}
