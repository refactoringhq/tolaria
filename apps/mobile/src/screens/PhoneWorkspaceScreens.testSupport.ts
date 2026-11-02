import type { PhoneWorkspaceController, PhoneWorkspaceStateViewProps } from './phoneWorkspaceScreenSupport'

export function createPhoneWorkspaceScreenProps(
  openCommandPalette: () => void,
): PhoneWorkspaceStateViewProps {
  const noop = () => {}
  return {
    controller: { ...controllerState(), ...controllerActions(noop) } as unknown as PhoneWorkspaceController,
    options: {} as PhoneWorkspaceStateViewProps['options'],
    openEditor: noop,
    openSourceEditor: noop,
    openCommandPalette,
    openList: noop,
    openProperties: noop,
    openSidebar: noop,
    phoneLayoutProbe: (() => ({})) as PhoneWorkspaceStateViewProps['phoneLayoutProbe'],
    phoneState: 'list',
    sourceModeRequest: 0,
    suggestionNotes: [],
    tableOfContentsTarget: null,
  }
}

function controllerState() {
  return {
    activeFolderId: null,
    activeItemId: null,
    activeFolderName: null,
    editorBlocks: [],
    editorBullets: [],
    noteListProperties: [],
    noteListNeighborhood: null,
    noteListFilter: 'open',
    noteListFilterCounts: { open: 0, archived: 0 },
    noteListFilterVisible: true,
    noteListSubtitle: '',
    noteListTitle: 'Inbox',
    notes: [],
    readOnlyForm: { filenameStem: '' },
    selectedNote: null,
    selectedNoteId: null,
    selectedNoteRead: null,
    snapshot: { sidebarSections: [], source: { label: 'Test vault' }, typeDefinitions: {}, vaultConfig: {} },
    vaultRootUri: '',
  }
}

function controllerActions(noop: () => void) {
  return {
    onAddProperty: noop,
    onAddRelationship: noop,
    onBulkArchiveNotes: noop,
    onBulkDeleteNotes: noop,
    onBulkOrganizeNotes: noop,
    onDeleteProperty: noop,
    onEditProperty: noop,
    onEnterNeighborhood: noop,
    onFilenameStemChange: noop,
    onFixInvalidFrontmatter: noop,
    onInitializeProperties: noop,
    onOpenChangeNoteType: noop,
    onOpenCreateFolder: noop,
    onOpenCreateNote: noop,
    onOpenCreateType: noop,
    onOpenCreateTypeWithName: noop,
    onOpenCreateView: noop,
    onOpenFavoriteActions: noop,
    onOpenFolderActions: noop,
    onOpenMoreActions: noop,
    onOpenPrimaryActions: noop,
    onOpenSearch: noop,
    onOpenTypeActions: noop,
    onOpenTypeVisibility: noop,
    onOpenViewActions: noop,
    onRemoveRelationship: noop,
    onRenameNoteFile: noop,
    onSelectFolder: noop,
    onSelectNote: noop,
    onSelectSidebarItem: noop,
    onToggleFavorite: noop,
    onToggleNoteFavorite: noop,
    onUpdateNoteContent: noop,
    onNoteListFilterChange: noop,
  }
}
