import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { Dimensions, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import Reanimated from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { CaretLeft, CaretRight, SidebarSimple } from 'phosphor-react-native'
import { MobileCommandPalette } from '../components/workspace/MobileCommandPalette'
import { MobileNoteListPanel } from '../components/workspace/MobileNoteListPanel'
import { MobilePropertiesPanel } from '../components/workspace/MobilePropertiesPanel'
import { MobileSyncStatusBar } from '../components/workspace/MobileSyncStatusBar'
import { MobileWorkspaceActionSheet } from '../components/workspace/MobileWorkspaceActionSheet'
import { MobileWorkspaceSidebar } from '../components/workspace/MobileWorkspaceSidebar'
import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import { mobileWorkspaceHasNoVault } from '../workspace/mobileWorkspaceEmptyState'
import {
  fixtureReadOnlyWorkspaceRepository,
  type ReadOnlyWorkspaceRepository,
  type ReadOnlyWorkspaceRequest,
} from '../workspace/readOnlyWorkspaceRepository'
import { mobileColors } from '../ui/tokens'
import { desktopPanelParity } from '../ui/desktopParity'
import { MobileIconButton } from '../ui/MobileIconButton'
import { mobileText } from '../i18n/mobileText'
import { useMobileEditorCommandRegistry, type RegisterMobileEditorCommands } from '../workspace/mobileEditorCommands'
import { mobileNoteIdForWikilinkTarget } from '../workspace/mobileWikilinks'
import { buildMobileCommandPaletteCommands } from '../workspace/mobileCommandPalette'
import { useMobileWorkspaceKeyboardShortcuts } from '../workspace/mobileWorkspaceKeyboardShortcuts'
import { logNativeMobileCommandPaletteProof } from '../qa/nativeMobileCommandPaletteProbe'
import {
  logNativeMobileKeyboardShortcutActionProof,
  logNativeMobileKeyboardShortcutBridgeProof,
} from '../qa/nativeMobileKeyboardShortcutProof'
import {
  mobileTableOfContentsHeadingTargetId,
  type MobileTableOfContentsTarget,
} from '../workspace/mobileTableOfContents'
import { TabletEditorPanel } from './TabletEditorPanel'
import { tabletScreenModeForWindow } from './tabletWorkspaceScreenMode'
import type {
  MobileActionSheetQaTarget,
  TabletTransitionProbeMode,
  TabletWorkspaceChromeProps,
} from './tabletWorkspaceTypes'
import { useTabletWorkspaceController } from './useTabletWorkspaceController'
import { useMobileInspectorReferenceGroups } from './useMobileInspectorReferenceGroups'
import { useInitialActionSheetQaTarget } from './useInitialActionSheetQaTarget'
import { useTabletPanelGestures } from './useTabletPanelGestures'

export function TabletWorkspace({
  forceDesktopPanels = false,
  initialCommandPaletteOpen = false,
  initialEditorEditing = true,
  initialEditorEditingMode = 'wysiwyg',
  initialActionSheet,
  commandPaletteProbe = false,
  keyboardShortcutProbe = false,
  layoutProbe = false,
  onOpenNativeVault,
  onTableOfContentsScrollProof,
  repository = fixtureReadOnlyWorkspaceRepository,
  repositoryRequest,
  sourceIdleSave = true,
  sourceSelectionProbe = false,
  snapshot,
  tableOfContentsProbe = false,
  tabletTransitionProbe = false,
  wysiwygAutocompleteProbe = false,
  wysiwygExternalLinkProbe = false,
  wysiwygFormatCommandProbe = false,
  wysiwygInputTransformProbe = false,
  wysiwygMarkdownBlockProbe = false,
  wysiwygMathEditProbe = false,
  wysiwygTableCommandMutationProbe = false,
  wysiwygWikilinkInsertProbe = false,
  wysiwygMutationProbe = false,
}: {
  forceDesktopPanels?: boolean
  initialCommandPaletteOpen?: boolean
  initialEditorEditing?: boolean
  initialEditorEditingMode?: TabletWorkspaceChromeProps['initialEditorEditingMode']
  initialActionSheet?: MobileActionSheetQaTarget
  commandPaletteProbe?: boolean
  keyboardShortcutProbe?: boolean
  layoutProbe?: boolean
  onOpenNativeVault?: () => void
  onTableOfContentsScrollProof?: TabletWorkspaceChromeProps['onTableOfContentsScrollProof']
  repository?: ReadOnlyWorkspaceRepository
  repositoryRequest?: ReadOnlyWorkspaceRequest
  sourceIdleSave?: boolean
  sourceSelectionProbe?: boolean
  snapshot: MobileWorkspaceSnapshot
  tableOfContentsProbe?: boolean
  tabletTransitionProbe?: TabletTransitionProbeMode
  wysiwygAutocompleteProbe?: boolean
  wysiwygExternalLinkProbe?: boolean
  wysiwygFormatCommandProbe?: boolean
  wysiwygInputTransformProbe?: boolean
  wysiwygMarkdownBlockProbe?: boolean
  wysiwygMathEditProbe?: boolean
  wysiwygTableCommandMutationProbe?: boolean
  wysiwygWikilinkInsertProbe?: boolean
  wysiwygMutationProbe?: boolean
}) {
  const controller = useTabletWorkspaceController({ repository, repositoryRequest, snapshot })
  const onCreateNote = controller.snapshot.sync.kind === 'noVault' || controller.snapshot.sync.kind === 'readOnly'
    ? onOpenNativeVault ?? controller.onOpenCreateNote
    : controller.onOpenCreateNote
  const screenMode = useTabletScreenMode(forceDesktopPanels)
  useInitialActionSheetQaTarget(controller.onOpenActionSheetQaTarget, initialActionSheet)

  return (
    <View style={styles.shellRoot}>
      <TabletWorkspaceChrome
        compactTablet={screenMode.compactTablet}
        commandPaletteProbe={commandPaletteProbe}
        keyboardShortcutProbe={keyboardShortcutProbe}
        defaultPropertiesVisible={screenMode.defaultPropertiesVisible}
        defaultSidebarVisible={screenMode.defaultSidebarVisible}
        exclusiveSidePanels={screenMode.exclusiveSidePanels}
        propertiesReplaceSidebar={screenMode.propertiesReplaceSidebar}
        initialCommandPaletteOpen={initialCommandPaletteOpen}
        initialEditorEditing={initialEditorEditing}
        initialEditorEditingMode={initialEditorEditingMode}
        layoutProbe={layoutProbe}
        onOpenNativeVault={onOpenNativeVault}
        onTableOfContentsScrollProof={onTableOfContentsScrollProof}
        sourceIdleSave={sourceIdleSave}
        sourceSelectionProbe={sourceSelectionProbe}
        tableOfContentsProbe={tableOfContentsProbe}
        tabletTransitionProbe={tabletTransitionProbe}
        wysiwygAutocompleteProbe={wysiwygAutocompleteProbe}
        wysiwygExternalLinkProbe={wysiwygExternalLinkProbe}
        wysiwygFormatCommandProbe={wysiwygFormatCommandProbe}
        wysiwygInputTransformProbe={wysiwygInputTransformProbe}
        wysiwygMarkdownBlockProbe={wysiwygMarkdownBlockProbe}
        wysiwygMathEditProbe={wysiwygMathEditProbe}
        wysiwygTableCommandMutationProbe={wysiwygTableCommandMutationProbe}
        wysiwygWikilinkInsertProbe={wysiwygWikilinkInsertProbe}
        wysiwygMutationProbe={wysiwygMutationProbe}
        {...controller}
        onOpenCreateNote={onCreateNote}
      />
      <MobileSyncStatusBar sync={controller.snapshot.sync} onOpenLocalVault={onOpenNativeVault} />
    </View>
  )
}

function useTabletScreenMode(forceDesktopPanels: boolean) {
  const { height, width } = useWindowDimensions()
  const screen = Dimensions.get('screen')
  const nativeIpad = Platform.OS === 'ios' && Platform.isPad

  return tabletScreenModeForWindow({
    forceDesktopPanels,
    height,
    nativeIpad,
    screenHeight: screen.height,
    screenWidth: screen.width,
    width,
  })
}

function TabletWorkspaceChrome(props: TabletWorkspaceChromeProps) {
  const {
    commandPaletteProbe,
    compactTablet,
    defaultPropertiesVisible,
    defaultSidebarVisible = true,
    exclusiveSidePanels = false,
    propertiesReplaceSidebar = false,
    initialCommandPaletteOpen = false,
    onOpenNativeVault,
    onSelectNote,
    snapshot,
    tabletTransitionProbe = false,
  } = props
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(initialCommandPaletteOpen)
  const [tableOfContentsTarget, setTableOfContentsTarget] = useState<TabletTableOfContentsTargetRequest | null>(null)
  const editorCommandRegistry = useMobileEditorCommandRegistry()
  const gestures = useTabletPanelGestures({
    compactTablet,
    defaultPropertiesVisible,
    defaultSidebarVisible,
    exclusiveSidePanels,
    propertiesReplaceSidebar,
  })
  const suggestionNotes = snapshot.allNotes ?? snapshot.notes
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])
  const selectNextNote = useCallback(() => selectAdjacentVisibleNote(props.notes, props.selectedNoteId, props.onSelectNote, 1), [props.notes, props.onSelectNote, props.selectedNoteId])
  const selectPreviousNote = useCallback(() => selectAdjacentVisibleNote(props.notes, props.selectedNoteId, props.onSelectNote, -1), [props.notes, props.onSelectNote, props.selectedNoteId])
  useMobileWorkspaceKeyboardShortcuts({
    onCreateNote: props.onOpenCreateNote,
    onOpenFindInNote: props.onOpenFindInNote,
    onOpenCommandPalette: openCommandPalette,
    onOpenSearch: props.onOpenSearch,
    onSelectNextNote: selectNextNote,
    onSelectPreviousNote: selectPreviousNote,
    onShortcutAction: props.keyboardShortcutProbe ? logNativeMobileKeyboardShortcutActionProof : undefined,
    onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
  })
  const commandPaletteCommands = useMemo(() => buildMobileCommandPaletteCommands({
    ...props,
    onOpenCommandPalette: openCommandPalette,
    onOpenBacklinks: gestures.showProperties,
    onOpenNativeVault,
    onPastePlainText: editorCommandRegistry.commands.pastePlainText,
    onSaveActiveEditor: editorCommandRegistry.commands.save,
    onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
    onToggleProperties: gestures.toggleProperties,
    onViewAll: gestures.showAllPanels,
    onViewEditorList: gestures.showEditorList,
    onViewEditorOnly: gestures.showEditorOnly,
  }), [editorCommandRegistry.commands.pastePlainText, editorCommandRegistry.commands.save, editorCommandRegistry.commands.toggleRawEditor, gestures, onOpenNativeVault, openCommandPalette, props])
  useTabletTransitionProbe(tabletTransitionProbe, gestures)
  const handleNavigateWikilink = useCallback((target: string) => {
    const noteId = mobileNoteIdForWikilinkTarget(suggestionNotes, target)
    if (noteId) onSelectNote(noteId)
  }, [onSelectNote, suggestionNotes])
  const handleSelectTableOfContentsTarget = useCallback((target: MobileTableOfContentsTarget) => {
    setTableOfContentsTarget((current) => ({
      ...target,
      requestId: (current?.requestId ?? 0) + 1,
    }))
  }, [])
  useEffect(() => {
    if (!props.tableOfContentsProbe || tableOfContentsTarget) return

    const timeout = setTimeout(() => {
      handleSelectTableOfContentsTarget({
        id: mobileTableOfContentsHeadingTargetId(0),
        level: 2,
        title: 'Target Section',
      })
    }, 600)

    return () => clearTimeout(timeout)
  }, [handleSelectTableOfContentsTarget, props.tableOfContentsProbe, tableOfContentsTarget])

  useTabletChromeQaProofs(commandPaletteProbe, props.keyboardShortcutProbe, commandPaletteCommands)

  return (
    <GestureDetector gesture={gestures.panGesture}>
    <View
      collapsable={false}
      style={styles.shell}
      testID="tablet-workspace-gesture-surface"
    >
      <TabletLeftChromeHost
        {...props}
        gestures={gestures}
        onOpenCommandPalette={openCommandPalette}
      />
      <TabletEditorPanelHost
        {...props}
        gestures={gestures}
        suggestionNotes={suggestionNotes}
        tableOfContentsTarget={tableOfContentsTarget}
        typeDefinitions={snapshot.typeDefinitions}
        onRegisterEditorCommands={editorCommandRegistry.register}
        onNavigateWikilink={handleNavigateWikilink}
      />
      <TabletPropertiesPanelHost
        {...props}
        gestures={gestures}
        onFixInvalidFrontmatter={editorCommandRegistry.commands.toggleRawEditor}
      />
      <WorkspaceActionSheetHost
        {...props}
        suggestionNotes={suggestionNotes}
        onSelectTableOfContentsTarget={handleSelectTableOfContentsTarget}
      />
      <TabletCommandPaletteHost
        commands={commandPaletteCommands}
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
      />
    </View>
    </GestureDetector>
  )
}

function useTabletChromeQaProofs(
  paletteProbe: boolean | undefined,
  keyboardProbe: boolean | undefined,
  commands: ComponentProps<typeof MobileCommandPalette>['commands'],
) {
  useEffect(() => {
    if (paletteProbe) logNativeMobileCommandPaletteProof(commands)
  }, [commands, paletteProbe])
  useEffect(() => {
    if (keyboardProbe) logNativeMobileKeyboardShortcutBridgeProof()
  }, [keyboardProbe])
}

function TabletCommandPaletteHost({
  commands,
  open,
  onClose,
}: ComponentProps<typeof MobileCommandPalette> & { open: boolean }) {
  if (!open) return null
  return <MobileCommandPalette commands={commands} onClose={onClose} />
}

function useTabletTransitionProbe(
  mode: TabletTransitionProbeMode,
  gestures: ReturnType<typeof useTabletPanelGestures>,
) {
  const actionsRef = useRef({
    hideLeftChrome: gestures.hideLeftChrome,
    hideProperties: gestures.hideProperties,
    showLeftChrome: gestures.showLeftChrome,
    showProperties: gestures.showProperties,
  })

  useEffect(() => {
    actionsRef.current = {
      hideLeftChrome: gestures.hideLeftChrome,
      hideProperties: gestures.hideProperties,
      showLeftChrome: gestures.showLeftChrome,
      showProperties: gestures.showProperties,
    }
  }, [gestures.hideLeftChrome, gestures.hideProperties, gestures.showLeftChrome, gestures.showProperties])

  useEffect(() => {
    if (!mode) return

    const timers = tabletTransitionProbeTimers(mode, () => actionsRef.current)

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [mode])
}

function tabletTransitionProbeTimers(
  mode: Exclude<TabletTransitionProbeMode, false>,
  currentActions: () => {
    hideLeftChrome: () => void
    hideProperties: () => void
    showLeftChrome: () => void
    showProperties: () => void
  },
) {
  if (mode === 'properties') {
    return [
      setTimeout(() => currentActions().hideProperties(), 1400),
      setTimeout(() => currentActions().showProperties(), 3600),
      setTimeout(() => currentActions().hideProperties(), 5800),
      setTimeout(() => currentActions().showProperties(), 8000),
    ]
  }

  return [
    setTimeout(() => currentActions().hideLeftChrome(), 1200),
    setTimeout(() => currentActions().showLeftChrome(), 2600),
    setTimeout(() => currentActions().hideProperties(), 4000),
    setTimeout(() => currentActions().showProperties(), 5400),
  ]
}

type TabletTableOfContentsTargetRequest = MobileTableOfContentsTarget & { requestId: number }
type TabletPanelGestures = ReturnType<typeof useTabletPanelGestures>
type TabletPanelHostProps = TabletWorkspaceChromeProps & { gestures: TabletPanelGestures }
type TabletSidebarHostProps = TabletPanelHostProps & { onOpenCommandPalette: () => void }
type TabletPropertiesPanelHostProps = TabletPanelHostProps & { onFixInvalidFrontmatter?: () => void }

function selectAdjacentVisibleNote(
  notes: MobileNote[],
  selectedNoteId: string | null,
  onSelectNote: (noteId: string) => void,
  direction: -1 | 1,
) {
  const noteId = adjacentVisibleNoteId(notes, selectedNoteId, direction)
  if (noteId) onSelectNote(noteId)
}

function adjacentVisibleNoteId(
  notes: MobileNote[],
  selectedNoteId: string | null,
  direction: -1 | 1,
) {
  if (notes.length === 0) return null
  const currentIndex = Math.max(0, notes.findIndex((note) => note.id === selectedNoteId))
  const nextIndex = Math.max(0, Math.min(notes.length - 1, currentIndex + direction))
  return notes[nextIndex]?.id ?? null
}

function TabletLeftChromeHost(props: TabletSidebarHostProps) {
  return (
    <Reanimated.View
      style={[styles.leftChromeHost, props.gestures.leftChromeMotionStyle]}
      testID="tablet-left-panel-strip"
    >
      <TabletSidebarHost {...props} />
      <TabletNoteListHost {...props} />
    </Reanimated.View>
  )
}

function TabletSidebarHost({
  activeFolderId,
  activeItemId,
  gestures,
  layoutProbe,
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
  snapshot,
}: TabletSidebarHostProps) {
  if (!gestures.renderSidebar) return null

  return (
    <View
      accessibilityElementsHidden={!gestures.showSidebar}
      importantForAccessibility={gestures.showSidebar ? 'auto' : 'no-hide-descendants'}
      pointerEvents={gestures.showSidebar ? 'auto' : 'none'}
      style={styles.panelHost}
    >
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
        onSelectFolder={onSelectFolder}
        onSelectItem={onSelectSidebarItem}
      />
    </View>
  )
}

function TabletNoteListHost(props: TabletPanelHostProps) {
  const { gestures } = props
  if (!gestures.renderNoteList) return null

  return (
    <View
      accessibilityElementsHidden={!gestures.noteListVisible}
      importantForAccessibility={gestures.noteListVisible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={gestures.noteListVisible ? 'auto' : 'none'}
      style={styles.panelHost}
    >
      <MobileNoteListPanel {...tabletNoteListPanelProps(props)} />
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
    leading: <TabletNoteListSidebarAction gestures={props.gestures} />,
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
    onSelectNote: props.onSelectNote,
  }
}

function tabletNoteListBulkActions(props: TabletPanelHostProps) {
  return {
    onArchive: props.onBulkArchiveNotes,
    onDelete: props.onBulkDeleteNotes,
    onOrganize: props.onBulkOrganizeNotes,
  }
}

function TabletNoteListSidebarAction({ gestures }: { gestures: TabletPanelGestures }) {
  return (
    <MobileIconButton
      accessibilityLabel={mobileText(gestures.showSidebar ? 'sidebar.action.collapse' : 'sidebar.action.expand')}
      testID="tablet-note-list-sidebar-action"
      onPress={gestures.toggleSidebar}
    >
      <SidebarSimple color={mobileColors.textMuted} size={16} />
    </MobileIconButton>
  )
}

type TabletEditorPanelHostProps = Pick<
  TabletWorkspaceChromeProps,
  | 'compactTablet'
  | 'editorBlocks'
  | 'editorBullets'
  | 'initialEditorEditing'
  | 'initialEditorEditingMode'
  | 'layoutProbe'
  | 'onOpenMoreActions'
  | 'onTableOfContentsScrollProof'
  | 'onToggleFavorite'
  | 'onUpdateNoteContent'
  | 'selectedNote'
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

function TabletEditorPanelHost(props: TabletEditorPanelHostProps) {
  return <TabletEditorPanel {...tabletEditorPanelProps(props)} />
}

function tabletEditorPanelProps(props: TabletEditorPanelHostProps): ComponentProps<typeof TabletEditorPanel> {
  return {
    blocks: props.editorBlocks,
    bullets: props.editorBullets,
    compact: props.compactTablet,
    initialEditing: props.initialEditorEditing,
    initialEditingMode: props.initialEditorEditingMode,
    layoutProbe: props.layoutProbe,
    leading: <TabletEditorChromeToggle gestures={props.gestures} />,
    note: props.selectedNote,
    notes: props.suggestionNotes,
    onNavigateWikilink: props.onNavigateWikilink,
    onOpenMoreActions: props.onOpenMoreActions,
    onRegisterEditorCommands: props.onRegisterEditorCommands,
    onTableOfContentsScrollProof: props.onTableOfContentsScrollProof,
    onToggleFavorite: props.onToggleFavorite,
    onToggleProperties: props.gestures.toggleProperties,
    onUpdateContent: props.onUpdateNoteContent,
    propertiesVisible: props.gestures.propertiesVisible,
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

function TabletEditorChromeToggle({ gestures }: { gestures: TabletPanelGestures }) {
  const chromeVisible = gestures.showSidebar || gestures.noteListVisible
  const Icon = chromeVisible ? CaretLeft : CaretRight

  return (
    <MobileIconButton
      accessibilityLabel={mobileText(chromeVisible ? 'sidebar.action.collapse' : 'sidebar.action.expand')}
      testID="tablet-editor-chrome-toggle"
      onPress={gestures.toggleSidebarAndNoteList}
    >
      <Icon color={mobileColors.textMuted} size={16} />
    </MobileIconButton>
  )
}

function TabletPropertiesPanelHost(props: TabletPropertiesPanelHostProps) {
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
      <MobilePropertiesPanel {...propertiesPanelProps(props, referenceGroups)} />
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

type ActionSheetHostProps = TabletWorkspaceChromeProps & {
  onSelectTableOfContentsTarget?: (target: MobileTableOfContentsTarget) => void
  suggestionNotes: MobileNote[]
}

export const WorkspaceActionSheetHost = (props: ActionSheetHostProps) =>
  props.openAction ? (
    <MobileWorkspaceActionSheet
      action={props.openAction}
      {...actionSheetValues(props)}
      {...actionSheetHandlers(props)}
    />
  ) : null

function actionSheetValues(props: ActionSheetHostProps) {
  const {
    canRedoWorkspaceEdit,
    canUndoWorkspaceEdit,
    canMoveFavoriteDown,
    canMoveFavoriteUp,
    canMoveViewDown,
    canMoveViewUp,
    readOnlyForm,
    searchQuery,
    selectedNote,
    suggestionNotes,
    primaryPropertyOptions,
    typePropertyOptions,
    typeSchemaPropertyNameOptions,
    typeSchemaRelationshipNameOptions,
    typeRelationshipTargetOptions,
    typeSortPropertyOptions,
    viewPropertyOptions,
    viewSortPropertyOptions,
  } = props

  return {
    canDeleteType: props.canDeleteType,
    canMoveFavoriteDown,
    canMoveFavoriteUp,
    canMoveViewDown,
    canMoveViewUp,
    canRedoWorkspaceEdit,
    canUndoWorkspaceEdit,
    canMoveTypeDown: props.canMoveTypeDown,
    canMoveTypeUp: props.canMoveTypeUp,
    editorBlocks: props.editorBlocks,
    editorBullets: props.editorBullets,
    folderPaths: props.snapshot.folderPaths,
    notes: suggestionNotes,
    searchQuery,
    selectedNote,
    ...actionSheetFormValues(readOnlyForm),
    typeDefinitions: props.snapshot.typeDefinitions,
    primaryPropertyOptions,
    typePropertyOptions,
    typeSchemaPropertyNameOptions,
    typeSchemaRelationshipNameOptions,
    typeRelationshipTargetOptions,
    typeSortPropertyOptions,
    viewPropertyOptions,
    viewSortPropertyOptions,
  }
}

function actionSheetFormValues(readOnlyForm: ActionSheetHostProps['readOnlyForm']) {
  return {
    allNotesShowImages: readOnlyForm.allNotesShowImages,
    allNotesShowPdfs: readOnlyForm.allNotesShowPdfs,
    allNotesShowUnsupported: readOnlyForm.allNotesShowUnsupported,
    createTitle: readOnlyForm.createTitle,
    filenameStem: readOnlyForm.filenameStem,
    folderName: readOnlyForm.folderName,
    folderPath: readOnlyForm.folderPath,
    noteIcon: readOnlyForm.noteIcon,
    noteType: readOnlyForm.noteType,
    primaryDisplayProperties: readOnlyForm.primaryDisplayProperties,
    primaryItemId: readOnlyForm.primaryItemId,
    primaryPropertyQuery: readOnlyForm.primaryPropertyQuery,
    propertyName: readOnlyForm.propertyName,
    propertyValue: readOnlyForm.propertyValue,
    propertyValueKind: readOnlyForm.propertyValueKind,
    relationshipName: readOnlyForm.relationshipName,
    relationshipNoteTitle: readOnlyForm.relationshipNoteTitle,
    typeDisplayProperties: readOnlyForm.typeDisplayProperties,
    typeName: readOnlyForm.typeName,
    typePropertyQuery: readOnlyForm.typePropertyQuery,
    typeSchemaProperties: readOnlyForm.typeSchemaProperties,
    typeSchemaPropertyName: readOnlyForm.typeSchemaPropertyName,
    typeSchemaPropertyValue: readOnlyForm.typeSchemaPropertyValue,
    typeSchemaRelationships: readOnlyForm.typeSchemaRelationships,
    typeSchemaRelationshipName: readOnlyForm.typeSchemaRelationshipName,
    typeSchemaRelationshipTarget: readOnlyForm.typeSchemaRelationshipTarget,
    typeSectionLabel: readOnlyForm.typeSectionLabel,
    typeRenameName: readOnlyForm.typeRenameName,
    typeSort: readOnlyForm.typeSort,
    typeTemplate: readOnlyForm.typeTemplate,
    typeIcon: readOnlyForm.typeIcon,
    typeTone: readOnlyForm.typeTone,
    typeVisible: readOnlyForm.typeVisible,
    viewDisplayProperties: readOnlyForm.viewDisplayProperties,
    viewFilters: readOnlyForm.viewFilters,
    viewIcon: readOnlyForm.viewIcon,
    viewName: readOnlyForm.viewName,
    viewPropertyQuery: readOnlyForm.viewPropertyQuery,
    viewSort: readOnlyForm.viewSort,
    viewTone: readOnlyForm.viewTone,
  }
}

function actionSheetHandlers(props: ActionSheetHostProps) {
  return {
    ...actionSheetLifecycleHandlers(props),
    ...actionSheetNoteHandlers(props),
    ...actionSheetFileHandlers(props),
    ...actionSheetPropertyHandlers(props),
    ...actionSheetWorkspaceHandlers(props),
    ...actionSheetTypeHandlers(props),
    ...actionSheetViewHandlers(props),
  }
}

function actionSheetLifecycleHandlers(props: ActionSheetHostProps) {
  return {
    onClose: props.onCloseAction,
    onRedoWorkspaceEdit: props.onRedoWorkspaceEdit,
    onUndoWorkspaceEdit: props.onUndoWorkspaceEdit,
  }
}

function actionSheetNoteHandlers(props: ActionSheetHostProps) {
  return {
    onChangeNoteType: props.onChangeNoteType,
    onChangeNoteTypeInputChange: props.onChangeNoteTypeInputChange,
    onCopyDeepLink: props.onCopyDeepLink,
    onCopyFilePath: props.onCopyFilePath,
    onCreateNote: props.onCreateNote,
    onCreateTitleChange: props.onCreateTitleChange,
    onDeleteNote: props.onDeleteNote,
    onEnterNeighborhood: props.onEnterNeighborhood,
    onExportNoteAsPdf: props.onExportNoteAsPdf,
    onMoveFavoriteDown: props.onMoveFavoriteDown,
    onMoveFavoriteUp: props.onMoveFavoriteUp,
    onNoteIconChange: props.onNoteIconChange,
    onOpenChangeNoteType: props.onOpenChangeNoteType,
    onOpenFindInNote: props.onOpenFindInNote,
    onOpenReplaceInNote: props.onOpenReplaceInNote,
    onOpenSetNoteIcon: props.onOpenSetNoteIcon,
    onOpenTableOfContents: props.onOpenTableOfContents,
    onSelectTableOfContentsTarget: props.onSelectTableOfContentsTarget,
    onRemoveNoteIcon: props.onRemoveNoteIcon,
    onSearchQueryChange: props.onSearchQueryChange,
    onSelectNote: props.onSelectNote,
    onSetArchived: props.onSetArchived,
    onSetNoteIcon: props.onSetNoteIcon,
    onSetOrganized: props.onSetOrganized,
    onToggleFavorite: props.onToggleFavorite,
    onToggleNoteWidth: props.onToggleNoteWidth,
    onUpdateNoteContent: props.onUpdateNoteContent,
  }
}

function actionSheetFileHandlers(props: ActionSheetHostProps) {
  return {
    onCopyFolderPath: props.onCopyFolderPath,
    onCreateFolder: props.onCreateFolder,
    onDeleteFolder: props.onDeleteFolder,
    onFilenameStemChange: props.onFilenameStemChange,
    onFolderNameChange: props.onFolderNameChange,
    onFolderPathChange: props.onFolderPathChange,
    onMoveNoteToFolder: props.onMoveNoteToFolder,
    onOpenCreateChildFolder: props.onOpenCreateChildFolder,
    onOpenCreateNoteInFolder: props.onOpenCreateNoteInFolder,
    onOpenFileInDefaultApp: props.onOpenFileInDefaultApp,
    onOpenMoveNoteToFolder: props.onOpenMoveNoteToFolder,
    onOpenRenameNoteFile: props.onOpenRenameNoteFile,
    onRevealFile: props.onRevealFile,
    onRenameFolder: props.onRenameFolder,
    onRevealFolder: props.onRevealFolder,
    onRenameNoteFile: props.onRenameNoteFile,
    onRenameNoteFileToTitle: props.onRenameNoteFileToTitle,
  }
}

function actionSheetPropertyHandlers(props: ActionSheetHostProps) {
  return {
    onCreateRelationshipTarget: props.onCreateRelationshipTarget,
    onDeleteProperty: props.onDeleteProperty,
    onPropertyNameChange: props.onPropertyNameChange,
    onPropertyValueChange: props.onPropertyValueChange,
    onPropertyValueKindChange: props.onPropertyValueKindChange,
    onRelationshipNameChange: props.onRelationshipNameChange,
    onRelationshipNoteSelect: props.onRelationshipNoteSelect,
    onRelationshipNoteTitleChange: props.onRelationshipNoteTitleChange,
    onSaveProperty: props.onSaveProperty,
    onSaveRelationship: props.onSaveRelationship,
  }
}

function actionSheetWorkspaceHandlers(props: ActionSheetHostProps) {
  return {
    onPrimaryAllNotesShowImagesChange: props.onPrimaryAllNotesShowImagesChange,
    onPrimaryAllNotesShowPdfsChange: props.onPrimaryAllNotesShowPdfsChange,
    onPrimaryAllNotesShowUnsupportedChange: props.onPrimaryAllNotesShowUnsupportedChange,
    onPrimaryDisplayPropertiesChange: props.onPrimaryDisplayPropertiesChange,
    onPrimaryPropertyQueryChange: props.onPrimaryPropertyQueryChange,
    onSavePrimaryNoteListProperties: props.onSavePrimaryNoteListProperties,
  }
}

function actionSheetTypeHandlers(props: ActionSheetHostProps) {
  return {
    onCreateType: props.onCreateType,
    onDeleteType: props.onDeleteType,
    onMoveTypeDown: props.onMoveTypeDown,
    onMoveTypeUp: props.onMoveTypeUp,
    onSaveTypeDefinition: props.onSaveTypeDefinition,
    onToggleTypeVisibility: props.onToggleTypeVisibility,
    onTypeDisplayPropertiesChange: props.onTypeDisplayPropertiesChange,
    onTypeNameChange: props.onTypeNameChange,
    onTypePropertyQueryChange: props.onTypePropertyQueryChange,
    onTypeSchemaPropertyAdd: props.onTypeSchemaPropertyAdd,
    onTypeSchemaPropertyNameChange: props.onTypeSchemaPropertyNameChange,
    onTypeSchemaPropertyRemove: props.onTypeSchemaPropertyRemove,
    onTypeSchemaPropertyValueChange: props.onTypeSchemaPropertyValueChange,
    onTypeSchemaRelationshipAdd: props.onTypeSchemaRelationshipAdd,
    onTypeSchemaRelationshipNameChange: props.onTypeSchemaRelationshipNameChange,
    onTypeSchemaRelationshipRemove: props.onTypeSchemaRelationshipRemove,
    onTypeSchemaRelationshipTargetSelect: props.onTypeSchemaRelationshipTargetSelect,
    onTypeSchemaRelationshipTargetChange: props.onTypeSchemaRelationshipTargetChange,
    onTypeRenameNameChange: props.onTypeRenameNameChange,
    onTypeSectionLabelChange: props.onTypeSectionLabelChange,
    onTypeSortChange: props.onTypeSortChange,
    onTypeTemplateChange: props.onTypeTemplateChange,
    onTypeIconChange: props.onTypeIconChange,
    onTypeToneChange: props.onTypeToneChange,
    onTypeVisibleChange: props.onTypeVisibleChange,
  }
}

function actionSheetViewHandlers(props: ActionSheetHostProps) {
  return {
    onCreateView: props.onCreateView,
    onDeleteView: props.onDeleteView,
    onMoveViewDown: props.onMoveViewDown,
    onMoveViewUp: props.onMoveViewUp,
    onSaveView: props.onSaveView,
    onViewIconChange: props.onViewIconChange,
    onViewDisplayPropertiesChange: props.onViewDisplayPropertiesChange,
    onViewFiltersChange: props.onViewFiltersChange,
    onViewNameChange: props.onViewNameChange,
    onViewPropertyQueryChange: props.onViewPropertyQueryChange,
    onViewSortChange: props.onViewSortChange,
    onViewToneChange: props.onViewToneChange,
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: mobileColors.app,
    overflow: 'hidden',
  },
  shellRoot: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: mobileColors.app,
  },
  panelHost: {
    alignSelf: 'stretch',
    height: '100%',
  },
  propertiesPanelHost: {
    width: desktopPanelParity.inspectorWidth,
  },
  leftChromeHost: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: '100%',
  },
})
