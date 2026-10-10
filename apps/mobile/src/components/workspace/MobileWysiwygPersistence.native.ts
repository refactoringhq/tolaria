import type { EditorBridge } from '@10play/tentap-editor'
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import {
  nativeWysiwygExternalLinkLogLine,
  nativeWysiwygExternalLinkProof,
} from '../../qa/nativeWysiwygExternalLinkProbe'
import {
  nativeWysiwygMarkdownBlockStructuredCodeBlock,
  nativeWysiwygMarkdownBlockStructuredTable,
  publishNativeWysiwygMarkdownBlockProof,
} from '../../qa/nativeWysiwygMarkdownBlockProbe'
import {
  nativeWysiwygWikilinkInsertLogLine,
  nativeWysiwygWikilinkInsertProof,
} from '../../qa/nativeWysiwygWikilinkInsertProbe'
import {
  nativeWysiwygDocumentContentFromJson,
  nativeWysiwygShouldPublishMutationProof,
} from './MobileWysiwygDocumentSerialization'
import type { NativeTentapEditorRefs } from './MobileWysiwygEditorLifecycle.native'
import { publishNativeWysiwygMutationProof } from './MobileWysiwygMutationProbe.native'
import { publishNativeWysiwygTableCommandMutationProof } from './MobileWysiwygTableCommandMutationProbe.native'
import { createEditorSaveGate } from '../../workspace/editorSaveGate'
import { useWorkspaceSyncEditor } from '../../workspace/workspaceSyncEditors'

type JsonReadableEditorBridge = EditorBridge & {
  getJSON: () => Promise<unknown>
}

type FlushEditorDocumentOptions = {
  externalLinkProbeEnabled: boolean
  initialBodyHasContent: boolean
  markdownBlockProbeEnabled: boolean
  mutationProbeEnabled: boolean
  noteId: string
  onUpdateContent: (noteId: string, content: string) => void
  refs: NativeTentapEditorRefs
  tableCommandMutationProbeEnabled: boolean
  vaultRootUri?: string | null
  wikilinkInsertProbeEnabled: boolean
}

export function useFlushEditorDocument(options: FlushEditorDocumentOptions) {
  const [gate] = useState(() => createEditorSaveGate(nativeEditorDocumentAdapter(options)))
  useEffect(() => { gate.updateAdapter(nativeEditorDocumentAdapter(options)) }, [gate, options])
  useWorkspaceSyncEditor(gate.prepare, options.noteId)
  return useCallback(() => {
    void gate.save().catch((error: unknown) => {
      console.warn('[mobile-editor] Failed to read TenTap JSON:', error)
    })
  }, [gate])
}

function nativeEditorDocumentAdapter(options: FlushEditorDocumentOptions) {
  return {
    read: async () => ({ json: await readEditorJson(options), options }),
    commit: (document: { json: unknown; options: FlushEditorDocumentOptions }) => writeEditorJsonToMarkdown(document.options, document.json),
    setEditable: (editable: boolean) => {
      const editor = options.refs.editorRef.current
      editor?.setEditable(editable)
      if (!editable) editor?.blur()
    },
  }
}

async function readEditorJson(options: FlushEditorDocumentOptions) {
  const editor = options.refs.editorRef.current
  if (!isJsonReadableEditorBridge(editor)) throw new Error('editorNotReady')

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      editor.getJSON(),
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('editorReadTimedOut')), 10_000) }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

function writeEditorJsonToMarkdown(options: FlushEditorDocumentOptions, json: unknown) {
  const nextContent = nativeWysiwygDocumentContentFromJson({
    currentContent: options.refs.contentRef.current,
    initialBodyHasContent: options.initialBodyHasContent,
    isFirstSerialization: options.refs.firstEditorSerializationRef.current,
    json,
    vaultRootUri: options.vaultRootUri,
  })
  options.refs.firstEditorSerializationRef.current = false
  publishContentChange(options, json, nextContent)
  publishMutationProof(options, json, nextContent)
  publishTableMutationProof(options, json, nextContent)
}

function publishContentChange(
  options: FlushEditorDocumentOptions,
  json: unknown,
  nextContent: { content: string; skipped: boolean },
) {
  if (nextContent.skipped || nextContent.content === options.refs.contentRef.current) return

  options.onUpdateContent(options.noteId, nextContent.content)
  if (shouldPublishMarkdownBlockProof(options)) {
    publishNativeWysiwygMarkdownBlockProof({
      codeBlockStructured: nativeWysiwygMarkdownBlockStructuredCodeBlock(json),
      content: nextContent.content,
      mathBlockRendered: options.refs.markdownBlockRenderProofRef.current,
      noteId: options.noteId,
      tableStructured: nativeWysiwygMarkdownBlockStructuredTable(json),
    })
  }
  if (options.wikilinkInsertProbeEnabled) publishWikilinkProof(options.noteId, nextContent.content)
  if (options.externalLinkProbeEnabled) publishExternalLinkProof(options.noteId, nextContent.content)
}

function publishMutationProof(
  options: FlushEditorDocumentOptions,
  json: unknown,
  nextContent: { content: string; skipped: boolean },
) {
  if (
    !nativeWysiwygShouldPublishMutationProof({
      mutationProbeEnabled: options.mutationProbeEnabled,
      skipped: nextContent.skipped,
    })
  )
    return

  publishNativeWysiwygMutationProof(options.noteId, nextContent.content, json)
}

function publishTableMutationProof(
  options: FlushEditorDocumentOptions,
  json: unknown,
  nextContent: { content: string; skipped: boolean },
) {
  if (nextContent.skipped || !shouldPublishTableCommandMutationProof(options)) return

  publishNativeWysiwygTableCommandMutationProof({
    content: nextContent.content,
    json,
    noteId: options.noteId,
  })
}

function shouldPublishMarkdownBlockProof(options: FlushEditorDocumentOptions) {
  return options.markdownBlockProbeEnabled && options.refs.markdownBlockProofReadyRef.current && Platform.OS !== 'web'
}

function shouldPublishTableCommandMutationProof(options: FlushEditorDocumentOptions) {
  return (
    options.tableCommandMutationProbeEnabled &&
    options.refs.tableCommandMutationProofReadyRef.current &&
    Platform.OS !== 'web'
  )
}

function publishWikilinkProof(noteId: string, content: string) {
  publishNativeProof(() => nativeWysiwygWikilinkInsertLogLine(nativeWysiwygWikilinkInsertProof({ content, noteId })))
}

function publishExternalLinkProof(noteId: string, content: string) {
  publishNativeProof(() => nativeWysiwygExternalLinkLogLine(nativeWysiwygExternalLinkProof({ content, noteId })))
}

function publishNativeProof(logLine: () => string) {
  if (Platform.OS !== 'web') console.info(logLine())
}

function isJsonReadableEditorBridge(editor: EditorBridge | null): editor is JsonReadableEditorBridge {
  return typeof (editor as Partial<JsonReadableEditorBridge> | null)?.getJSON === 'function'
}
