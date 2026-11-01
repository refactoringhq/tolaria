import { useMobileStyles } from '../ui/theme/useMobileTheme'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { Dimensions, Platform, useWindowDimensions, View } from 'react-native'

import { MobileWorkspaceEditNotice } from '../components/workspace/MobileWorkspaceEditNotice'

import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import type { MobileDeepLinkNavigationRequest } from '../workspace/useMobileIncomingDeepLink'
import { useIncomingDeepLinkNavigation } from '../workspace/useIncomingDeepLinkNavigation'

import {
  fixtureReadOnlyWorkspaceRepository,
  type ReadOnlyWorkspaceRepository,
  type ReadOnlyWorkspaceRequest,
} from '../workspace/readOnlyWorkspaceRepository'

import {
  useMobileEditorCommandRegistry,
  useMobileEditorOverlayFocus,
  type MobileEditorCommands,
} from '../workspace/mobileEditorCommands'

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

import { tabletScreenModeForWindow } from './tabletWorkspaceScreenMode'

import type {
  MobileActionSheetQaTarget,
  TabletTransitionProbeMode,
  TabletWorkspaceChromeProps,
} from './tabletWorkspaceTypes'

import { useTabletWorkspaceController } from './useTabletWorkspaceController'

import { useInitialActionSheetQaTarget } from './useInitialActionSheetQaTarget'

import { useTabletPanelGestures } from './useTabletPanelGestures'

import type { TabletTableOfContentsTargetRequest, TabletPanelGestures } from './TabletWorkspacePanels'

import { TabletWorkspaceChromeView } from './WorkspaceChromeView'

import { createTabletWorkspaceStyles as createThemeStyles } from './TabletWorkspaceStyles'

type TabletWorkspaceProps = {
  forceDesktopPanels?: boolean
  initialCommandPaletteOpen?: boolean
  initialEditorEditing?: boolean
  initialEditorEditingMode?: TabletWorkspaceChromeProps['initialEditorEditingMode']
  initialActionSheet?: MobileActionSheetQaTarget
  incomingNavigation?: MobileDeepLinkNavigationRequest | null
  onIncomingNavigationHandled?: (requestId: number) => void
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
}

type TabletEditorCommandRegistry = ReturnType<typeof useMobileEditorCommandRegistry>
export type TabletWorkspaceChromeState = ReturnType<typeof useTabletChromeState>

export { WorkspaceActionSheetHost } from './TabletWorkspaceActionSheetHost'

export function TabletWorkspace(props: TabletWorkspaceProps) {
  const {
    forceDesktopPanels = false,
    initialActionSheet,
    onOpenNativeVault,
    repository = fixtureReadOnlyWorkspaceRepository,
    repositoryRequest,
    snapshot,
  } = props
  const { styles } = useMobileStyles(createThemeStyles)
  const controller = useTabletWorkspaceController({ repository, repositoryRequest, snapshot })
  useIncomingDeepLinkNavigation(props.incomingNavigation, controller.onSelectNote, props.onIncomingNavigationHandled)
  const onCreateNote =
    controller.snapshot.sync.kind === 'noVault' || controller.snapshot.sync.kind === 'readOnly'
      ? (onOpenNativeVault ?? controller.onOpenCreateNote)
      : controller.onOpenCreateNote
  const screenMode = useTabletScreenMode(forceDesktopPanels)
  useInitialActionSheetQaTarget(controller.onOpenActionSheetQaTarget, initialActionSheet)

  return (
    <View style={styles.shellRoot}>
      <TabletWorkspaceChrome
        {...tabletWorkspacePresentationProps(props)}
        compactTablet={screenMode.compactTablet}
        defaultPropertiesVisible={screenMode.defaultPropertiesVisible}
        defaultSidebarVisible={screenMode.defaultSidebarVisible}
        exclusiveSidePanels={screenMode.exclusiveSidePanels}
        propertiesReplaceSidebar={screenMode.propertiesReplaceSidebar}
        onOpenNativeVault={onOpenNativeVault}
        {...controller}
        onOpenCreateNote={onCreateNote}
      />
      <MobileWorkspaceEditNotice retry={controller.retryFailedEdit} />
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
  const { styles } = useMobileStyles(createThemeStyles)
  const chrome = useTabletChromeState(props)
  return <TabletWorkspaceChromeView workspace={props} chrome={chrome} styles={styles} />
}

function useTabletChromeState(props: TabletWorkspaceChromeProps) {
  const {
    commandPaletteProbe,
    compactTablet,
    defaultPropertiesVisible,
    defaultSidebarVisible = true,
    exclusiveSidePanels = false,
    propertiesReplaceSidebar = false,
    initialCommandPaletteOpen = false,
    onSelectNote,
    snapshot,
    tabletTransitionProbe = false,
  } = props
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(initialCommandPaletteOpen)
  const [tableOfContentsTarget, setTableOfContentsTarget] = useState<TabletTableOfContentsTargetRequest | null>(null)
  const editorCommandRegistry = useMobileEditorCommandRegistry()
  useMobileEditorOverlayFocus(Boolean(props.openAction) || commandPaletteOpen, editorCommandRegistry.commands)
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
  useTabletKeyboardShortcuts(props, gestures, editorCommandRegistry.commands, {
    open: openCommandPalette,
    visible: commandPaletteOpen,
  })
  const commandPaletteCommands = useTabletPaletteCommands(props, gestures, editorCommandRegistry, openCommandPalette)
  useTabletTransitionProbe(tabletTransitionProbe, gestures)
  const { handleNavigateWikilink, handleSelectTableOfContentsTarget } = useTabletNavigationHandlers(
    suggestionNotes,
    onSelectNote,
    setTableOfContentsTarget,
  )
  useTabletTableOfContentsProbe(props, tableOfContentsTarget, handleSelectTableOfContentsTarget)
  useTabletChromeQaProofs(commandPaletteProbe, props.keyboardShortcutProbe, commandPaletteCommands)
  return {
    gestures,
    suggestionNotes,
    editorCommandRegistry,
    tableOfContentsTarget,
    openCommandPalette,
    handleNavigateWikilink,
    handleSelectTableOfContentsTarget,
    commandPaletteCommands,
    commandPaletteOpen,
    closeCommandPalette,
  }
}

function useTabletNavigationHandlers(
  notes: MobileNote[],
  onSelectNote: TabletWorkspaceChromeProps['onSelectNote'],
  setTableOfContentsTarget: Dispatch<SetStateAction<TabletTableOfContentsTargetRequest | null>>,
) {
  return {
    handleNavigateWikilink: useTabletWikilinkNavigation(notes, onSelectNote),
    handleSelectTableOfContentsTarget: useTabletOutlineSelection(setTableOfContentsTarget),
  }
}

function useTabletWikilinkNavigation(suggestionNotes: MobileNote[], onSelectNote: TabletWorkspaceChromeProps['onSelectNote']) {
  return useCallback(
    (target: string) => {
      const noteId = mobileNoteIdForWikilinkTarget(suggestionNotes, target)
      if (noteId) onSelectNote(noteId)
    },
    [onSelectNote, suggestionNotes],
  )
}

function useTabletOutlineSelection(setTableOfContentsTarget: Dispatch<SetStateAction<TabletTableOfContentsTargetRequest | null>>) {
  return useCallback((target: MobileTableOfContentsTarget) => {
    setTableOfContentsTarget((current) => ({
      ...target,
      requestId: (current?.requestId ?? 0) + 1,
    }))
  }, [setTableOfContentsTarget])
}

function useTabletPaletteCommands(
  props: TabletWorkspaceChromeProps,
  gestures: TabletPanelGestures,
  editorCommandRegistry: TabletEditorCommandRegistry,
  openCommandPalette: () => void,
) {
  const { onOpenNativeVault } = props
  return useMemo(
    () =>
      buildMobileCommandPaletteCommands({
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
      }),
    [
      editorCommandRegistry.commands.pastePlainText,
      editorCommandRegistry.commands.save,
      editorCommandRegistry.commands.toggleRawEditor,
      gestures,
      onOpenNativeVault,
      openCommandPalette,
      props,
    ],
  )
}

function useTabletTableOfContentsProbe(
  props: TabletWorkspaceChromeProps,
  tableOfContentsTarget: TabletTableOfContentsTargetRequest | null,
  handleSelectTableOfContentsTarget: (target: MobileTableOfContentsTarget) => void,
) {
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
}

function useTabletChromeQaProofs(
  paletteProbe: boolean | undefined,
  keyboardProbe: boolean | undefined,
  commands: ReturnType<typeof buildMobileCommandPaletteCommands>,
) {
  useEffect(() => {
    if (paletteProbe) logNativeMobileCommandPaletteProof(commands)
  }, [commands, paletteProbe])
  useEffect(() => {
    if (keyboardProbe) logNativeMobileKeyboardShortcutBridgeProof()
  }, [keyboardProbe])
}

function useTabletTransitionProbe(mode: TabletTransitionProbeMode, gestures: TabletPanelGestures) {
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

function useTabletKeyboardShortcuts(
  props: TabletWorkspaceChromeProps,
  gestures: TabletPanelGestures,
  editor: MobileEditorCommands,
  palette: { open: () => void; visible: boolean },
) {
  const next = useCallback(
    () => selectAdjacentVisibleNote(props.notes, props.selectedNoteId, props.onSelectNote, 1),
    [props.notes, props.onSelectNote, props.selectedNoteId],
  )
  const previous = useCallback(
    () => selectAdjacentVisibleNote(props.notes, props.selectedNoteId, props.onSelectNote, -1),
    [props.notes, props.onSelectNote, props.selectedNoteId],
  )
  useMobileWorkspaceKeyboardShortcuts({
    nativeNoteNavigationEnabled: gestures.noteListVisible && !props.openAction && !palette.visible,
    onCreateNote: props.onOpenCreateNote,
    onOpenFindInNote: props.onOpenFindInNote,
    onOpenCommandPalette: palette.open,
    onOpenSearch: props.onOpenSearch,
    onSelectNextNote: next,
    onSelectPreviousNote: previous,
    onShortcutAction: props.keyboardShortcutProbe ? logNativeMobileKeyboardShortcutActionProof : undefined,
    onToggleRawEditor: editor.toggleRawEditor,
    onToggleProperties: gestures.toggleProperties,
    onViewAll: gestures.showAllPanels,
    onViewEditorList: gestures.showEditorList,
    onViewEditorOnly: gestures.showEditorOnly,
  })
}

function selectAdjacentVisibleNote(
  notes: MobileNote[],
  selectedNoteId: string | null,
  onSelectNote: (noteId: string) => void,
  direction: -1 | 1,
) {
  const noteId = adjacentVisibleNoteId(notes, selectedNoteId, direction)
  if (noteId) onSelectNote(noteId)
}

function adjacentVisibleNoteId(notes: MobileNote[], selectedNoteId: string | null, direction: -1 | 1) {
  if (notes.length === 0) return null
  const currentIndex = Math.max(
    0,
    notes.findIndex((note) => note.id === selectedNoteId),
  )
  const nextIndex = Math.max(0, Math.min(notes.length - 1, currentIndex + direction))
  return notes[nextIndex]?.id ?? null
}

function tabletWorkspacePresentationProps(props: TabletWorkspaceProps) {
  return {
    ...tabletWorkspaceCorePresentationProps(props),
    ...tabletWorkspaceLayoutProbeProps(props),
    ...tabletWorkspaceEditorProbeProps(props),
    ...tabletWorkspaceContentProbeProps(props),
  }
}

function tabletWorkspaceCorePresentationProps(props: TabletWorkspaceProps) {
  const {
    initialCommandPaletteOpen = false,
    initialEditorEditing = true,
    initialEditorEditingMode = 'wysiwyg',
    commandPaletteProbe = false,
    keyboardShortcutProbe = false,
    layoutProbe = false,
    onTableOfContentsScrollProof,
    sourceIdleSave = true,
    sourceSelectionProbe = false,
  } = props
  return {
    initialCommandPaletteOpen,
    initialEditorEditing,
    initialEditorEditingMode,
    commandPaletteProbe,
    keyboardShortcutProbe,
    layoutProbe,
    onTableOfContentsScrollProof,
    sourceIdleSave,
    sourceSelectionProbe,
  }
}

function tabletWorkspaceLayoutProbeProps(props: TabletWorkspaceProps) {
  const {
    tableOfContentsProbe = false,
    tabletTransitionProbe = false,
  } = props
  return { tableOfContentsProbe, tabletTransitionProbe }
}

function tabletWorkspaceEditorProbeProps(props: TabletWorkspaceProps) {
  const {
    wysiwygAutocompleteProbe = false,
    wysiwygExternalLinkProbe = false,
    wysiwygFormatCommandProbe = false,
    wysiwygInputTransformProbe = false,
  } = props
  return {
    wysiwygAutocompleteProbe,
    wysiwygExternalLinkProbe,
    wysiwygFormatCommandProbe,
    wysiwygInputTransformProbe,
  }
}

function tabletWorkspaceContentProbeProps(props: TabletWorkspaceProps) {
  const {
    wysiwygMarkdownBlockProbe = false,
    wysiwygMathEditProbe = false,
    wysiwygTableCommandMutationProbe = false,
    wysiwygWikilinkInsertProbe = false,
    wysiwygMutationProbe = false,
  } = props
  return {
    wysiwygMarkdownBlockProbe,
    wysiwygMathEditProbe,
    wysiwygTableCommandMutationProbe,
    wysiwygWikilinkInsertProbe,
    wysiwygMutationProbe,
  }
}
