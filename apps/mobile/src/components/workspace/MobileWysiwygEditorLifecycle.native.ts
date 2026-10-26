import type { EditorBridge } from '@10play/tentap-editor'
import { type MutableRefObject, useCallback, useContext, useEffect, useRef } from 'react'
import { mobileNoteEditableContent } from '../../workspace/mobileDocumentContent'
import type { MobileEditorBlock, MobileNote } from '../../workspace/mobileWorkspaceModel'
import { injectMobileEditorAppearance, useEditorAppearance } from './useEditorAppearance'
import { WorkspaceSyncEditorsContext } from '../../workspace/workspaceSyncEditors'
import type { createMobileEditorDocumentBridge } from './MobileWysiwygDocumentReads.native'
import { beginNativeInitialContentSync, recoverUntouchedEditorAfterInitialSyncFailure, scheduleNativeCreatedNoteFocus, type NativeInitialContentSync } from './nativeInitialContentSync'

type TimerHandle = ReturnType<typeof setTimeout>

export type NativeTentapEditorRefs = {
  documentReads: ReturnType<typeof createMobileEditorDocumentBridge>
  acceptsEditorChangesRef: MutableRefObject<boolean>
  contentRef: MutableRefObject<string>
  editorRef: MutableRefObject<EditorBridge | null>
  firstEditorSerializationRef: MutableRefObject<boolean>
  hasAcceptedEditorChangeRef: MutableRefObject<boolean>
  initialContentSyncRef: MutableRefObject<NativeInitialContentSync | null>
  inlineAutocompleteTimerRef: MutableRefObject<TimerHandle | null>
  markdownBlockProofReadyRef: MutableRefObject<boolean>
  markdownBlockRenderProofRef: MutableRefObject<boolean>
  saveTimerRef: MutableRefObject<TimerHandle | null>
  tableCommandMutationProofReadyRef: MutableRefObject<boolean>
  webViewLoadedRef: MutableRefObject<boolean>
}

type ContentSettableEditorBridge = EditorBridge & {
  setContent: (content: unknown) => void
}

type SilentContentSettableEditorBridge = EditorBridge & {
  setContentSilently: (content: string) => void
}

export function useEditorCssInjection({
  compact,
  initialContent,
  noteWidth,
  refs,
}: {
  compact: boolean
  initialContent: string
  noteWidth: MobileNote['noteWidth']
  refs: NativeTentapEditorRefs
}) {
  const { editorRef, webViewLoadedRef } = refs
  const css = useEditorAppearance({ compact, noteWidth, editorRef })

  return useCallback(() => {
    webViewLoadedRef.current = true
    injectMobileEditorAppearance(editorRef.current, css)
    syncNativeInitialEditorContent(initialContent, refs)
  }, [css, editorRef, initialContent, refs, webViewLoadedRef])
}

export function useEditorBridgeRef(editorRef: MutableRefObject<EditorBridge | null>, editor: EditorBridge) {
  useEffect(() => {
    editorRef.current = editor
  }, [editor, editorRef])
}

export function useEditableContentRef({
  blocks,
  bullets,
  note,
  refs,
}: {
  blocks: MobileEditorBlock[]
  bullets: string[]
  note: MobileNote
  refs: NativeTentapEditorRefs
}) {
  const { contentRef } = refs

  useEffect(() => {
    contentRef.current = mobileNoteEditableContent({
      ...note,
      editorBlocks: note.editorBlocks ?? blocks,
      editorBullets: bullets,
    })
  }, [blocks, bullets, contentRef, note])
}

export function useResetEditorChangeGate({ noteId, refs }: { noteId: string; refs: NativeTentapEditorRefs }) {
  useEffect(() => resetEditorChangeGate(noteId, refs), [noteId, refs])
}

export function useSyncInitialEditorContent({
  initialContent,
  noteId,
  onInitialContentSyncFailure,
  refs,
}: {
  initialContent: string
  noteId: string
  onInitialContentSyncFailure?: () => void
  refs: NativeTentapEditorRefs
}) {
  const syncedContentRef = useRef<{ content: string; noteId: string } | null>(null)
  const editors = useContext(WorkspaceSyncEditorsContext)

  useEffect(() => {
    syncInitialEditorContent({
      initialContent,
      noteId,
      onInitialContentSyncFailure,
      refs,
      syncedContentRef,
    })
  }, [initialContent, noteId, onInitialContentSyncFailure, refs])
  useEffect(() => {
    if (!editors) return
    return scheduleNativeCreatedNoteFocus({
      requests: editors.focus,
      noteId,
      isBlocked: () => editors.isBlocked(),
      wasInteracted: () => refs.acceptsEditorChangesRef.current,
      isReady: () => nativeInitialContentReady(refs),
      focus: () => { activateNativeEditorChanges(refs); refs.editorRef.current?.focus('start') },
    })
  }, [editors, noteId, refs])
}

export function nativeInitialContentReady(refs: NativeTentapEditorRefs) {
  return refs.webViewLoadedRef.current && refs.documentReads.isReady()
    && refs.initialContentSyncRef.current?.isReady() === true
}

export function useFlushOnUnmount(refs: NativeTentapEditorRefs, flushEditorDocument: () => void) {
  useEffect(() => {
    refs.documentReads.requests.activate()
    return () => {
      cancelNativeInitialContentSync(refs)
      clearTimer(refs.inlineAutocompleteTimerRef.current)
      clearTimer(refs.saveTimerRef.current)
      if (refs.hasAcceptedEditorChangeRef.current) flushEditorDocument()
      refs.documentReads.requests.retire()
    }
  }, [flushEditorDocument, refs])
}

export function retireNativeEditorSession(refs: NativeTentapEditorRefs) {
  cancelNativeInitialContentSync(refs)
  clearTimer(refs.inlineAutocompleteTimerRef.current)
  clearTimer(refs.saveTimerRef.current)
  refs.acceptsEditorChangesRef.current = false
  refs.hasAcceptedEditorChangeRef.current = false
  refs.webViewLoadedRef.current = false
  refs.editorRef.current = null
  refs.documentReads.requests.dispose()
}

export function isContentSettableEditorBridge(editor: EditorBridge | null): editor is ContentSettableEditorBridge {
  return typeof (editor as Partial<ContentSettableEditorBridge> | null)?.setContent === 'function'
}

function syncNativeInitialEditorContent(initialContent: string, refs: NativeTentapEditorRefs, onInitialContentSyncFailure?: () => void) {
  if (!canSyncInitialContent(refs)) return
  cancelNativeInitialContentSync(refs)
  refs.acceptsEditorChangesRef.current = false
  refs.initialContentSyncRef.current = beginNativeInitialContentSync({
    content: initialContent,
    isReady: refs.documentReads.isReady,
    editor: () => {
      const editor = refs.editorRef.current
      return isSilentContentSettableEditorBridge(editor) ? editor : null
    },
    shouldSync: () => canSyncInitialContent(refs),
    onError: () => {
      console.warn('[mobile-editor] Initial content acknowledgement failed')
      recoverUntouchedEditorAfterInitialSyncFailure({
        hasInteracted: refs.acceptsEditorChangesRef.current,
        hasAcceptedChanges: refs.hasAcceptedEditorChangeRef.current,
        recover: onInitialContentSyncFailure,
      })
    },
  })
}

export function setNativeEditorContentSilently(editor: EditorBridge | null, content: string): boolean {
  if (!isSilentContentSettableEditorBridge(editor)) return false
  editor.setContentSilently(content)
  return true
}

export function activateNativeEditorChanges(refs: NativeTentapEditorRefs) {
  refs.acceptsEditorChangesRef.current = true
}

export function canSyncInitialContent(refs: NativeTentapEditorRefs) {
  return !refs.hasAcceptedEditorChangeRef.current
}

function cancelNativeInitialContentSync(refs: NativeTentapEditorRefs) {
  refs.initialContentSyncRef.current?.cancel()
  refs.initialContentSyncRef.current = null
}

function clearTimer(timer: TimerHandle | null) {
  if (timer) clearTimeout(timer)
}

function resetEditorChangeGate(_noteId: string, refs: NativeTentapEditorRefs) {
  cancelNativeInitialContentSync(refs)
  refs.documentReads.requests.activate()
  refs.webViewLoadedRef.current = false
  refs.acceptsEditorChangesRef.current = false
  refs.firstEditorSerializationRef.current = true
  refs.hasAcceptedEditorChangeRef.current = false
  refs.markdownBlockProofReadyRef.current = false
  refs.markdownBlockRenderProofRef.current = false
  refs.tableCommandMutationProofReadyRef.current = false
}

function syncInitialEditorContent({
  initialContent,
  noteId,
  onInitialContentSyncFailure,
  refs,
  syncedContentRef,
}: {
  initialContent: string
  noteId: string
  onInitialContentSyncFailure?: () => void
  refs: NativeTentapEditorRefs
  syncedContentRef: MutableRefObject<{
    content: string
    noteId: string
  } | null>
}) {
  if (!shouldSyncInitialContent(initialContent, noteId, refs, syncedContentRef.current)) return

  clearTimer(refs.saveTimerRef.current)
  refs.firstEditorSerializationRef.current = true
  syncNativeInitialEditorContent(initialContent, refs, onInitialContentSyncFailure)
  syncedContentRef.current = { content: initialContent, noteId }
}

function shouldSyncInitialContent(
  initialContent: string,
  noteId: string,
  refs: NativeTentapEditorRefs,
  syncedContent: { content: string; noteId: string } | null,
) {
  if (!isContentSettableEditorBridge(refs.editorRef.current)) return false
  if (syncedContent?.noteId === noteId && syncedContent.content === initialContent && refs.initialContentSyncRef.current) return false
  return canSyncInitialContent(refs)
}

function isSilentContentSettableEditorBridge(
  editor: EditorBridge | null,
): editor is SilentContentSettableEditorBridge {
  return editor !== null
    && 'setContentSilently' in editor
    && typeof editor.setContentSilently === 'function'
}
