import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMobileLayoutProbe } from '../qa/mobileLayoutProbe'
import { useHorizontalSwipe } from '../ui/useHorizontalSwipe'
import { useMobileEditorCommandRegistry, useMobileEditorOverlayFocus } from '../workspace/mobileEditorCommands'
import { useMobileWorkspaceKeyboardShortcuts } from '../workspace/mobileWorkspaceKeyboardShortcuts'
import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import type { MobileDeepLinkNavigationRequest } from '../workspace/useMobileIncomingDeepLink'
import { useIncomingDeepLinkNavigation } from '../workspace/useIncomingDeepLinkNavigation'
import { fixtureReadOnlyWorkspaceRepository, type ReadOnlyWorkspaceRepository, type ReadOnlyWorkspaceRequest } from '../workspace/readOnlyWorkspaceRepository'
import { MobileCommandPalette } from '../components/workspace/MobileCommandPalette'
import { buildMobileCommandPaletteCommands } from '../workspace/mobileCommandPalette'
import { logNativeMobileCommandPaletteProof } from '../qa/nativeMobileCommandPaletteProbe'
import { logNativeMobileKeyboardShortcutActionProof, logNativeMobileKeyboardShortcutBridgeProof } from '../qa/nativeMobileKeyboardShortcutProof'
import type { EditorEditingMode } from './TabletEditorPanel'
import { PhoneWorkspaceRoot } from './PhoneWorkspaceLayout'
import { usePhonePanelRail } from './usePhonePanelRail'
import { usePhoneViewportWidth } from './usePhoneViewportWidth'
import { phoneWorkspaceEditorOptions } from './phoneWorkspaceEditorOptions'
import { usePhonePanelDragSurface, usePhoneWorkspaceNavigation, type PhoneWorkspaceController } from './phoneWorkspaceScreenSupport'
import { usePhoneTableOfContentsTarget } from './usePhoneTableOfContentsTarget'
import { useTabletWorkspaceController } from './useTabletWorkspaceController'
import { useInitialActionSheetQaTarget } from './useInitialActionSheetQaTarget'
import type { MobileActionSheetQaTarget } from './tabletWorkspaceTypes'
import type { PhoneWorkspaceState } from './phoneWorkspaceTransitions'

export type { PhoneWorkspaceState } from './phoneWorkspaceTransitions'

type PhoneWorkspaceProps = {
  initialCommandPaletteOpen?: boolean
  initialEditorEditing?: boolean
  initialEditorEditingMode?: EditorEditingMode
  initialActionSheet?: MobileActionSheetQaTarget
  commandPaletteProbe?: boolean
  keyboardShortcutProbe?: boolean
  initialState?: PhoneWorkspaceState
  incomingNavigation?: MobileDeepLinkNavigationRequest | null
  onIncomingNavigationHandled?: (requestId: number) => void
  layoutProbe?: boolean
  onOpenNativeVault?: () => void
  repository?: ReadOnlyWorkspaceRepository
  repositoryRequest?: ReadOnlyWorkspaceRequest
  sourceIdleSave?: boolean
  sourceSelectionProbe?: boolean
  snapshot: MobileWorkspaceSnapshot
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

type PhoneWorkspaceChromeProps = PhoneWorkspaceProps & {
  controller: PhoneWorkspaceController
}

export function PhoneWorkspace(props: PhoneWorkspaceProps) {
  const { repository = fixtureReadOnlyWorkspaceRepository, repositoryRequest, snapshot } = props
  const controller = useTabletWorkspaceController({ repository, repositoryRequest, snapshot })
  const onOpenCreateNote = controller.snapshot.sync.kind === 'noVault' || controller.snapshot.sync.kind === 'readOnly'
    ? props.onOpenNativeVault ?? controller.onOpenCreateNote
    : controller.onOpenCreateNote
  useInitialActionSheetQaTarget(controller.onOpenActionSheetQaTarget, props.initialActionSheet)
  return <PhoneWorkspaceChrome {...props} controller={{ ...controller, onOpenCreateNote }} />
}

function PhoneWorkspaceChrome(props: PhoneWorkspaceChromeProps) {
  const {
    commandPaletteProbe = false,
    controller: baseController,
    initialState = 'list',
    keyboardShortcutProbe = false,
    onOpenNativeVault,
  } = props
  const options = phoneWorkspaceEditorOptions(props)
  const [phoneState, updatePhoneState] = useState(initialState)
  const setPhoneState = useCallback((state: PhoneWorkspaceState) => updatePhoneState(state), [])
  const createAndOpenNote = useCallback(() => {
    baseController.onOpenCreateNote()
    if (baseController.snapshot.sync.kind !== 'noVault' && baseController.snapshot.sync.kind !== 'readOnly') {
      setPhoneState('editor')
    }
  }, [baseController, setPhoneState])
  const controller = useMemo(
    () => ({ ...baseController, onOpenCreateNote: createAndOpenNote }),
    [baseController, createAndOpenNote],
  )
  const [sourceModeRequest, setSourceModeRequest] = useState(0)
  const width = usePhoneViewportWidth()
  const panelRail = usePhonePanelRail(phoneState, width, setPhoneState, options.layoutProbe)
  const editorCommandRegistry = useMobileEditorCommandRegistry()
  const tableOfContents = usePhoneTableOfContentsTarget(setPhoneState)
  const phoneLayoutProbe = useMobileLayoutProbe(options.layoutProbe)
  const navigation = usePhoneWorkspaceNavigation({ controller, setPhoneState, setSourceModeRequest })
  useIncomingDeepLinkNavigation(props.incomingNavigation, navigation.openEditor, props.onIncomingNavigationHandled)
  const selectNextNote = useCallback(() => selectAdjacentVisiblePhoneNote(controller.notes, controller.selectedNoteId, controller.onSelectNote, 1), [controller])
  const selectPreviousNote = useCallback(() => selectAdjacentVisiblePhoneNote(controller.notes, controller.selectedNoteId, controller.onSelectNote, -1), [controller])
  const commandPalette = usePhoneCommandPalette({
    controller,
    initialOpen: props.initialCommandPaletteOpen,
    onOpenNativeVault,
    onPastePlainText: editorCommandRegistry.commands.pastePlainText,
    onSaveActiveEditor: editorCommandRegistry.commands.save,
    onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
    openEditor: navigation.openEditor,
    openList: navigation.openList,
    openNeighborhoodList: navigation.openNeighborhoodList,
    openProperties: navigation.openProperties,
    openSidebar: navigation.openSidebar,
    phoneState,
  })
  useMobileEditorOverlayFocus(phoneState !== 'editor' || Boolean(controller.openAction) || commandPalette.visible, editorCommandRegistry.commands)
  useMobileWorkspaceKeyboardShortcuts({
    nativeNoteNavigationEnabled: phoneState === 'list' && !commandPalette.visible && !controller.openAction,
    onCreateNote: controller.onOpenCreateNote,
    onOpenFindInNote: controller.onOpenFindInNote,
    onOpenCommandPalette: commandPalette.open,
    onOpenSearch: controller.onOpenSearch,
    onSelectNextNote: selectNextNote,
    onSelectPreviousNote: selectPreviousNote,
    onShortcutAction: keyboardShortcutProbe ? logNativeMobileKeyboardShortcutActionProof : undefined,
    onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
  })
  usePhoneCommandPaletteProof(commandPalette.commands, commandPaletteProbe)
  usePhoneKeyboardShortcutBridgeProof(keyboardShortcutProbe)
  const createRelationshipTargetAndOpenEditor = useCreateRelationshipTargetAndOpenEditor(controller, setPhoneState)
  const transitionSwipeHandlers = usePhoneSwipeHandlers({
    openEditor: navigation.openEditor,
    openList: navigation.openList,
    openProperties: navigation.openProperties,
    openSidebar: navigation.openSidebar,
    phoneState,
  })
  const suggestionNotes = controller.snapshot.allNotes ?? controller.snapshot.notes
  return (
    <PhoneWorkspaceRoot
      commandPaletteElement={commandPalette.element}
      controller={controller}
      createRelationshipTargetAndOpenEditor={createRelationshipTargetAndOpenEditor}
      panelRail={panelRail}
      editorCommandRegistry={editorCommandRegistry}
      navigation={navigation}
      openCommandPalette={commandPalette.open}
      options={options}
      phoneLayoutProbe={phoneLayoutProbe.probe}
      phoneState={phoneState}
      selectTableOfContentsTarget={tableOfContents.select}
      sourceModeRequest={sourceModeRequest}
      suggestionNotes={suggestionNotes}
      tableOfContentsTarget={tableOfContents.target}
      transitionSwipeHandlers={transitionSwipeHandlers}
      onOpenNativeVault={onOpenNativeVault}
    />
  )
}

export type PhoneWorkspaceNavigation = ReturnType<typeof usePhoneWorkspaceNavigation>

function selectAdjacentVisiblePhoneNote(
  notes: MobileNote[],
  selectedNoteId: string | null,
  onSelectNote: (noteId: string) => void,
  direction: -1 | 1,
) {
  if (notes.length === 0) return
  const currentIndex = Math.max(0, notes.findIndex((note) => note.id === selectedNoteId))
  const nextIndex = Math.max(0, Math.min(notes.length - 1, currentIndex + direction))
  const noteId = notes[nextIndex]?.id
  if (noteId) onSelectNote(noteId)
}

function usePhoneKeyboardShortcutBridgeProof(enabled: boolean) {
  useEffect(() => {
    if (enabled) logNativeMobileKeyboardShortcutBridgeProof()
  }, [enabled])
}

function useCreateRelationshipTargetAndOpenEditor(
  controller: PhoneWorkspaceController,
  setPhoneState: (nextState: PhoneWorkspaceState) => void,
) {
  return useCallback(() => {
    controller.onCreateRelationshipTarget()
    setPhoneState('editor')
  }, [controller, setPhoneState])
}

type UsePhoneCommandPaletteProps = {
  controller: PhoneWorkspaceController
  initialOpen?: boolean
  onOpenNativeVault?: () => void
  onPastePlainText?: () => void
  onSaveActiveEditor?: () => void
  onToggleRawEditor?: () => void
  openEditor: (noteId?: string) => void
  openList: () => void
  openNeighborhoodList: (noteId: string) => void
  openProperties: () => void
  openSidebar: () => void
  phoneState: PhoneWorkspaceState
}

function usePhoneCommandPalette(props: UsePhoneCommandPaletteProps) {
  const { initialOpen = false, openEditor, openProperties, phoneState } = props
  const [visible, setVisible] = useState(initialOpen)
  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])
  const toggleProperties = useCallback(() => {
    if (phoneState === 'properties') openEditor()
    else openProperties()
  }, [openEditor, openProperties, phoneState])
  const commands = usePhonePaletteCommands(props, open, toggleProperties)
  return { commands, element: visible ? <MobileCommandPalette commands={commands} onClose={close} /> : null, open, visible }
}

function usePhonePaletteCommands(props: UsePhoneCommandPaletteProps, open: () => void, toggleProperties: () => void) {
  const {
    controller,
    onOpenNativeVault,
    onPastePlainText,
    onSaveActiveEditor,
    onToggleRawEditor,
    openEditor,
    openList,
    openNeighborhoodList,
    openProperties,
    openSidebar,
  } = props
  return useMemo(() => buildMobileCommandPaletteCommands({
    ...controller,
    onOpenCommandPalette: open,
    onOpenBacklinks: openProperties,
    onOpenNativeVault,
    onEnterNeighborhood: openNeighborhoodList,
    onPastePlainText,
    onSaveActiveEditor,
    onToggleRawEditor,
    onToggleProperties: toggleProperties,
    onViewAll: openSidebar,
    onViewEditorList: openList,
    onViewEditorOnly: openEditor,
  }), [
    controller,
    onOpenNativeVault,
    open,
    onPastePlainText,
    onSaveActiveEditor,
    onToggleRawEditor,
    openEditor,
    openList,
    openNeighborhoodList,
    openProperties,
    openSidebar,
    toggleProperties,
  ])

}

type UsePhoneSwipeHandlersProps = Pick<PhoneWorkspaceNavigation, 'openEditor' | 'openList' | 'openProperties' | 'openSidebar'> & {
  phoneState: PhoneWorkspaceState
}

function usePhoneSwipeHandlers({
  openEditor,
  openList,
  openProperties,
  openSidebar,
  phoneState,
}: UsePhoneSwipeHandlersProps) {
  const canStart = usePhonePanelDragSurface(phoneState)
  const actions = {
    editor: { onSwipeLeft: openProperties, onSwipeRight: openList },
    list: { onSwipeRight: openSidebar },
    properties: { onSwipeRight: openEditor },
    sidebar: { onSwipeLeft: openList },
  }
  return useHorizontalSwipe({ canStart, ...actions[phoneState] })
}

function usePhoneCommandPaletteProof(commands: ReturnType<typeof buildMobileCommandPaletteCommands>, enabled: boolean) {
  useEffect(() => {
    if (enabled) logNativeMobileCommandPaletteProof(commands)
  }, [commands, enabled])
}
