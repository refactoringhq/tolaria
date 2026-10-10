import { useEffect, type MutableRefObject } from 'react'
import type { EditorBridge } from '@10play/tentap-editor'
import { logNativeQaProof } from '../../qa/nativeQaSink'
import {
  nativeWysiwygMutationLogLine,
  nativeWysiwygMutationProbeContent,
  nativeWysiwygMutationProof,
} from '../../qa/nativeWysiwygMutationProbe'

type TimerHandle = ReturnType<typeof setTimeout>

type ContentSettableEditorBridge = EditorBridge & {
  setContent: (content: unknown) => void
}

export type NativeWysiwygMutationProbeRefs = {
  acceptsEditorChangesRef: MutableRefObject<boolean>
  editorRef: MutableRefObject<EditorBridge | null>
  hasAcceptedEditorChangeRef: MutableRefObject<boolean>
  saveTimerRef: MutableRefObject<TimerHandle | null>
}

const mutationProbeInitialDelayMs = 1500
const mutationProbeRetryDelayMs = 250
const mutationProbeSaveDelayMs = 500

export function useNativeWysiwygMutationProbe({
  enabled,
  flushEditorDocument,
  refs,
  vaultRootUri,
}: {
  enabled: boolean
  flushEditorDocument: () => void
  refs: NativeWysiwygMutationProbeRefs
  vaultRootUri?: string | null
}) {
  useEffect(() => {
    if (!enabled) return undefined

    let contentTimer: TimerHandle | null = null
    let disposed = false

    const scheduleProbe = (delayMs: number) => {
      contentTimer = setTimeout(runProbe, delayMs)
    }
    const runProbe = () => {
      if (disposed) return
      enableNativeWysiwygMutationProbe(refs)

      const editor = refs.editorRef.current
      if (!isContentSettableEditorBridge(editor) || !editor.getEditorState().isReady) {
        scheduleProbe(mutationProbeRetryDelayMs)
        return
      }

      refs.hasAcceptedEditorChangeRef.current = true
      editor.setContent(nativeWysiwygMutationProbeContent(vaultRootUri))
      if (refs.saveTimerRef.current) clearTimeout(refs.saveTimerRef.current)
      refs.saveTimerRef.current = setTimeout(flushEditorDocument, mutationProbeSaveDelayMs)
    }

    scheduleProbe(mutationProbeInitialDelayMs)

    return () => {
      disposed = true
      if (contentTimer) clearTimeout(contentTimer)
      if (refs.saveTimerRef.current) clearTimeout(refs.saveTimerRef.current)
    }
  }, [enabled, flushEditorDocument, refs, vaultRootUri])
}

export function enableNativeWysiwygMutationProbe(refs: NativeWysiwygMutationProbeRefs): void {
  refs.acceptsEditorChangesRef.current = true
}

export function publishNativeWysiwygMutationProof(noteId: string, content: string, json?: unknown): void {
  logNativeQaProof(nativeWysiwygMutationLogLine(nativeWysiwygMutationProof({ content, json, noteId })))
}

function isContentSettableEditorBridge(editor: EditorBridge | null): editor is ContentSettableEditorBridge {
  return typeof (editor as Partial<ContentSettableEditorBridge> | null)?.setContent === 'function'
}
