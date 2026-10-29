import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  ScrollView,
} from 'react-native'
import { Text } from '../components/ui/text'
import { MobileEditorBlocks } from '../components/workspace/MobileEditorBlocks'
import { MobileFilePreview } from '../components/workspace/MobileFilePreview'
import { MobileMarkdownSourceEditor } from '../components/workspace/MobileMarkdownSourceEditor'
import { MobileWysiwygMarkdownEditor } from '../components/workspace/MobileWysiwygMarkdownEditor'
import { mobileText } from '../i18n/mobileText'
import { MobileLayoutProbeReadout } from '../qa/MobileLayoutProbeReadout'
import { useMobileLayoutProbe } from '../qa/mobileLayoutProbe'
import {
  type NativeTableOfContentsProof,
  nativeTableOfContentsScrollProof,
} from '../qa/nativeTableOfContentsProbe'
import { MobilePanel } from '../ui/MobilePanel'
import { useMobileColors, useMobileMetrics, useMobileStyles } from '../ui/theme/useMobileTheme'
import { useMobileAttachmentImporter } from '../workspace/mobileAttachmentImport'
import { useMobileAttachmentLinkOpener } from '../workspace/mobileAttachmentOpen'
import { useRegisteredMobileEditorCommands } from '../workspace/mobileEditorCommands'
import { mobileNoteActionMode } from '../workspace/mobileNoteActionMode'
import type { MobileNoteReadState } from '../workspace/mobileNoteRead'
import { mobileSpreadsheetNeedsFallback } from '../workspace/mobileSpreadsheetFormat'
import type { MobileTableOfContentsTarget } from '../workspace/mobileTableOfContents'
import { mobileNoteIdForWikilinkTarget } from '../workspace/mobileWikilinks'
import type { MobileEditorBlock, MobileNote } from '../workspace/mobileWorkspaceModel'
import { useMobilePullToSync } from '../workspace/useMobilePullToSync'
import { MobileEditorToolbar } from './MobileEditorToolbar'
import type {
  EditorContentProps,
  EditorEditingMode,
  EditorFileMode,
  EditorPanelBodyProps,
  TableOfContentsScroll,
  TabletEditorPanelProps,
} from './TabletEditorPanel.types'
import {
  EmptyEditorPanel,
  MobileFilePreviewFallback,
  MobileNoteReadFallback,
  MobileSpreadsheetFallback,
} from './TabletEditorPanelChrome'
import { createEditorPanelStyles } from './TabletEditorPanelStyles'
import { useEditorModeSwitch } from './useEditorModeSwitch'

export type { EditorEditingMode } from './TabletEditorPanel.types'

export function TabletEditorPanel(props: TabletEditorPanelProps) {
  const themeStyles = useMobileStyles(createEditorPanelStyles)
  const { panelStyles } = themeStyles
  const refreshControl = useMobilePullToSync()
  const {
    compact,
    initialEditing = true,
    initialEditingMode = 'wysiwyg',
    layoutProbe: layoutProbeEnabled = false,
    leading,
    trailing,
    note,
    noteRead,
    notes,
    onNavigateWikilink,
    onOpenMoreActions,
    onOpenTableOfContents,
    onRegisterEditorCommands,
    onTableOfContentsScrollProof,
    onToggleFavorite,
    tableOfContentsTarget = null,
    typeDefinitions,
    vaultRootUri = null,
  } = props
  const [editingMode, setEditingMode] = useState<EditorEditingMode>(initialEditingMode)
  const { onScroll, onTargetLayout, setScrollViewNode } = useTableOfContentsScroll(
    tableOfContentsTarget,
    onTableOfContentsScrollProof,
  )
  const importAttachment = useMobileAttachmentImporter(vaultRootUri)
  const openLink = useMobileAttachmentLinkOpener(vaultRootUri)
  const navigateWikilink = useCallback((target: string) => {
    if (!mobileNoteIdForWikilinkTarget(notes, target)) {
      Alert.alert(mobileText('noteList.empty.noMatching'))
      return
    }
    onNavigateWikilink(target)
  }, [notes, onNavigateWikilink])
  const layoutProbe = useMobileLayoutProbe(layoutProbeEnabled)
  const changeEditingMode = useCallback(() => {
    setEditingMode((current) => (current === 'source' ? 'wysiwyg' : 'source'))
  }, [])
  const { toggle: toggleSourceMode, failed: modeSwitchFailed } = useEditorModeSwitch(
    note?.id,
    changeEditingMode,
  )
  useRegisteredMobileEditorCommands(onRegisterEditorCommands, {
    toggleRawEditor: note && editorFileMode(note) === 'markdown' ? toggleSourceMode : undefined,
  })

  if (!note) {
    return <EmptyEditorPanel />
  }

  const fileMode = editorFileMode(note)
  const plainText = fileMode === 'text'
  const effectiveEditing = canEditCurrentNote(fileMode, initialEditing, noteRead)
  const effectiveEditingMode = plainText ? 'source' : editingMode
  const contentProps = createEditorContentProps({ ...props, onNavigateWikilink: navigateWikilink }, note, {
    editing: effectiveEditing,
    editingMode: effectiveEditingMode,
    layoutProbe: layoutProbe.probe,
    onImportAttachment: importAttachment,
    onOpenLink: openLink,
    onTableOfContentsTargetLayout: onTargetLayout,
    plainText,
  })

  return (
    <MobilePanel
      {...layoutProbe.probe('editor.panel')}
      style={panelStyles.panel}
      testID="editor-panel"
    >
      <MobileEditorToolbar
        editingMode={effectiveEditingMode}
        editing={effectiveEditing}
        fileMode={fileMode}
        leading={leading}
        trailing={trailing}
        note={note}
        renameFilename={props.renameFilename}
        onOpenMoreActions={onOpenMoreActions}
        onOpenTableOfContents={onOpenTableOfContents}
        onToggleSourceMode={toggleSourceMode}
        onToggleFavorite={onToggleFavorite}
        typeDefinitions={typeDefinitions}
      />
      <EditorModeFailure failed={modeSwitchFailed} />
      <EditorPanelBody
        compact={compact}
        contentProps={contentProps}
        fileMode={fileMode}
        note={note}
        noteRead={noteRead}
        onScroll={onScroll}
        onScrollViewRef={setScrollViewNode}
        refreshControl={refreshControl}
      />
      {layoutProbeEnabled ? (
        <MobileLayoutProbeReadout metrics={layoutProbe.metrics} testID="editor-layout-metrics" />
      ) : null}
    </MobilePanel>
  )
}

function createEditorContentProps(
  props: TabletEditorPanelProps,
  note: MobileNote,
  options: Pick<
    EditorContentProps,
    | 'editing'
    | 'editingMode'
    | 'layoutProbe'
    | 'onImportAttachment'
    | 'onOpenLink'
    | 'onTableOfContentsTargetLayout'
    | 'plainText'
  >,
): EditorContentProps {
  return {
    blocks: props.blocks,
    bullets: props.bullets,
    compact: props.compact,
    ...options,
    note,
    notes: props.notes,
    onNavigateWikilink: props.onNavigateWikilink,
    onRegisterEditorCommands: props.onRegisterEditorCommands,
    onTableOfContentsScrollProof: props.onTableOfContentsScrollProof,
    onUpdateContent: props.onUpdateContent,
    sourceIdleSave: props.sourceIdleSave ?? true,
    sourceSelectionProbe: props.sourceSelectionProbe ?? false,
    tableOfContentsTarget: props.tableOfContentsTarget,
    typeDefinitions: props.typeDefinitions,
    vaultRootUri: props.vaultRootUri ?? null,
    wysiwygAutocompleteProbe: props.wysiwygAutocompleteProbe ?? false,
    wysiwygExternalLinkProbe: props.wysiwygExternalLinkProbe ?? false,
    wysiwygFormatCommandProbe: props.wysiwygFormatCommandProbe ?? false,
    wysiwygInputTransformProbe: props.wysiwygInputTransformProbe ?? false,
    wysiwygMarkdownBlockProbe: props.wysiwygMarkdownBlockProbe ?? false,
    wysiwygMathEditProbe: props.wysiwygMathEditProbe ?? false,
    wysiwygTableCommandMutationProbe: props.wysiwygTableCommandMutationProbe ?? false,
    wysiwygMutationProbe: props.wysiwygMutationProbe ?? false,
    wysiwygWikilinkInsertProbe: props.wysiwygWikilinkInsertProbe ?? false,
  }
}

function EditorModeFailure({ failed }: { failed: boolean }) {
  const colors = useMobileColors()
  const metrics = useMobileMetrics()
  return failed ? (
    <Text
      accessibilityRole="alert"
      style={{
        color: colors.danger,
        fontSize: metrics.type.body,
        padding: metrics.space.md,
      }}
    >
      {mobileText('mobile.editor.readFailed')}
    </Text>
  ) : null
}

function EditorPanelBody(
  props: EditorPanelBodyProps & {
    refreshControl?: ReactElement<RefreshControlProps>
  },
) {
  const {
    compact,
    contentProps,
    fileMode,
    note,
    noteRead,
    onScroll,
    onScrollViewRef,
    refreshControl,
  } = props
  const themeStyles = useMobileStyles(createEditorPanelStyles)
  const { panelStyles } = themeStyles
  const readFallback = noteReadFallbackState(noteRead, note)
  if (readFallback) return <MobileNoteReadFallback note={note} state={readFallback} />
  if (fileMode === 'binary') {
    return (
      <MobileFilePreview
        note={note}
        vaultRootUri={contentProps.vaultRootUri}
        fallback={
          <ScrollView contentContainerStyle={panelStyles.filePreviewContent} testID="editor-scroll">
            <MobileFilePreviewFallback note={note} typeDefinitions={contentProps.typeDefinitions} />
          </ScrollView>
        }
      />
    )
  }

  if (mobileSpreadsheetNeedsFallback(note, contentProps.editingMode)) {
    return <MobileSpreadsheetFallback />
  }

  if (contentProps.editing) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        nestedScrollEnabled
        refreshControl={refreshControl}
        style={panelStyles.editorHost}
        testID="editor-scroll"
      >
        <EditorContent {...contentProps} />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={readModeContentStyle(themeStyles, note, compact)}
      onScroll={onScroll}
      ref={onScrollViewRef}
      refreshControl={refreshControl}
      scrollEventThrottle={16}
      style={panelStyles.editorHost}
      testID="editor-scroll"
    >
      <EditorContent {...contentProps} />
    </ScrollView>
  )
}

function canEditCurrentNote(fileMode: EditorFileMode, editing: boolean, noteRead?: MobileNoteReadState) {
  return fileMode !== 'binary' && editing && noteRead?.status !== 'loading'
}

function noteReadFallbackState(noteRead: MobileNoteReadState | undefined, note: MobileNote) {
  if (!noteRead || noteRead.status === 'ready') return null
  return noteRead.status === 'error' || note.rawContent === undefined ? noteRead : null
}

function useTableOfContentsScroll(
  target: MobileTableOfContentsTarget | null,
  onProof?: (proof: NativeTableOfContentsProof) => void,
): TableOfContentsScroll {
  const metrics = useMobileMetrics()
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [scrollViewVersion, setScrollViewVersion] = useState(0)
  const scrollViewRef = useRef<ScrollView | null>(null)
  const scrollYRef = useRef(0)
  const targetOffsetsRef = useRef<Record<string, number>>({})
  const setScrollViewNode = useCallback((node: ScrollView | null) => {
    scrollViewRef.current = node
    setScrollViewVersion((current) => current + 1)
  }, [])
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y
  }, [])
  const onTargetLayout = useCallback((targetId: string, event: LayoutChangeEvent) => {
    targetOffsetsRef.current[targetId] = event.nativeEvent.layout.y
    setLayoutVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!target) return

    const y = targetOffsetsRef.current[target.id]
    if (typeof y !== 'number') return
    const scrollView = scrollViewRef.current
    if (!scrollView) return

    const beforeY = scrollYRef.current
    const expectedY = Math.max(0, y - metrics.editor.contentPaddingVertical)
    scrollView.scrollTo({
      animated: true,
      y: expectedY,
    })

    if (!onProof) return

    const proofTimeout = setTimeout(() => {
      onProof(
        nativeTableOfContentsScrollProof({
          afterY: scrollYRef.current,
          beforeY,
          expectedY,
          targetId: target.id,
        }),
      )
    }, 900)

    return () => clearTimeout(proofTimeout)
  }, [layoutVersion, onProof, scrollViewVersion, target, metrics])

  return { onScroll, onTargetLayout, setScrollViewNode }
}

function EditorContent({
  blocks,
  bullets,
  compact,
  editing,
  editingMode,
  layoutProbe,
  note,
  notes,
  plainText,
  onImportAttachment,
  onNavigateWikilink,
  onOpenLink,
  onRegisterEditorCommands,
  onTableOfContentsScrollProof,
  onTableOfContentsTargetLayout,
  onUpdateContent,
  sourceIdleSave,
  sourceSelectionProbe = false,
  tableOfContentsTarget = null,
  typeDefinitions,
  vaultRootUri = null,
  wysiwygAutocompleteProbe = false,
  wysiwygExternalLinkProbe = false,
  wysiwygFormatCommandProbe = false,
  wysiwygInputTransformProbe = false,
  wysiwygMarkdownBlockProbe = false,
  wysiwygMathEditProbe = false,
  wysiwygTableCommandMutationProbe = false,
  wysiwygWikilinkInsertProbe = false,
  wysiwygMutationProbe = false,
}: EditorContentProps) {
  if (editing) {
    if (plainText || editingMode === 'source') {
      return (
        <MobileMarkdownSourceEditor
          key={`${note.id}:${plainText ? 'text' : 'source'}`}
          blocks={blocks}
          bullets={bullets}
          compact={compact}
          note={note}
          notes={notes}
          onImportAttachment={onImportAttachment}
          onRegisterEditorCommands={onRegisterEditorCommands}
          onUpdateContent={onUpdateContent}
          idleSave={sourceIdleSave}
          plainText={plainText}
          sourceSelectionProbe={sourceSelectionProbe}
        />
      )
    }

    return (
      <MobileWysiwygMarkdownEditor
        key={`${note.id}:wysiwyg`}
        blocks={blocks}
        bullets={bullets}
        compact={compact}
        layoutProbe={layoutProbe}
        note={note}
        notes={notes}
        onNavigateWikilink={onNavigateWikilink}
        onImportAttachment={onImportAttachment}
        onOpenLink={onOpenLink}
        onRegisterEditorCommands={onRegisterEditorCommands}
        onTableOfContentsScrollProof={onTableOfContentsScrollProof}
        onUpdateContent={onUpdateContent}
        tableOfContentsTarget={tableOfContentsTarget}
        typeDefinitions={typeDefinitions}
        vaultRootUri={vaultRootUri}
        wysiwygAutocompleteProbe={wysiwygAutocompleteProbe}
        wysiwygExternalLinkProbe={wysiwygExternalLinkProbe}
        wysiwygFormatCommandProbe={wysiwygFormatCommandProbe}
        wysiwygInputTransformProbe={wysiwygInputTransformProbe}
        wysiwygMarkdownBlockProbe={wysiwygMarkdownBlockProbe}
        wysiwygMathEditProbe={wysiwygMathEditProbe}
        wysiwygTableCommandMutationProbe={wysiwygTableCommandMutationProbe}
        wysiwygWikilinkInsertProbe={wysiwygWikilinkInsertProbe}
        wysiwygMutationProbe={wysiwygMutationProbe}
      />
    )
  }

  const readBlocks = note.editorBlocks ?? blocks
  const readBullets = note.editorBullets ?? bullets

  return (
    <MobileEditorBlocks
      blocks={readBlocks}
      fallbackBullets={readBullets}
      renderTitleBlock={shouldRenderReadTitleBlock(note, readBlocks)}
      tableOfContentsTitle={note.title}
      onTableOfContentsTargetLayout={onTableOfContentsTargetLayout}
      onOpenLink={onOpenLink}
      onNavigateWikilink={onNavigateWikilink}
    />
  )
}

function shouldRenderReadTitleBlock(note: MobileNote, blocks: MobileEditorBlock[]) {
  if (blocks.length === 0) return false
  if (generatedUntitledTitlePattern.test(note.title)) return false
  return note.title.trim().length > 0
}

const generatedUntitledTitlePattern = /^Untitled\s+\S+\s+\d+$/u

function editorFileMode(note: MobileNote): EditorFileMode {
  const actionMode = mobileNoteActionMode(note)
  if (actionMode === 'binary-file') return 'binary'
  return actionMode === 'text-file' ? 'text' : 'markdown'
}

function readModeContentStyle(
  themeStyles: ReturnType<typeof createEditorPanelStyles>,
  note: MobileNote,
  compact: boolean,
) {
  const { panelStyles } = themeStyles
  return [
    panelStyles.content,
    note.noteWidth === 'wide' ? panelStyles.contentWide : null,
    compact ? panelStyles.contentCompact : null,
  ]
}
