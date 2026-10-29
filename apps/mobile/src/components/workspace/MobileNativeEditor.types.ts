import type { EditorBridge } from '@10play/tentap-editor'
import type { MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import type { NativeTableOfContentsProof } from '../../qa/nativeTableOfContentsProbe'
import type { RegisterMobileEditorCommands } from '../../workspace/mobileEditorCommands'
import type { MobileTableOfContentsTarget } from '../../workspace/mobileTableOfContents'
import type { MobileEditorBlock, MobileNote, MobileTypeDefinitions } from '../../workspace/mobileWorkspaceModel'
import type { applyNativeWysiwygFormat } from './MobileWysiwygFormatCommands'
import type { NativeWysiwygAttachmentPayload, NativeWysiwygInlineAutocomplete, NativeWysiwygInlineAutocompleteKind, NativeWysiwygMarkdownBlockPayload, NativeWysiwygPlainTextPayload, NativeWysiwygSelection, NativeWysiwygWikilinkPayload } from './MobileWysiwygWikilinkBridgeModel'
import type { useNativeTentapEditorRuntime } from './useMobileNativeEditorRuntime'

export type MobileWysiwygMarkdownEditorProps = {
  blocks: MobileEditorBlock[]
  bullets: string[]
  compact: boolean
  layoutProbe?: MobileLayoutProbe
  note: MobileNote
  notes: MobileNote[]
  onNavigateWikilink?: (target: string) => void
  onImportAttachment?: () => Promise<NativeWysiwygAttachmentPayload | null>
  onOpenLink?: (href: string) => void
  onRegisterEditorCommands?: RegisterMobileEditorCommands
  onTableOfContentsScrollProof?: (proof: NativeTableOfContentsProof) => void
  onUpdateContent: (noteId: string, content: string) => void
  tableOfContentsTarget?: MobileTableOfContentsTarget | null
  vaultRootUri?: string | null
  typeDefinitions: MobileTypeDefinitions | null | undefined
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

export type EditorStateReadableBridge = EditorBridge & {
  getEditorState: () => {
    activeLink?: unknown
    canSetLink?: unknown
    isLinkActive?: unknown
    selection?: {
      from?: unknown
      to?: unknown
    }
  }
}

export type NativeWysiwygEditorState = ReturnType<EditorStateReadableBridge['getEditorState']>

export type MathBlockRenderableEditorBridge = EditorBridge & {
  getMathBlockRenderProof: () => Promise<boolean>
}

export type TimerHandle = ReturnType<typeof setTimeout>

export type NativeTentapEditorBridgeOptions = Omit<MobileWysiwygMarkdownEditorProps, 'notes' | 'typeDefinitions'> & {
  initialDocumentContent: string
  onInitialContentSyncFailure?: () => void
  onInlineAutocomplete: NativeWysiwygInlineAutocompleteHandler
}

export type NativeTentapEditorRuntime = ReturnType<typeof useNativeTentapEditorRuntime>

export type NativeTentapEditorSurfaceProps = {
  vaultRootUri?: string | null
  previewMarkdown: string
  activateEditorChanges: () => void
  editor: EditorBridge
  externalLinkState: NativeWysiwygExternalLinkSheetState | null
  flushEditorDocument: () => void
  injectEditorCss: () => void
  insertWikilink: (payload: NativeWysiwygWikilinkPayload, selection?: NativeWysiwygSelection) => void
  insertAttachment: (payload: NativeWysiwygAttachmentPayload, selection?: NativeWysiwygSelection) => void
  insertMarkdownBlock: (payload: NativeWysiwygMarkdownBlockPayload, selection?: NativeWysiwygSelection) => void
  insertPlainText: (payload: NativeWysiwygPlainTextPayload, selection?: NativeWysiwygSelection) => void
  layoutProbe?: MobileLayoutProbe
  notes: MobileNote[]
  onCloseExternalLinkSheet: () => void
  onCloseWikilinkPicker: () => void
  onImportAttachment?: () => Promise<NativeWysiwygAttachmentPayload | null>
  onOpenExternalLinkSheet: () => void
  onOpenToolbarWikilinkPicker: () => void
  onRegisterEditorCommands?: RegisterMobileEditorCommands
  pickerState: NativeWysiwygPickerState | null
  sourceNote: MobileNote
  typeDefinitions: MobileTypeDefinitions | null | undefined
}

export type NativeWysiwygExternalLinkSheetState = {
  initialUrl: string
  selection?: NativeWysiwygSelection
}

export type NativeTentapEditorSurfaceActionProps = Pick<
  NativeTentapEditorSurfaceProps,
  | 'editor'
  | 'externalLinkState'
  | 'flushEditorDocument'
  | 'insertAttachment'
  | 'insertMarkdownBlock'
  | 'insertPlainText'
  | 'insertWikilink'
  | 'onCloseExternalLinkSheet'
  | 'onCloseWikilinkPicker'
  | 'onImportAttachment'
  | 'onOpenExternalLinkSheet'
  | 'onOpenToolbarWikilinkPicker'
  | 'pickerState'
>

export type NativeTentapEditorSurfaceActions = {
  handleApplyExternalLink: (url: string) => void
  handleFormat: (action: Parameters<typeof applyNativeWysiwygFormat>[1]) => Promise<void>
  handleInsertEmoji: (payload: NativeWysiwygPlainTextPayload) => void
  handleInsertWikilink: (payload: NativeWysiwygWikilinkPayload) => void
  handlePastePlainText: () => void
  handleRemoveExternalLink: () => void
}

export type NativeWysiwygInlineAutocompleteHandler = (match: NativeWysiwygInlineAutocomplete | null) => void

export type NativeWysiwygPickerState = {
  kind: NativeWysiwygInlineAutocompleteKind
  query: string
  replacementRange?: NativeWysiwygSelection
  source: 'inline' | 'toolbar'
}

export type NativeWysiwygDocumentBuilder<Payload> = (request: {
  json: unknown
  payload: Payload
  selection?: NativeWysiwygSelection
}) => unknown | null

export type NativeWysiwygEditorMutation<Payload> = (
  editor: EditorBridge | null,
  payload: Payload,
  selection?: NativeWysiwygSelection,
) => Promise<boolean>

export type SelectionSettableEditorBridge = EditorBridge & {
  setSelection: (from: number, to: number) => void
}
