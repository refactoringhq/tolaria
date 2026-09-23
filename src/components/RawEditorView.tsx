import { useRef, useState, useCallback, useEffect } from 'react'
import type { EditorView } from '@codemirror/view'
import { trackEvent } from '../lib/telemetry'
import {
  detectYamlError,
  getRawEditorDropdownPosition,
  type RawEditorAutocompleteState,
} from '../utils/rawEditorUtils'
import { useCodeMirror } from '../hooks/useCodeMirror'
import type { VaultEntry } from '../types'
import type { AppLocale } from '../lib/i18n'
import { RawEditorFindBar, type RawEditorFindRequest } from './RawEditorFindBar'
import {
  activatePlainTextPasteTarget,
  registerPlainTextPasteTarget,
  type PlainTextPasteTarget,
} from '../utils/plainTextPaste'
import { rawEditorLanguageIdForPath } from '../utils/rawEditorLanguage'
import {
  clipboardRemoteImages,
  importRemoteImages,
  rawRemoteImagePasteText,
  replaceImportedRemoteImages,
  type RemoteImageImportResult,
} from '../utils/remoteImagePaste'
import {
  RAW_EDITOR_DROPDOWN_MAX_HEIGHT,
  useRawEditorAutocompleteController,
  useRawEditorWikilinkInsertion,
  type RawEditorPendingChangeRefs,
  type RawEditorSetAutocomplete,
} from './rawEditorAutocomplete'
import { RawEditorAutocompleteDropdown } from './RawEditorAutocompleteDropdown'

export interface RawEditorViewProps {
  content: string
  path: string
  entries: VaultEntry[]
  sourceEntry?: VaultEntry
  onContentChange: (path: string, content: string) => void
  vaultPath?: string
  onSave: () => void
  /** Mutable ref updated on every keystroke with the latest doc string.
   *  Allows the parent to flush debounced content before unmount. */
  latestContentRef?: React.MutableRefObject<string | null>
  locale?: AppLocale
  findRequest?: RawEditorFindRequest | null
  onImageImportResult?: (result: Pick<RemoteImageImportResult, 'failedCount' | 'totalCount'>) => void
}

const DEBOUNCE_MS = 500
type PendingChangeRefs = RawEditorPendingChangeRefs

function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function flushPendingRawEditorChange({
  debounceRef,
  latestDocRef,
  onContentChangeRef,
  pathRef,
}: PendingChangeRefs): void {
  if (!debounceRef.current) return

  clearTimeout(debounceRef.current)
  debounceRef.current = null
  onContentChangeRef.current(pathRef.current, latestDocRef.current)
}

function RawEditorYamlErrorBanner({ error }: { error: string | null }) {
  if (!error) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-xs border-b shrink-0"
      style={{
        background: 'var(--feedback-warning-bg)',
        borderColor: 'var(--feedback-warning-border)',
        color: 'var(--feedback-warning-text)',
      }}
      role="alert"
      data-testid="raw-editor-yaml-error"
    >
      <span style={{ fontWeight: 600 }}>YAML error:</span>
      <span>{error}</span>
    </div>
  )
}

type RawEditorPendingChanges = PendingChangeRefs & {
  flush: () => void
  handleDocChange: (doc: string) => void
  handleSave: () => void
  yamlError: string | null
}

function useRawEditorPendingChanges({
  content,
  latestContentRef,
  onContentChange,
  onSave,
  path,
}: Pick<
  RawEditorViewProps,
  'content' | 'latestContentRef' | 'onContentChange' | 'onSave' | 'path'
>): RawEditorPendingChanges {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useLatestRef(path)
  const onContentChangeRef = useLatestRef(onContentChange)
  const onSaveRef = useLatestRef(onSave)
  const latestContentRefStable = useRef(latestContentRef)
  const latestDocRef = useRef(content)
  const [yamlError, setYamlError] = useState<string | null>(() => detectYamlError(content))

  useEffect(() => {
    if (latestContentRef) latestContentRef.current = content
  }, [latestContentRef, content])
  useEffect(() => {
    latestContentRefStable.current = latestContentRef
  }, [latestContentRef])

  const handleDocChange = useCallback(
    (doc: string) => {
    latestDocRef.current = doc
    if (latestContentRefStable.current) latestContentRefStable.current.current = doc
    setYamlError(detectYamlError(doc))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onContentChangeRef.current(pathRef.current, doc)
    }, DEBOUNCE_MS)
    },
    [onContentChangeRef, pathRef],
  )

  const flush = useCallback(() => {
    flushPendingRawEditorChange({
      debounceRef,
      latestDocRef,
      onContentChangeRef,
      pathRef,
    })
  }, [onContentChangeRef, pathRef])

  const handleSave = useCallback(() => {
    flush()
    onSaveRef.current()
  }, [flush, onSaveRef])

  useEffect(() => flush, [flush])

  return {
    debounceRef,
    flush,
    handleDocChange,
    handleSave,
    latestDocRef,
    onContentChangeRef,
    pathRef,
    yamlError,
  }
}

function useRawEditorPlainTextPasteTarget({
  containerRef,
  setAutocomplete,
  viewRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  setAutocomplete: RawEditorSetAutocomplete
  viewRef: React.MutableRefObject<EditorView | null>
}) {
  const targetRef = useRef<PlainTextPasteTarget | null>(null)

  useEffect(() => {
    const target: PlainTextPasteTarget = {
      surface: 'raw_editor',
      contains: (element) => Boolean(element && containerRef.current?.contains(element)),
      isConnected: () => containerRef.current?.isConnected === true,
      insert: (text) => {
        const view = viewRef.current
        if (!view) return false

        view.dispatch({
          ...view.state.replaceSelection(text),
          userEvent: 'input.paste',
        })
        setAutocomplete(null)
        view.focus()
        return true
      },
    }
    targetRef.current = target
    const unregister = registerPlainTextPasteTarget(target)

    return () => {
      unregister()
      if (targetRef.current === target) {
        targetRef.current = null
      }
    }
  }, [containerRef, setAutocomplete, viewRef])

  return useCallback(() => {
    if (targetRef.current) {
      activatePlainTextPasteTarget(targetRef.current)
    }
  }, [])
}

function useRawEditorRemoteImagePaste({
  onImageImportResult,
  vaultPath,
  viewRef,
}: Pick<RawEditorViewProps, 'onImageImportResult' | 'vaultPath'> & {
  viewRef: React.MutableRefObject<EditorView | null>
}) {
  return useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
    const view = viewRef.current
    const images = clipboardRemoteImages(event.clipboardData)
    if (!view || !vaultPath || images.length === 0) return

    event.preventDefault()
    event.stopPropagation()
    const insertedText = rawRemoteImagePasteText(event.clipboardData)
    const selection = view.state.selection.main
    const insertedFrom = selection.from
    const insertedTo = insertedFrom + insertedText.length
    view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: insertedText,
        },
      selection: { anchor: insertedTo },
      userEvent: 'input.paste',
    })
    view.focus()

      void importRemoteImages({ images, vaultPath }).then((result) => {
      const importedText = replaceImportedRemoteImages({
        text: insertedText,
        replacements: result.replacements,
      })
        if (
          canRewriteRawImagePaste({
        importedText,
        insertedFrom,
        insertedText,
        insertedTo,
        view,
        viewRef,
          })
        ) {
        view.dispatch({
            changes: {
              from: insertedFrom,
              to: insertedTo,
              insert: importedText,
            },
          userEvent: 'input.paste',
        })
      }
      onImageImportResult?.({
        failedCount: result.failedCount,
        totalCount: result.totalCount,
      })
      trackEvent('remote_images_paste_imported', {
        surface: 'raw_editor',
        total_count: result.totalCount,
        success_count: result.totalCount - result.failedCount,
        failure_count: result.failedCount,
      })
    })
    },
    [onImageImportResult, vaultPath, viewRef],
  )
}

function canRewriteRawImagePaste({
  importedText,
  insertedFrom,
  insertedText,
  insertedTo,
  view,
  viewRef,
}: {
  importedText: string
  insertedFrom: number
  insertedText: string
  insertedTo: number
  view: EditorView
  viewRef: React.MutableRefObject<EditorView | null>
}): boolean {
  if (viewRef.current !== view) return false
  if (importedText === insertedText) return false
  return view.state.doc.sliceString(insertedFrom, insertedTo) === insertedText
}

function useRawEditorDomEvents(
  rootRef: React.RefObject<HTMLDivElement | null>,
  activatePlainTextPaste: () => void,
  flushPendingChange: () => void,
): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return
      flushPendingChange()
    }
    root.addEventListener('focusin', activatePlainTextPaste)
    root.addEventListener('focusout', handleFocusOut)
    root.addEventListener('mousedown', activatePlainTextPaste, { capture: true })
    return () => {
      root.removeEventListener('focusin', activatePlainTextPaste)
      root.removeEventListener('focusout', handleFocusOut)
      root.removeEventListener('mousedown', activatePlainTextPaste, { capture: true })
    }
  }, [activatePlainTextPaste, flushPendingChange, rootRef])
}

function useRawEditorContentSync(options: {
  content: string
  findRequest?: RawEditorFindRequest | null
  path: string
  setAutocomplete: (value: RawEditorAutocompleteState | null) => void
  setFindOpen: (value: boolean) => void
  setRawDoc: (value: string) => void
  setReplaceOpen: (value: boolean) => void
}): void {
  const { content, findRequest, path, setAutocomplete, setFindOpen, setRawDoc, setReplaceOpen } = options
  useEffect(() => setRawDoc(content), [content, setRawDoc])
  useEffect(() => {
    if (!findRequest || findRequest.path !== path) return
    setAutocomplete(null)
    setFindOpen(true)
    setReplaceOpen(findRequest.replace)
  }, [findRequest, path, setAutocomplete, setFindOpen, setReplaceOpen])
}

interface RawEditorSurfaceProps {
  autocomplete: RawEditorAutocompleteState | null
  containerRef: React.RefObject<HTMLDivElement | null>
  findOpen: boolean
  findRequest?: RawEditorFindRequest | null
  handleItemHover: (index: number) => void
  handleRemoteImagePaste: (event: React.ClipboardEvent<HTMLDivElement>) => void
  locale: AppLocale
  path: string
  pendingChanges: ReturnType<typeof useRawEditorPendingChanges>
  rawDoc: string
  replaceOpen: boolean
  rootRef: React.RefObject<HTMLDivElement | null>
  setFindOpen: (value: boolean) => void
  setReplaceOpen: (value: boolean) => void
  showFrontmatterWarning: boolean
  viewRef: React.MutableRefObject<EditorView | null>
}

function RawEditorSurface(options: RawEditorSurfaceProps) {
  const { autocomplete, containerRef, findOpen, findRequest, handleItemHover, handleRemoteImagePaste, locale, path, pendingChanges, rawDoc, replaceOpen, rootRef, setFindOpen, setReplaceOpen, showFrontmatterWarning, viewRef } = options
  const dropdownPosition = getRawEditorDropdownPosition(autocomplete, RAW_EDITOR_DROPDOWN_MAX_HEIGHT, window)
  return (
    <div ref={rootRef} className="flex flex-1 flex-col min-h-0 relative" style={{ background: 'var(--background)' }} onPasteCapture={handleRemoteImagePaste}>
      <RawEditorYamlErrorBanner error={showFrontmatterWarning ? pendingChanges.yamlError : null} />
      <RawEditorFindBar doc={rawDoc} locale={locale} onClose={() => setFindOpen(false)} onReplaceOpenChange={setReplaceOpen} open={findOpen} path={path} replaceOpen={replaceOpen} request={findRequest} viewRef={viewRef} />
      <div ref={containerRef} className="raw-editor-codemirror flex flex-1 min-h-0" data-testid="raw-editor-codemirror" role="presentation" />
      <RawEditorAutocompleteDropdown autocomplete={autocomplete} onItemHover={handleItemHover} position={dropdownPosition} />
    </div>
  )
}

function useRawEditorViewRef(options: {
  autocompleteController: ReturnType<typeof useRawEditorAutocompleteController>
  containerRef: React.RefObject<HTMLDivElement | null>
  content: string
  findOpen: boolean
  path: string
  pendingChanges: ReturnType<typeof useRawEditorPendingChanges>
  setFindOpen: React.Dispatch<React.SetStateAction<boolean>>
  setRawDoc: React.Dispatch<React.SetStateAction<string>>
}) {
  const { autocompleteController, containerRef, content, findOpen, path, pendingChanges, setFindOpen, setRawDoc } = options
  const handleDocChange = useCallback((doc: string) => {
    setRawDoc(doc)
    pendingChanges.handleDocChange(doc)
  }, [pendingChanges, setRawDoc])
  const handleEscape = useCallback(() => {
    if (autocompleteController.handleEscape()) return true
    if (!findOpen) return false

    setFindOpen(false)
    return true
  }, [autocompleteController, findOpen, setFindOpen])

  return useCodeMirror(
    containerRef,
    content,
    {
      onDocChange: handleDocChange,
      onCursorActivity: autocompleteController.handleCursorActivity,
      onSave: pendingChanges.handleSave,
      onEscape: handleEscape,
      onSuggestionKey: autocompleteController.handleSuggestionKey,
    },
    path,
  )
}

function useRawEditorState(options: RawEditorViewProps) {
  const { content, entries, findRequest, latestContentRef, locale = 'en', onContentChange, onSave, path, sourceEntry, vaultPath } = options
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rawDoc, setRawDoc] = useState(content)
  const [findOpen, setFindOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const showFrontmatterWarning = rawEditorLanguageIdForPath(path) === 'markdown'
  const pendingChanges = useRawEditorPendingChanges({
    content,
    latestContentRef,
    onContentChange,
    onSave,
    path,
  })
  const autocompleteController = useRawEditorAutocompleteController({ entries, sourceEntry, vaultPath })
  const viewRef = useRawEditorViewRef({
    autocompleteController,
    containerRef,
    content,
    findOpen,
    path,
    pendingChanges,
    setFindOpen,
    setRawDoc,
  })

  return {
    autocomplete: autocompleteController.autocomplete,
    containerRef,
    findOpen,
    findRequest,
    handleItemHover: autocompleteController.handleItemHover,
    insertWikilinkRef: autocompleteController.insertWikilinkRef,
    locale,
    path,
    pendingChanges,
    rawDoc,
    replaceOpen,
    rootRef,
    setAutocomplete: autocompleteController.setAutocomplete,
    setFindOpen,
    setRawDoc,
    setReplaceOpen,
    showFrontmatterWarning,
    vaultPath,
    viewRef,
  }
}

function useRawEditorEffects(
  options: RawEditorViewProps,
  state: ReturnType<typeof useRawEditorState>,
) {
  const { content, findRequest, onImageImportResult, path } = options
  const {
    containerRef,
    insertWikilinkRef,
    pendingChanges,
    rootRef,
    setAutocomplete,
    setFindOpen,
    setRawDoc,
    setReplaceOpen,
    vaultPath,
    viewRef,
  } = state
  const handleRemoteImagePaste = useRawEditorRemoteImagePaste({
    onImageImportResult,
    vaultPath,
    viewRef,
  })
  const activatePlainTextPaste = useRawEditorPlainTextPasteTarget({
    containerRef,
    setAutocomplete,
    viewRef,
  })
  useRawEditorDomEvents(rootRef, activatePlainTextPaste, pendingChanges.flush)

  useRawEditorWikilinkInsertion({
    debounceRef: pendingChanges.debounceRef,
    insertWikilinkRef,
    latestDocRef: pendingChanges.latestDocRef,
    onContentChangeRef: pendingChanges.onContentChangeRef,
    pathRef: pendingChanges.pathRef,
    setAutocomplete,
    viewRef,
  })

  useRawEditorContentSync({ content, findRequest, path, setAutocomplete, setFindOpen, setRawDoc, setReplaceOpen })
  return { handleRemoteImagePaste }
}

export function RawEditorView(options: RawEditorViewProps) {
  const state = useRawEditorState(options)
  const { handleRemoteImagePaste } = useRawEditorEffects(options, state)

  return (
    <RawEditorSurface
      autocomplete={state.autocomplete}
      containerRef={state.containerRef}
      findOpen={state.findOpen}
      findRequest={state.findRequest}
      handleItemHover={state.handleItemHover}
      handleRemoteImagePaste={handleRemoteImagePaste}
      locale={state.locale}
      path={state.path}
      pendingChanges={state.pendingChanges}
      rawDoc={state.rawDoc}
      replaceOpen={state.replaceOpen}
      rootRef={state.rootRef}
      setFindOpen={state.setFindOpen}
      setReplaceOpen={state.setReplaceOpen}
      showFrontmatterWarning={state.showFrontmatterWarning}
      viewRef={state.viewRef}
    />
  )
}
