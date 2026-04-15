import { useRef, useLayoutEffect, useCallback, useState } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import { useRawMode } from '../hooks/useRawMode'
import { clearTableResizeState } from './tableResizeState'
import {
  buildCodeMirrorRestoreState,
  captureRawCodeMirrorRestoreState,
  captureRawEditorPositionSnapshot,
  captureRichEditorPositionSnapshot,
  type CodeMirrorRestoreState,
  type RawEditorPositionSnapshot,
} from './editorModePosition'
import {
  type PendingRawExitContent,
  buildPendingRawExitContent,
  rememberPendingRawExitContent,
  syncActiveTabIntoRawBuffer,
} from './editorRawModeSync'
import { useEditorModePositionSync } from './useEditorModePositionSync'

interface PendingRoundTripRawRestore {
  path: string
  state: CodeMirrorRestoreState
}

function getRoundTripRawRestore({
  activeTabPath,
  pendingRoundTripRawRestore,
}: {
  activeTabPath: string | null
  pendingRoundTripRawRestore: PendingRoundTripRawRestore | null
}) {
  if (!activeTabPath) return null
  return pendingRoundTripRawRestore?.path === activeTabPath
    ? pendingRoundTripRawRestore.state
    : null
}

function buildPendingRawRestore({
  activeTabContent,
  activeTabPath,
  editor,
  pendingRoundTripRawRestore,
  syncedContent,
}: {
  activeTabContent: string | null
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  pendingRoundTripRawRestore: PendingRoundTripRawRestore | null
  syncedContent: string | null
}) {
  const roundTripRestore = getRoundTripRawRestore({
    activeTabPath,
    pendingRoundTripRawRestore,
  })
  if (roundTripRestore) return roundTripRestore

  const nextContent = syncedContent ?? activeTabContent
  if (!nextContent) return null

  const richSnapshot = captureRichEditorPositionSnapshot(editor, document)
  return richSnapshot
    ? buildCodeMirrorRestoreState(editor, nextContent, richSnapshot)
    : null
}

function capturePendingRoundTripRawRestore(activeTabPath: string | null): PendingRoundTripRawRestore | null {
  if (!activeTabPath) return null

  const rawRestoreState = captureRawCodeMirrorRestoreState(document)
  return rawRestoreState
    ? { path: activeTabPath, state: rawRestoreState }
    : null
}

function useTrackRawBuffer({
  activeTabContent,
  activeTabPath,
  rawBufferPathRef,
  rawLatestContentRef,
}: {
  activeTabContent: string | null
  activeTabPath: string | null
  rawBufferPathRef: React.MutableRefObject<string | null>
  rawLatestContentRef: React.MutableRefObject<string | null>
}) {
  useLayoutEffect(() => {
    if (!activeTabPath) {
      rawLatestContentRef.current = null
      rawBufferPathRef.current = null
      return
    }

    if (rawBufferPathRef.current === activeTabPath) {
      return
    }

    rawLatestContentRef.current = activeTabContent
    rawBufferPathRef.current = activeTabContent === null ? null : activeTabPath
  }, [activeTabContent, activeTabPath, rawBufferPathRef, rawLatestContentRef])
}

function resetRawBufferState({
  rawBufferPathRef,
  rawLatestContentRef,
}: {
  rawBufferPathRef: React.MutableRefObject<string | null>
  rawLatestContentRef: React.MutableRefObject<string | null>
}) {
  rawBufferPathRef.current = null
  rawLatestContentRef.current = null
}

export function useRawModeWithFlush(
  editor: ReturnType<typeof useCreateBlockNote>,
  activeTabPath: string | null,
  activeTabContent: string | null,
  onContentChange?: (path: string, content: string) => void,
) {
  const rawLatestContentRef = useRef<string | null>(null)
  const rawBufferPathRef = useRef<string | null>(null)
  const pendingRawRestoreRef = useRef<CodeMirrorRestoreState | null>(null)
  const pendingRichRestoreRef = useRef<RawEditorPositionSnapshot | null>(null)
  const pendingRoundTripRawRestoreRef = useRef<PendingRoundTripRawRestore | null>(null)
  const [pendingRawExitContent, setPendingRawExitContent] = useState<PendingRawExitContent | null>(null)
  const [rawModeContentOverride, setRawModeContentOverride] = useState<PendingRawExitContent | null>(null)
  useTrackRawBuffer({ activeTabContent, activeTabPath, rawBufferPathRef, rawLatestContentRef })

  const handleFlushPending = useCallback(async () => {
    const syncedContent = syncActiveTabIntoRawBuffer({
      editor,
      activeTabPath,
      activeTabContent,
      rawLatestContentRef,
      onContentChange,
    })
    pendingRawRestoreRef.current = buildPendingRawRestore({
      activeTabContent,
      activeTabPath,
      editor,
      pendingRoundTripRawRestore: pendingRoundTripRawRestoreRef.current,
      syncedContent,
    })
    pendingRoundTripRawRestoreRef.current = null
    setRawModeContentOverride(buildPendingRawExitContent(activeTabPath, syncedContent))
    clearTableResizeState(editor)
    return true
  }, [activeTabContent, activeTabPath, editor, onContentChange])

  const handleBeforeRawEnd = useCallback(() => {
    pendingRoundTripRawRestoreRef.current = capturePendingRoundTripRawRestore(activeTabPath)
    pendingRichRestoreRef.current = captureRawEditorPositionSnapshot(document)
    pendingRawRestoreRef.current = null
    setPendingRawExitContent(rememberPendingRawExitContent({
      activeTabPath,
      rawLatestContentRef,
      onContentChange,
    }))
    setRawModeContentOverride(null)
    resetRawBufferState({ rawBufferPathRef, rawLatestContentRef })
  }, [activeTabPath, onContentChange])

  const { rawMode, handleToggleRaw } = useRawMode({
    activeTabPath,
    onFlushPending: handleFlushPending,
    onBeforeRawEnd: handleBeforeRawEnd,
  })
  useEditorModePositionSync({
    activeTabPath,
    editor,
    pendingRawRestoreRef,
    pendingRoundTripRawRestoreRef,
    pendingRichRestoreRef,
    rawMode,
  })

  return { rawMode, handleToggleRaw, rawLatestContentRef, pendingRawExitContent, setPendingRawExitContent, rawModeContentOverride }
}
