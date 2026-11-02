import type { ComponentProps } from 'react'

import { View } from 'react-native'

import Reanimated from 'react-native-reanimated'

import { useMobileStyles } from '../ui/theme/useMobileTheme'

import { MobilePanelSafeArea } from '../ui/MobilePanelSafeArea'

import { MobileNoteListPanel } from '../components/workspace/MobileNoteListPanel'

import { MobilePropertiesPanel } from '../components/workspace/MobilePropertiesPanel'

import { MobileWorkspaceSidebar } from '../components/workspace/MobileWorkspaceSidebar'

import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'

import { mobileWorkspaceHasNoVault } from '../workspace/mobileWorkspaceEmptyState'

import type { RegisterMobileEditorCommands } from '../workspace/mobileEditorCommands'

import type { MobileTableOfContentsTarget } from '../workspace/mobileTableOfContents'

import { TabletEditorPanel } from './TabletEditorPanel'

import type { TabletWorkspaceChromeProps } from './tabletWorkspaceTypes'

import { useMobileInspectorReferenceGroups } from './useMobileInspectorReferenceGroups'

import type { useTabletPanelGestures } from './useTabletPanelGestures'

import { createTabletWorkspaceStyles as createThemeStyles } from './TabletWorkspaceStyles'

export type TabletTableOfContentsTargetRequest = MobileTableOfContentsTarget & { requestId: number }

export type TabletPanelGestures = ReturnType<typeof useTabletPanelGestures>

type TabletPanelHostProps = TabletWorkspaceChromeProps & { gestures: TabletPanelGestures }

type TabletSidebarHostProps = TabletPanelHostProps & { onOpenCommandPalette: () => void }

type TabletPropertiesPanelHostProps = TabletPanelHostProps & { onFixInvalidFrontmatter?: () => void }

type TabletEditorPanelHostProps = Pick<
  TabletWorkspaceChromeProps,
  | 'compactTablet'
  | 'editorBlocks'
  | 'editorBullets'
  | 'initialEditorEditing'
  | 'initialEditorEditingMode'
  | 'layoutProbe'
  | 'onOpenMoreActions'
  | 'onFilenameStemChange'
  | 'onRenameNoteFile'
  | 'readOnlyForm'
  | 'onOpenTableOfContents'
  | 'onTableOfContentsScrollProof'
  | 'onToggleFavorite'
  | 'onUpdateNoteContent'
  | 'selectedNote'
  | 'selectedNoteRead'
  | 'sourceIdleSave'
  | 'sourceSelectionProbe'
  | 'vaultRootUri'
  | 'wysiwygAutocompleteProbe'
  | 'wysiwygExternalLinkProbe'
  | 'wysiwygFormatCommandProbe'
  | 'wysiwygInputTransformProbe'
  | 'wysiwygMarkdownBlockProbe'
  | 'wysiwygMathEditProbe'
  | 'wysiwygTableCommandMutationProbe'
  | 'wysiwygWikilinkInsertProbe'
  | 'wysiwygMutationProbe'
> & {
  gestures: TabletPanelGestures
  onNavigateWikilink: (target: string) => void
  onRegisterEditorCommands?: RegisterMobileEditorCommands
  suggestionNotes: MobileNote[]
  tableOfContentsTarget: TabletTableOfContentsTargetRequest | null
  typeDefinitions: MobileWorkspaceSnapshot['typeDefinitions']
}

export function TabletLeftChromeHost(props: TabletSidebarHostProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const strip = (
    <Reanimated.View
      style={[styles.leftChromeHost, props.gestures.leftChromeMotionStyle]}
      testID="tablet-left-panel-strip"
    >
      <TabletSidebarHost {...props} />
      <TabletNoteListHost {...props} />
    </Reanimated.View>
  )
  if (props.compactTablet) return strip
  return (
    <Reanimated.View style={[styles.leftChromeViewport, props.gestures.leftChromeViewportStyle]}>
      {strip}
    </Reanimated.View>
  )
}

function TabletSidebarHost(props: TabletSidebarHostProps) {
  const {
    activeFolderId,
    activeItemId,
    gestures,
    layoutProbe,
    snapshot,
    onOpenCreateFolder,
    onOpenCreateType,
    onOpenCreateView,
    onOpenFolderActions,
    onOpenFavoriteActions,
    onOpenCommandPalette,
    onOpenPrimaryActions,
    onOpenTypeActions,
    onOpenTypeVisibility,
    onOpenViewActions,
    onSelectFolder,
    onSelectSidebarItem,
  } = props
  const { styles } = useMobileStyles(createThemeStyles)
  if (!gestures.renderSidebar) return null

  return (
    <View
      accessibilityElementsHidden={!gestures.showSidebar}
      importantForAccessibility={gestures.showSidebar ? 'auto' : 'no-hide-descendants'}
      pointerEvents={gestures.showSidebar ? 'auto' : 'none'}
      style={styles.panelHost}
    >
      <MobilePanelSafeArea sidebar>
        <MobileWorkspaceSidebar
          activeFolderId={activeFolderId}
          activeItemId={activeItemId}
          layoutProbe={layoutProbe}
          sections={snapshot.sidebarSections}
          title={snapshot.source?.label}
          onCreateFolder={onOpenCreateFolder}
          onCreateType={onOpenCreateType}
          onCreateView={onOpenCreateView}
          onOpenFolderActions={onOpenFolderActions}
          onOpenFavoriteActions={onOpenFavoriteActions}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenPrimaryActions={onOpenPrimaryActions}
          onOpenTypeActions={onOpenTypeActions}
          onOpenTypeVisibility={onOpenTypeVisibility}
          onOpenViewActions={onOpenViewActions}
          onSelectFolder={(selection) => {
            onSelectFolder(selection)
            gestures.finishSidebarNavigation()
          }}
          onSelectItem={(selection) => {
            onSelectSidebarItem(selection)
            gestures.finishSidebarNavigation()
          }}
        />
      </MobilePanelSafeArea>
    </View>
  )
}

function TabletNoteListHost(props: TabletPanelHostProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const { gestures } = props
  if (!gestures.renderNoteList) return null

  return (
    <View
      accessibilityElementsHidden={!gestures.noteListVisible}
      importantForAccessibility={gestures.noteListVisible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={gestures.noteListVisible ? 'auto' : 'none'}
      style={styles.panelHost}
    >
      <MobilePanelSafeArea>
        <MobileNoteListPanel {...tabletNoteListPanelProps(props)} />
      </MobilePanelSafeArea>
    </View>
  )
}

function tabletNoteListPanelProps(props: TabletPanelHostProps): ComponentProps<typeof MobileNoteListPanel> {
  return {
    bulkActions: tabletNoteListBulkActions(props),
    compact: props.compactTablet,
    displayPropertyKeys: props.noteListProperties,
    emptyVault: mobileWorkspaceHasNoVault(props.snapshot),
    layoutProbe: props.layoutProbe,
    neighborhood: props.noteListNeighborhood,
    noteListFilter: props.noteListFilter,
    noteListFilterCounts: props.noteListFilterCounts,
    noteListFilterVisible: props.noteListFilterVisible,
    notes: props.notes,
    propertyDisplayModes: props.snapshot.vaultConfig?.propertyDisplayModes,
    searchQuery: props.searchQuery || undefined,
    selectedNoteId: props.selectedNoteId,
    subtitle: props.noteListSubtitle,
    title: props.noteListTitle,
    typeDefinitions: props.snapshot.typeDefinitions,
    onNoteListFilterChange: props.onNoteListFilterChange,
    onOpenCreateNote: props.onOpenCreateNote,
    onOpenSearch: props.onOpenSearch,
    onOpenVault: props.onOpenNativeVault,
    onToggleNoteFavorite: props.onToggleNoteFavorite,
    onSelectNote: (noteId) => {
      props.onSelectNote(noteId)
      props.gestures.finishSidebarNavigation()
    },
  }
}

function tabletNoteListBulkActions(props: TabletPanelHostProps) {
  return {
    onArchive: props.onBulkArchiveNotes,
    onDelete: props.onBulkDeleteNotes,
    onOrganize: props.onBulkOrganizeNotes,
  }
}

export function TabletEditorPanelHost(props: TabletEditorPanelHostProps) {
  return (
    <MobilePanelSafeArea divider="none">
      <TabletEditorPanel {...tabletEditorPanelProps(props)} />
    </MobilePanelSafeArea>
  )
}

function tabletEditorPanelProps(props: TabletEditorPanelHostProps): ComponentProps<typeof TabletEditorPanel> {
  return {
    blocks: props.editorBlocks,
    bullets: props.editorBullets,
    compact: props.compactTablet,
    initialEditing: props.initialEditorEditing,
    initialEditingMode: props.initialEditorEditingMode,
    layoutProbe: props.layoutProbe,
    note: props.selectedNote,
    noteRead: props.selectedNoteRead,
    notes: props.suggestionNotes,
    onNavigateWikilink: props.onNavigateWikilink,
    onOpenMoreActions: props.onOpenMoreActions,
    onOpenTableOfContents: props.onOpenTableOfContents,
    onRegisterEditorCommands: props.onRegisterEditorCommands,
    onTableOfContentsScrollProof: props.onTableOfContentsScrollProof,
    onToggleFavorite: props.onToggleFavorite,
    onUpdateContent: props.onUpdateNoteContent,
    renameFilename: {
      value: props.readOnlyForm.filenameStem,
      notes: props.suggestionNotes,
      onChange: props.onFilenameStemChange,
      onSubmit: props.onRenameNoteFile,
    },
    sourceIdleSave: props.sourceIdleSave,
    sourceSelectionProbe: props.sourceSelectionProbe,
    tableOfContentsTarget: props.tableOfContentsTarget,
    typeDefinitions: props.typeDefinitions,
    vaultRootUri: props.vaultRootUri,
    wysiwygAutocompleteProbe: props.wysiwygAutocompleteProbe,
    wysiwygExternalLinkProbe: props.wysiwygExternalLinkProbe,
    wysiwygFormatCommandProbe: props.wysiwygFormatCommandProbe,
    wysiwygInputTransformProbe: props.wysiwygInputTransformProbe,
    wysiwygMarkdownBlockProbe: props.wysiwygMarkdownBlockProbe,
    wysiwygMathEditProbe: props.wysiwygMathEditProbe,
    wysiwygMutationProbe: props.wysiwygMutationProbe,
    wysiwygTableCommandMutationProbe: props.wysiwygTableCommandMutationProbe,
    wysiwygWikilinkInsertProbe: props.wysiwygWikilinkInsertProbe,
  }
}

export function TabletPropertiesPanelHost(props: TabletPropertiesPanelHostProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const { gestures } = props
  const referenceGroups = useMobileInspectorReferenceGroups(props.selectedNote, props.snapshot)

  return (
    <Reanimated.View
      accessibilityElementsHidden={!gestures.propertiesVisible}
      importantForAccessibility={gestures.propertiesVisible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={gestures.propertiesVisible ? 'auto' : 'none'}
      style={[styles.panelHost, styles.propertiesPanelHost, gestures.propertiesMotionStyle]}
      testID="tablet-properties-panel-host"
    >
      <MobilePanelSafeArea divider="left">
        <MobilePropertiesPanel {...propertiesPanelProps(props, referenceGroups)} />
      </MobilePanelSafeArea>
    </Reanimated.View>
  )
}

function propertiesPanelProps(
  props: TabletPropertiesPanelHostProps,
  referenceGroups: ReturnType<typeof useMobileInspectorReferenceGroups>,
) {
  return {
    compact: props.compactTablet,
    layoutProbe: props.layoutProbe,
    note: props.selectedNote,
    onAddProperty: props.onAddProperty,
    onAddRelationship: props.onAddRelationship,
    onCreateMissingType: props.onOpenCreateTypeWithName,
    onDeleteProperty: props.onDeleteProperty,
    onEditProperty: props.onEditProperty,
    onEnterNeighborhood: props.onEnterNeighborhood,
    onFixInvalidFrontmatter: props.onFixInvalidFrontmatter,
    onInitializeProperties: props.onInitializeProperties,
    onOpenChangeNoteType: props.onOpenChangeNoteType,
    onRemoveRelationship: props.onRemoveRelationship,
    onSelectNote: props.onSelectNote,
    propertyDisplayModes: props.snapshot.vaultConfig?.propertyDisplayModes,
    referenceGroups,
    typeDefinitions: props.snapshot.typeDefinitions,
  }
}
