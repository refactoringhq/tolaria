import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { probeProps } from '../qa/mobileLayoutProbe'
import { useMobileStyles } from '../ui/theme/useMobileTheme'
import type { RegisterMobileEditorCommands } from '../workspace/mobileEditorCommands'
import { mobileNoteIdForWikilinkTarget } from '../workspace/mobileWikilinks'
import type { MobileNote } from '../workspace/mobileWorkspaceModel'
import { PhoneEditorGlassChrome } from './PhoneEditorGlassChrome'
import { PhoneTopBar } from './PhoneWorkspaceChrome'
import type { PhoneWorkspaceEditorOptions } from './phoneWorkspaceEditorOptions'
import type {
  PhoneTableOfContentsTargetRequest,
  PhoneWorkspaceController,
  PhoneWorkspaceStateViewProps,
} from './phoneWorkspaceScreenSupport'
import { createThemeStyles } from './phoneWorkspaceStyles'
import { TabletEditorPanel } from './TabletEditorPanel'
import type { TabletEditorPanelProps } from './TabletEditorPanel.types'

type PhoneEditorBodyProps = {
  controller: PhoneWorkspaceController
  notes: MobileNote[]
  onNavigateWikilink: (target: string) => void
  onRegisterEditorCommands?: RegisterMobileEditorCommands
  options: PhoneWorkspaceEditorOptions
  sourceModeRequest: number
  tableOfContentsTarget: PhoneTableOfContentsTargetRequest | null
  phoneChromeTopInset: number
  onTitleVisibilityChange: (visible: boolean) => void
}

function PhoneEditorBody(props: PhoneEditorBodyProps) {
  const { controller, notes, options, sourceModeRequest } = props
  const sourceModeRequested = sourceModeRequest > 0
  const panelProps: TabletEditorPanelProps = {
    blocks: controller.editorBlocks,
    bullets: controller.editorBullets,
    compact: true,
    hideToolbar: true,
    phoneChromeTopInset: props.phoneChromeTopInset,
    onTitleVisibilityChange: props.onTitleVisibilityChange,
    initialEditing: sourceModeRequested || options.initialEditorEditing,
    initialEditingMode: sourceModeRequested ? 'source' : options.initialEditorEditingMode,
    layoutProbe: options.layoutProbe,
    note: controller.selectedNote,
    noteRead: controller.selectedNoteRead,
    notes,
    tableOfContentsTarget: props.tableOfContentsTarget,
    typeDefinitions: controller.snapshot.typeDefinitions,
    vaultRootUri: controller.vaultRootUri,
    onNavigateWikilink: props.onNavigateWikilink,
    onOpenMoreActions: controller.onOpenMoreActions,
    onRegisterEditorCommands: props.onRegisterEditorCommands,
    onToggleFavorite: controller.onToggleFavorite,
    onUpdateContent: controller.onUpdateNoteContent,
    renameFilename: {
      value: controller.readOnlyForm.filenameStem,
      notes,
      onChange: controller.onFilenameStemChange,
      onSubmit: controller.onRenameNoteFile,
    },
    sourceIdleSave: options.sourceIdleSave,
    sourceSelectionProbe: options.sourceSelectionProbe,
    wysiwygAutocompleteProbe: options.wysiwygAutocompleteProbe,
    wysiwygExternalLinkProbe: options.wysiwygExternalLinkProbe,
    wysiwygFormatCommandProbe: options.wysiwygFormatCommandProbe,
    wysiwygInputTransformProbe: options.wysiwygInputTransformProbe,
    wysiwygMarkdownBlockProbe: options.wysiwygMarkdownBlockProbe,
    wysiwygMathEditProbe: options.wysiwygMathEditProbe,
    wysiwygTableCommandMutationProbe: options.wysiwygTableCommandMutationProbe,
    wysiwygWikilinkInsertProbe: options.wysiwygWikilinkInsertProbe,
    wysiwygMutationProbe: options.wysiwygMutationProbe,
  }

  return <TabletEditorPanel key={`phone-editor-${controller.selectedNote?.id ?? 'none'}-${sourceModeRequest}`} {...panelProps} />
}

type PhoneEditorScreenViewProps = {
  props: PhoneWorkspaceStateViewProps
  wikilinkNavigation: ReturnType<typeof usePhoneWikilinkNavigation>
  titleVisible: boolean
  onTitleVisibilityChange: (visible: boolean) => void
}

function PhoneEditorScreenView({ props, wikilinkNavigation, titleVisible, onTitleVisibilityChange }: PhoneEditorScreenViewProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const insets = useSafeAreaInsets()
  const header = phoneEditorHeaderProps(props, wikilinkNavigation, titleVisible)
  const body = phoneEditorBodyProps(props, wikilinkNavigation, insets.top + 60, onTitleVisibilityChange)

  return (
    <View {...probeProps(props.phoneLayoutProbe, 'phone.editor.screen')} style={styles.screen} testID="phone-editor-screen">
      <PhoneEditorHeader {...header} />
      <PhoneEditorBody {...body} />
    </View>
  )
}

type PhoneEditorHeaderProps = {
  controller: PhoneWorkspaceController
  hasWikilinkHistory: boolean
  onBackFromWikilink: () => void
  openList: () => void
  openProperties: () => void
  rawMode: boolean
  sourceModeRequest: number
  titleVisible: boolean
  toggleRawEditor: () => void
}

function phoneEditorHeaderProps(
  props: PhoneWorkspaceStateViewProps,
  navigation: ReturnType<typeof usePhoneWikilinkNavigation>,
  titleVisible: boolean,
): PhoneEditorHeaderProps {
  return {
    controller: props.controller,
    hasWikilinkHistory: navigation.hasHistory,
    onBackFromWikilink: navigation.back,
    openList: props.openList,
    openProperties: props.openProperties,
    rawMode: props.sourceModeRequest > 0,
    sourceModeRequest: props.sourceModeRequest,
    titleVisible,
    toggleRawEditor: props.toggleRawEditor,
  }
}

function phoneEditorBodyProps(
  props: PhoneWorkspaceStateViewProps,
  navigation: ReturnType<typeof usePhoneWikilinkNavigation>,
  phoneChromeTopInset: number,
  onTitleVisibilityChange: (visible: boolean) => void,
): PhoneEditorBodyProps {
  return {
    controller: props.controller,
    notes: props.suggestionNotes,
    onNavigateWikilink: navigation.navigate,
    onRegisterEditorCommands: props.onRegisterEditorCommands,
    options: props.options,
    sourceModeRequest: props.sourceModeRequest,
    tableOfContentsTarget: props.tableOfContentsTarget,
    phoneChromeTopInset,
    onTitleVisibilityChange,
  }
}

function PhoneEditorHeader(props: PhoneEditorHeaderProps) {
  const note = props.controller.selectedNote
  if (!note) return <PhoneTopBar title="" onBack={props.openList} />

  return (
    <PhoneEditorGlassChrome
      key={`${note.id}:${props.sourceModeRequest}`}
      favorite={note.favorite}
      noteTitle={note.title}
      titleVisible={props.titleVisible}
      rawMode={props.rawMode}
      onBack={props.hasWikilinkHistory ? props.onBackFromWikilink : props.openList}
      onDeleteNote={props.controller.onDeleteNote}
      onExportPdf={props.controller.onExportNoteAsPdf}
      onFind={props.controller.onOpenFindInNote}
      onMove={props.controller.onOpenMoveNoteToFolder}
      onOpenProperties={props.openProperties}
      onRename={props.controller.onOpenRenameNoteFile}
      onTitlePress={props.controller.onOpenRenameNoteFile}
      onToggleFavorite={props.controller.onToggleFavorite}
      onToggleSourceMode={props.toggleRawEditor}
    />
  )
}

export function PhoneEditorScreen(props: PhoneWorkspaceStateViewProps) {
  const wikilinkNavigation = usePhoneWikilinkNavigation({
    controller: props.controller,
    suggestionNotes: props.suggestionNotes,
  })
  const [titleVisible, setTitleVisible] = useState(false)

  return (
    <PhoneEditorScreenView
      props={props}
      wikilinkNavigation={wikilinkNavigation}
      titleVisible={titleVisible}
      onTitleVisibilityChange={setTitleVisible}
    />
  )
}

type UsePhoneWikilinkNavigationProps = {
  controller: PhoneWorkspaceController
  suggestionNotes: MobileNote[]
}

function usePhoneWikilinkNavigation({ controller, suggestionNotes }: UsePhoneWikilinkNavigationProps) {
  const [history, setHistory] = useState<string[]>([])
  const navigate = useCallback(
    (target: string) => {
      const noteId = mobileNoteIdForWikilinkTarget(suggestionNotes, target)
      const sourceId = controller.selectedNote?.id
      if (!noteId || !sourceId || noteId === sourceId) return

      setHistory((current) => [...current, sourceId])
      controller.onSelectNote(noteId)
    },
    [controller, suggestionNotes],
  )
  const back = useCallback(() => {
    const previousNoteId = history.at(-1)
    if (!previousNoteId) return

    setHistory((current) => current.slice(0, -1))
    controller.onSelectNote(previousNoteId)
  }, [controller, history])
  return { back, hasHistory: history.length > 0, navigate }
}
