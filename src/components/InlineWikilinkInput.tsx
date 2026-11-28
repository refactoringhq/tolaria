import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { buildTypeEntryMap } from '../utils/typeColors'
import { deleteInlineSelection, replaceInlineSelection, selectedInlineText } from './inlineWikilinkEdits'
import {
  buildInlineWikilinkSegments,
  extractInlineWikilinkReferences,
  findActiveWikilinkQuery,
} from './inlineWikilinkText'
import { extractDroppedPathText, formatDroppedPathList } from './inlineWikilinkDropText'
import { readSelectionRange, serializeInlineNode, type InlineSelectionRange } from './inlineWikilinkDom'
import {
  buildPendingPasteState,
  type PendingPasteState,
  shouldRecoverPendingPaste,
} from './inlineWikilinkPasteRecovery'
import { InlineWikilinkEditorField, InlineWikilinkPaletteLayout } from './InlineWikilinkParts'
import { InlineWikilinkSuggestionMenu } from './InlineWikilinkSuggestionMenu'
import { handleInlineWikilinkKeyDown } from './inlineWikilinkKeydown'
import { useInlineWikilinkSelection } from './useInlineWikilinkSelection'
import { useInlineWikilinkSuggestionsState } from './useInlineWikilinkSuggestionsState'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'
import { isInsertBeforeInput, isPlainTextBeforeInput } from './inlineWikilinkBeforeInput'
import {
  collapseSelectionRange,
  fullSelectionRange,
  isCommandBackspaceShortcut,
  isCompositionKeyboardEvent,
  isLineBreakShortcut,
  isNativeCompositionBeforeInput,
  isSelectAllShortcut,
  isWindowsRuntime,
} from './inlineWikilinkInputEvents'
import {
  commitEditorValueBeforeSubmit,
  publishEditorValue,
  recordImeKeyDownSignal,
  shieldNativeBeforeInput,
  submitEditorValue,
  useCanonicalRemountGuard,
  usePostCompositionTextInputSettle,
  useRenderedEditorValue,
  useShieldedBeforeInput,
} from './inlineWikilinkComposition'
import {
  containsUnsupportedInlineContent,
  deleteToLineStart,
  hasUnsupportedClipboardPayload,
} from './inlineWikilinkInputOperations'
import { restorePendingRemountState } from './inlineWikilinkRemountState'
import { useNativePathDrop } from './useNativePathDrop'

interface InlineWikilinkInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSubmit?: (text: string, references: NoteReference[]) => void
  onUnsupportedPaste?: (message: string) => void
  submitOnEmpty?: boolean
  disabled?: boolean
  placeholder?: string
  placeholderClassName?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  dataTestId?: string
  editorClassName?: string
  editorStyle?: CSSProperties
  suggestionListVariant?: 'floating' | 'palette'
  suggestionEmptyLabel?: string
  paletteHeader?: ReactNode
  paletteEmptyState?: ReactNode
  paletteFooter?: ReactNode
}

export const UNSUPPORTED_INLINE_PASTE_MESSAGE = 'Only text paste is supported in the AI composer right now.'
export function InlineWikilinkInput(options: InlineWikilinkInputProps) {
  const {
    entries,
    value,
    onChange,
    onSubmit,
    onUnsupportedPaste,
    submitOnEmpty = false,
    disabled = false,
    placeholder,
    placeholderClassName,
    inputRef,
    dataTestId = 'agent-input',
    editorClassName,
    editorStyle,
    suggestionListVariant = 'floating',
    suggestionEmptyLabel = 'No matching notes',
    paletteHeader,
    paletteEmptyState,
    paletteFooter,
  } = options
  const { lastPublishedValueRef, pendingCompositionInputRef, publishValue, renderState, remountWith, suppressEchoRemountRef } =
    useRenderedEditorValue(value, onChange)
  const renderVersion = renderState.version
  const isComposingRef = useRef(false)
  const lastImeKeyDownAtRef = useRef<number | null>(null)
  // performance.now() twin of lastImeKeyDownAtRef: event.timeStamp is only
  // comparable with other event timeStamps, not with performance.now().
  const lastImeKeyDownPerfAtRef = useRef<number | null>(null)
  const segments = useMemo(() => buildInlineWikilinkSegments(value, entries), [entries, value])
  const renderedSegments = useMemo(
    () => buildInlineWikilinkSegments(renderState.value, entries),
    [entries, renderState.value],
  )
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const {
    editorRef,
    selectionRange,
    selectionIndex,
    setSelectionRange,
    setCombinedRef,
    syncSelectionRange,
    focusSelectionRange,
  } = useInlineWikilinkSelection({
    value,
    onChange: publishValue,
    inputRef,
    isComposingRef,
  })
  const pendingPasteRef = useRef<PendingPasteState | null>(null)
  const handledFileDropRef = useRef(false)
  const pendingFocusAfterRemountRef = useRef<InlineSelectionRange | null>(null)
  const pendingScrollTopAfterRemountRef = useRef<number | null>(null)
  const {
    clearCompositionSettleWindow,
    hasPendingCompositionFlush,
    isSettlingCompositionRef,
    startCompositionSettleWindow,
  } = usePostCompositionTextInputSettle()
  useLayoutEffect(() => {
    void renderVersion
    restorePendingRemountState(
      editorRef.current,
      focusSelectionRange,
      pendingFocusAfterRemountRef,
      pendingScrollTopAfterRemountRef,
    )
  }, [editorRef, focusSelectionRange, renderVersion])
  useCanonicalRemountGuard({
    editorRef,
    isComposingRef,
    lastPublishedValueRef,
    remountWith,
    pendingFocusAfterRemountRef,
    renderedValue: renderState.value,
    selectionRange,
    suppressEchoRemountRef,
    value,
  })
  const activeQuery = useMemo(
    () => (selectionRange.start === selectionRange.end ? findActiveWikilinkQuery(value, selectionIndex) : null),
    [selectionIndex, selectionRange.end, selectionRange.start, value],
  )
  const references = useMemo(() => extractInlineWikilinkReferences(value, entries), [entries, value])
  const { suggestions, selectedSuggestionIndex, setSuggestionIndex, selectSuggestion, cycleSuggestions } =
    useInlineWikilinkSuggestionsState({
      activeQueryKey: activeQuery ? `${activeQuery.start}:${activeQuery.query}` : '',
      entries,
      query: activeQuery?.query ?? null,
      value,
      selectionIndex,
      onChange: publishValue,
      onSelectionIndexChange: (nextSelectionIndex) => setSelectionRange(collapseSelectionRange(nextSelectionIndex)),
      focusSelectionAt: (nextSelectionIndex) => focusSelectionRange(collapseSelectionRange(nextSelectionIndex)),
    })
  // A pick is an explicit user action outside the IME pipeline, so it always
  // commits canonically instead of leaning on the (Windows-suppressed) guard.
  const selectSuggestionAndRemount = (index: number) => {
    selectSuggestion(index)
    remountWith(lastPublishedValueRef.current)
  }
  const commitCanonicalEdit = useCallback(
    (nextState: { selection: InlineSelectionRange; value: string }, shouldFocus = true) => {
      publishValue(nextState.value)
      setSelectionRange(nextState.selection)
      pendingFocusAfterRemountRef.current = shouldFocus
        ? nextState.selection
        : null
      remountWith(nextState.value)
    },
    [publishValue, remountWith, setSelectionRange],
  )
  const insertTransferText = useCallback(
    (text: string, focusAfterInsert = false) => {
      const editor = editorRef.current
      const currentSelectionRange = editor && !focusAfterInsert ? readSelectionRange(editor) : selectionRange
      const nextState = replaceInlineSelection(value, currentSelectionRange, text)
      const shouldRestoreFocus = focusAfterInsert || document.activeElement === editor

      pendingScrollTopAfterRemountRef.current = editor?.scrollTop ?? null
      commitCanonicalEdit(nextState, shouldRestoreFocus)
    },
    [commitCanonicalEdit, editorRef, selectionRange, value],
  )
  useNativePathDrop({
    targetRef: editorRef,
    disabled,
    onPathDrop: (paths) => {
      const droppedPathText = formatDroppedPathList(paths)
      if (droppedPathText) insertTransferText(droppedPathText, true)
    },
  })
  const notifyUnsupportedPaste = useCallback(
    () => onUnsupportedPaste?.(UNSUPPORTED_INLINE_PASTE_MESSAGE),
    [onUnsupportedPaste],
  )
  const recoverUnsupportedMutation = () => {
    pendingCompositionInputRef.current = false
    pendingPasteRef.current = null
    notifyUnsupportedPaste()
    remountWith(value)
    setSelectionRange({ ...selectionRange })
  }
  const editorPublishCallbacks = {
    onChange: publishValue,
    onUnsupportedMutation: recoverUnsupportedMutation,
    remount: remountWith,
    setPendingFocusAfterRemount: (selection: InlineSelectionRange | null) => {
      pendingFocusAfterRemountRef.current = selection
    },
    setSelectionRange,
  }
  const deleteContent = (direction: 'backward' | 'forward') => {
    const nextState = deleteInlineSelection(value, selectionRange, segments, direction)
    if (nextState) commitCanonicalEdit(nextState)
  }
  const deleteContentToLineStart = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isCommandBackspaceShortcut(event)) return false
    if (isCompositionKeyboardEvent(event, isComposingRef.current)) return false

    const editor = editorRef.current
    const currentSelectionRange = editor ? readSelectionRange(editor) : selectionRange
    const nextState = deleteToLineStart(value, currentSelectionRange)

    event.preventDefault()
    event.stopPropagation()

    if (nextState) commitCanonicalEdit(nextState)
    return true
  }
  const cutSelectedContent = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    const editor = editorRef.current
    const currentSelectionRange = editor ? readSelectionRange(editor) : selectionRange
    const selectedText = selectedInlineText(value, currentSelectionRange)
    if (!selectedText) return

    event.preventDefault()
    event.clipboardData.setData('text/plain', normalizeInlineWikilinkValue(selectedText))

    const nextState = deleteInlineSelection(value, currentSelectionRange, segments, 'backward')
    if (nextState) commitCanonicalEdit(nextState)
  }
  const handleBeforeInput = useCallback(
    (nativeEvent: InputEvent) => {
      if (disabled) return

      if (!isInsertBeforeInput(nativeEvent)) return

      if (
        isNativeCompositionBeforeInput(
          nativeEvent,
          isComposingRef.current,
          pendingCompositionInputRef.current,
          isSettlingCompositionRef.current,
          lastImeKeyDownAtRef.current,
        )
      ) {
        shieldNativeBeforeInput(nativeEvent)
        return
      }

      if (nativeEvent.inputType === 'insertLineBreak') {
        nativeEvent.preventDefault()
        insertTransferText('\n')
        return
      }

      if (isPlainTextBeforeInput(nativeEvent)) {
        if (isWindowsRuntime()) {
          // Windows IMEs such as Sogou Pinyin can start a composition right
          // after this bare insertText (GitHub #1329); manually inserting and
          // remounting here would destroy that starting composition. Let the
          // browser insert the text natively; the following input event
          // schedules the deferred value sync (see handleInput). The shield
          // keeps the injected WebView2 helper from canceling this insertion
          // and forcing the IME to roll the text back.
          shieldNativeBeforeInput(nativeEvent)
          return
        }

        nativeEvent.preventDefault()
        insertTransferText(nativeEvent.data)
        return
      }

      const dataTransfer = nativeEvent.dataTransfer
      if (!dataTransfer || !hasUnsupportedClipboardPayload(dataTransfer)) return

      if (nativeEvent.inputType === 'insertFromDrop' && handledFileDropRef.current) {
        handledFileDropRef.current = false
        nativeEvent.preventDefault()
        return
      }

      if (nativeEvent.inputType === 'insertFromDrop') {
        const droppedPathText = extractDroppedPathText(dataTransfer)
        if (droppedPathText) {
          nativeEvent.preventDefault()
          insertTransferText(droppedPathText)
          return
        }
      }

      nativeEvent.preventDefault()
      notifyUnsupportedPaste()
    },
    [disabled, insertTransferText, isSettlingCompositionRef, notifyUnsupportedPaste, pendingCompositionInputRef],
  )
  useShieldedBeforeInput(editorRef, handleBeforeInput, renderVersion)
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!hasUnsupportedClipboardPayload(event.dataTransfer)) return

    handledFileDropRef.current = true
    const droppedPathText = extractDroppedPathText(event.dataTransfer)
    event.preventDefault()

    if (!droppedPathText) {
      notifyUnsupportedPaste()
      return
    }

    insertTransferText(droppedPathText)
  }
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    if (hasUnsupportedClipboardPayload(event.clipboardData)) {
      event.preventDefault()
      notifyUnsupportedPaste()
      return
    }

    const pastedText = normalizeInlineWikilinkValue(event.clipboardData.getData('text/plain'))
    if (!pastedText) return

    const nextState = replaceInlineSelection(value, selectionRange, pastedText)
    pendingPasteRef.current = buildPendingPasteState(value, selectionRange, pastedText)

    event.preventDefault()

    const editor = editorRef.current
    const shouldRestoreFocus = document.activeElement === editor
    pendingScrollTopAfterRemountRef.current = editor?.scrollTop ?? null
    commitCanonicalEdit(nextState, shouldRestoreFocus)
  }
  const syncValueFromEditor = () => {
    const editor = editorRef.current
    if (editor && containsUnsupportedInlineContent(editor)) {
      recoverUnsupportedMutation()
      return
    }

    const pendingPaste = pendingPasteRef.current
    if (editor && pendingPaste) {
      const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editor))
      pendingPasteRef.current = null

      if (shouldRecoverPendingPaste(nextValue, pendingPaste)) {
        publishValue(pendingPaste.expectedValue)
        remountWith(pendingPaste.expectedValue)
        setSelectionRange({ ...pendingPaste.expectedSelection })
        return
      }
    }

    publishEditorValue({ ...editorPublishCallbacks, currentValue: value, editor, hadPendingInput: true })
  }
  // The flush always serializes the live editor node: a node captured at
  // compositionend may have been replaced by an explicit canonical remount
  // (delete, paste, pick) before the settle timer fires.
  const flushPendingCompositionInput = () => {
    if (isComposingRef.current) return
    const editor = editorRef.current
    const hadPendingInput = pendingCompositionInputRef.current
    pendingCompositionInputRef.current = false
    publishEditorValue({ ...editorPublishCallbacks, currentValue: value, editor, hadPendingInput })
  }
  // Blur ends any hidden composition for good, so it is the safe moment to
  // rebuild the canonical segment DOM from the published value.
  const handleEditorBlur = () => {
    if (isComposingRef.current) return

    clearCompositionSettleWindow()
    flushPendingCompositionInput()
  }
  const handleCompositionStart = () => {
    clearCompositionSettleWindow()
    isComposingRef.current = true
  }
  const handleCompositionEnd = () => {
    isComposingRef.current = false
    startCompositionSettleWindow(flushPendingCompositionInput)
  }
  const handleInput = () => {
    if (disabled) return

    if (isComposingRef.current) {
      pendingCompositionInputRef.current = true
      return
    }

    if (isSettlingCompositionRef.current && hasPendingCompositionFlush()) {
      pendingCompositionInputRef.current = true
      return
    }

    clearCompositionSettleWindow()
    pendingCompositionInputRef.current = false

    if (isWindowsRuntime()) {
      pendingCompositionInputRef.current = true
      // Non-destructive publish (#1329): the value follows the DOM immediately
      // while the editor node stays untouched, so the sync can never
      // interrupt a live hidden composition mid-keystroke.
      suppressEchoRemountRef.current = true
      publishEditorValue({
        ...editorPublishCallbacks,
        currentValue: value,
        editor: editorRef.current,
        hadPendingInput: true,
        remount: () => undefined,
        setPendingFocusAfterRemount: () => undefined,
      })
      return
    }

    syncValueFromEditor()
  }
  const submitValue = () => {
    commitEditorValueBeforeSubmit({
      clearSettleWindow: clearCompositionSettleWindow,
      editor: editorRef.current,
      fallbackValue: value,
      pendingCompositionInputRef,
      publishValue,
      remountWith,
      renderedValue: renderState.value,
      pendingFocusAfterRemountRef,
      setSelectionRange,
    })
    submitEditorValue({
      editor: editorRef.current,
      entries,
      onSubmit,
      references,
      submitOnEmpty,
      value,
    })
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    recordImeKeyDownSignal(event, lastImeKeyDownAtRef, lastImeKeyDownPerfAtRef)

    if (!disabled && isLineBreakShortcut(event, isComposingRef.current)) {
      event.preventDefault()
      insertTransferText('\n')
      return
    }

    if (isSelectAllShortcut(event)) {
      event.preventDefault()
      const nextSelection = fullSelectionRange(value)
      setSelectionRange(nextSelection)
      focusSelectionRange(nextSelection)
      return
    }

    if (!disabled && deleteContentToLineStart(event)) {
      return
    }

    handleInlineWikilinkKeyDown({
      event,
      disabled,
      isComposing: isComposingRef.current,
      suggestionsOpen: suggestions.length > 0,
      onCycleSuggestions: cycleSuggestions,
      onSelectSuggestion: () => selectSuggestionAndRemount(selectedSuggestionIndex),
      onDeleteContent: deleteContent,
      canSubmit: onSubmit !== undefined,
      onSubmit: submitValue,
    })
  }
  const editor = (
    <InlineWikilinkEditorField
      key={renderVersion}
      value={renderState.value}
      liveValueEmpty={value.length === 0}
      onBlur={handleEditorBlur}
      placeholder={placeholder}
      disabled={disabled}
      inputRef={setCombinedRef}
      dataTestId={dataTestId}
      placeholderClassName={placeholderClassName}
      editorClassName={editorClassName}
      editorStyle={editorStyle}
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={handleCompositionStart}
      onCompositionUpdate={() => {
        isComposingRef.current = true
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCut={cutSelectedContent}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onSelectionChange={syncSelectionRange}
      segments={renderedSegments}
      typeEntryMap={typeEntryMap}
    />
  )
  const suggestionList = (
    <InlineWikilinkSuggestionMenu
      suggestions={suggestions}
      selectedSuggestionIndex={selectedSuggestionIndex}
      setSuggestionIndex={setSuggestionIndex}
      selectSuggestion={selectSuggestionAndRemount}
      typeEntryMap={typeEntryMap}
      suggestionListVariant={suggestionListVariant}
      suggestionEmptyLabel={suggestionEmptyLabel}
    />
  )
  if (suggestionListVariant === 'palette') {
    return (
      <InlineWikilinkPaletteLayout
        header={paletteHeader}
        editor={editor}
        suggestionList={suggestionList}
        emptyState={paletteEmptyState}
        footer={paletteFooter}
      />
    )
  }
  return (
    <div className="relative">
      {editor}
      {suggestionList}
    </div>
  )
}
