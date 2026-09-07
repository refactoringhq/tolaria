import { Component, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  BlockNoteViewRaw,
  ComponentsContext,
  type useCreateBlockNote,
} from '@blocknote/react'
import { components } from '@blocknote/mantine'
import { MantineContext, MantineProvider } from '@mantine/core'
import { trackEvent } from '../lib/telemetry'
import { useDocumentThemeMode } from '../hooks/useDocumentThemeMode'
import { useEditorTheme } from '../hooks/useTheme'
import { useImageDrop, type ImageImportError } from '../hooks/useImageDrop'
import { useImageLightbox } from '../hooks/useImageLightbox'
import type { AppLocale } from '../lib/i18n'
import { buildTypeEntryMap } from '../utils/typeColors'
import { workspacePathForEntry } from '../utils/workspaces'
import { observeNativeTextAssistanceDisabled } from '../lib/nativeTextAssistance'
import { getRuntimeStyleNonce } from '../lib/runtimeStyleNonce'
import type { VaultEntry } from '../types'
import { _wikilinkEntriesRef } from './editorSchema'
import { insertImageBlockAfterCursor } from './editorImageInsertion'
import { useBlockNoteSideMenuHoverGuard } from './blockNoteSideMenuHoverGuard'
import { useEditorLinkActivation } from './useEditorLinkActivation'
import { ImageLightbox } from './ImageLightbox'
import { refreshCodeBlockSyntaxHighlighting } from './editorCodeBlockHighlightRefresh'
import { VaultExpressionProvider } from './VaultExpressionContext'
import { subscribeRichEditorExternalChange } from './editorExternalChangeEvents'
import {
  activatePlainTextPasteTarget,
  registerPlainTextPasteTarget,
  type PlainTextPasteTarget,
} from '../utils/plainTextPaste'
import {
  blockNoteRenderRecoveryReason,
  isRecoverableBlockNoteRenderError,
  markRecoveredBlockNoteRenderError,
  type BlockNoteRenderRecoveryReason,
} from './blockNoteRenderRecovery'
import { repairEditorDocumentForRenderRecovery } from './blockNoteRenderRecoveryDocument'
import { useEditorPasteHandler } from './titleHeadingInteractions'
import {
  buildBaseSuggestionItems,
  type SuggestionAction,
  useInsertWikilink,
  useSuggestionMenuItems,
} from './singleEditorSuggestionItems'
import {
  useEditorContainerClickHandler,
  useEditorWhitespaceMouseSelection,
} from './singleEditorPointerInteractions'
import { useCompositionAwareEditorChange } from './useCompositionAwareEditorChange'
import { useSeedBlockNoteTableBridge } from './useSeedBlockNoteTableBridge'
import { EditorInteractionControllers } from './EditorInteractionControllers'
import { handleEditorCopy } from './editorCopyHandlers'
import { CodeBlockCopyButton } from './codeBlockCopyControls'
import { useCodeBlockCopyTarget } from './useCodeBlockCopyTarget'

const TOOLBAR_MOUSE_DOWN_ALLOW_SELECTOR = [
  '[role="menu"]',
  '[role="dialog"]',
  'button[aria-haspopup]',
  'input',
  'textarea',
  '[contenteditable="true"]',
].join(', ')
const MAX_BLOCKNOTE_RENDER_RECOVERY_RETRIES = 1

type BlockNoteRenderRecoveryState = {
  error: unknown
  recoveryKey: number
  retries: number
}

class BlockNoteRenderRecoveryBoundary extends Component<
  {
  children: (recoveryKey: number) => ReactNode
  onRecover?: (attempt: number, reason: BlockNoteRenderRecoveryReason) => void
  },
  BlockNoteRenderRecoveryState
> {
  state: BlockNoteRenderRecoveryState = {
    error: null,
    recoveryKey: 0,
    retries: 0,
  }

  static getDerivedStateFromError(error: unknown): Partial<BlockNoteRenderRecoveryState> {
    markRecoveredBlockNoteRenderError(error)
    return { error }
  }

  componentDidCatch(error: unknown) {
    const reason = blockNoteRenderRecoveryReason(error)
    if (!reason) return
    if (this.state.retries >= MAX_BLOCKNOTE_RENDER_RECOVERY_RETRIES) return

    const attempt = this.state.retries + 1
    trackEvent('editor_render_recovered', { reason, attempt })
    this.props.onRecover?.(attempt, reason)
    this.setState(({ recoveryKey, retries }) => ({
      error: null,
      recoveryKey: recoveryKey + 1,
      retries: retries + 1,
    }))
  }

  render() {
    if (this.state.error) {
      if (!isRecoverableBlockNoteRenderError(this.state.error)) {
        throw this.state.error
      }

      return null
    }

    return this.props.children(this.state.recoveryKey)
  }
}

function isEditorReadyForSuggestionAction(
  editor: ReturnType<typeof useCreateBlockNote>,
  container: HTMLElement | null,
) {
  if (!container?.isConnected) return false

  const editorElement = editor.domElement
  if (!(editorElement instanceof HTMLElement)) return true

  return editorElement.isConnected
}

function runSuggestionActionSafely({
  action,
  container,
  editor,
}: {
  action: SuggestionAction
  container: HTMLElement | null
  editor: ReturnType<typeof useCreateBlockNote>
}) {
  if (!isEditorReadyForSuggestionAction(editor, container)) return

  try {
    action()
  } catch (error) {
    console.warn('[editor] Ignored stale suggestion menu action:', error)
  }
}

function SharedContextBlockNoteView(props: React.ComponentProps<typeof BlockNoteViewRaw>) {
  const { children, className, theme, ...rest } = props
  const mantineContext = useContext(MantineContext)
  const colorScheme = theme === 'dark' ? 'dark' : 'light'
  const view = (
    <ComponentsContext.Provider value={components}>
      <BlockNoteViewRaw
        {...rest}
        className={['bn-mantine', className].filter(Boolean).join(' ')}
        data-mantine-color-scheme={colorScheme}
        theme={theme}
      >
        {children}
      </BlockNoteViewRaw>
    </ComponentsContext.Provider>
  )

  if (mantineContext) return view

  return (
    <MantineProvider
      // BlockNote scopes Mantine defaults under `.bn-mantine` instead of `:root`.
      withCssVariables={false}
      getStyleNonce={getRuntimeStyleNonce}
      getRootElement={() => undefined}
    >
      {view}
    </MantineProvider>
  )
}

function shouldAllowToolbarMouseDown(target: HTMLElement) {
  return Boolean(target.closest(TOOLBAR_MOUSE_DOWN_ALLOW_SELECTOR))
}

function handleToolbarMouseDownCapture(event: Pick<React.MouseEvent<HTMLElement>, 'target' | 'preventDefault'>) {
  if (!(event.target instanceof HTMLElement) || shouldAllowToolbarMouseDown(event.target)) {
    return
  }

  event.preventDefault()
}

/** Insert an image block after the current cursor position. */
function useInsertImageCallback(editor: ReturnType<typeof useCreateBlockNote>) {
  const editorRef = useRef(editor)
  useEffect(() => {
    editorRef.current = editor
  }, [editor])
  return useCallback((url: string) => {
    insertImageBlockAfterCursor(editorRef.current, url)
  }, [])
}

function useRichEditorPlainTextPasteTarget(options: {
  containerRef: React.RefObject<HTMLDivElement | null>
  editable: boolean
  editor: ReturnType<typeof useCreateBlockNote>
  runEditorAction: (action: SuggestionAction) => void
}) {
  const { containerRef, editable, editor, runEditorAction } = options
  const targetRef = useRef<PlainTextPasteTarget | null>(null)

  useEffect(() => {
    const target: PlainTextPasteTarget = {
      surface: 'rich_editor',
      contains: (element) => Boolean(element && containerRef.current?.contains(element)),
      isConnected: () => containerRef.current?.isConnected === true,
      insert: (text) => {
        if (!editable) return false

        let inserted = false
        runEditorAction(() => {
          editor.focus()
          editor.insertInlineContent(text, { updateSelection: true })
          inserted = true
        })
        return inserted
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
  }, [containerRef, editable, editor, runEditorAction])

  return useCallback(() => {
    if (targetRef.current) {
      activatePlainTextPasteTarget(targetRef.current)
    }
  }, [])
}

/** Single BlockNote editor view — content is swapped via replaceBlocks */
export function SingleEditorView(options: {
  currentContent?: string
  editor: ReturnType<typeof useCreateBlockNote>
  entries: VaultEntry[]
  onNavigateWikilink: (target: string) => void
  onChange?: () => void
  onImageImportError?: (error: ImageImportError) => void
  sourceEntry?: VaultEntry | null
  vaultPath?: string
  editable?: boolean
  locale?: AppLocale
}) {
  const { currentContent = '', editor, entries, onNavigateWikilink, onChange, onImageImportError, sourceEntry, vaultPath, editable = true, locale = 'en' } = options
  const { cssVars } = useEditorTheme()
  const themeMode = useDocumentThemeMode()
  const previousThemeModeRef = useRef(themeMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const suppressNextContainerClickRef = useRef(false)
  const handleContainerClick = useEditorContainerClickHandler({
    editable,
    editor,
    suppressNextContainerClickRef,
    vaultPath,
  })
  const handleWhitespaceMouseSelection = useEditorWhitespaceMouseSelection({
    containerRef,
    editable,
    editor,
    suppressNextContainerClickRef,
  })
  const handleEditorChange = useCompositionAwareEditorChange({
    containerRef,
    onChange,
  })
  const onImageUrl = useInsertImageCallback(editor)
  const { isDragOver } = useImageDrop({
    containerRef,
    onImageImportError,
    onImageUrl,
    vaultPath,
  })
  const lightbox = useImageLightbox({ containerRef })
  const {
    clearCopyTarget,
    copyTarget,
    handleFocus: handleCodeBlockCopyFocus,
    handleMouseMove: handleCodeBlockCopyMouseMove,
  } = useCodeBlockCopyTarget(containerRef)
  useBlockNoteSideMenuHoverGuard(containerRef)
  useEditorLinkActivation(
    containerRef,
    onNavigateWikilink,
    vaultPath,
    sourceEntry?.path,
    (sourceEntry ? workspacePathForEntry(sourceEntry) : null) ?? vaultPath,
  )

  useEffect(() => {
    _wikilinkEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    if (previousThemeModeRef.current === themeMode) return

    previousThemeModeRef.current = themeMode
    refreshCodeBlockSyntaxHighlighting(editor)
  }, [editor, themeMode])

  useEffect(() => {
    return subscribeRichEditorExternalChange(editor, handleEditorChange)
  }, [editor, handleEditorChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    return observeNativeTextAssistanceDisabled(container)
  }, [])

  useSeedBlockNoteTableBridge(editor)

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const baseItems = useMemo(() => buildBaseSuggestionItems(entries), [entries])
  const runEditorAction = useCallback(
    (action: SuggestionAction) => {
    runSuggestionActionSafely({
      action,
      container: containerRef.current,
      editor,
    })
    },
    [editor],
  )
  const activatePlainTextPaste = useRichEditorPlainTextPasteTarget({
    containerRef,
    editable,
    editor,
    runEditorAction,
  })
  const handlePasteCapture = useEditorPasteHandler({
    editable,
    editor,
    runEditorAction,
  })
  const handleFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
    activatePlainTextPaste()
    handleCodeBlockCopyFocus(event)
    },
    [activatePlainTextPaste, handleCodeBlockCopyFocus],
  )
  const handleMouseDownCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
    activatePlainTextPaste()
    handleWhitespaceMouseSelection(event)
    },
    [activatePlainTextPaste, handleWhitespaceMouseSelection],
  )
  const handleCopyCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
    handleEditorCopy(event, editor)
    },
    [editor],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleClick = (event: MouseEvent) => {
      handleContainerClick(event as unknown as React.MouseEvent<HTMLDivElement>)
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [handleContainerClick])

  const insertWikilink = useInsertWikilink(editor, runEditorAction)
  const suggestionMenuItems = useSuggestionMenuItems({
    baseItems,
    editor,
    entries,
    insertWikilink,
    locale,
    onNavigateWikilink,
    runEditorAction,
    sourceEntry: sourceEntry ?? undefined,
    typeEntryMap,
    vaultPath,
  })

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Rich text editor"
      className={`editor__blocknote-container${isDragOver ? ' editor__blocknote-container--drag-over' : ''}`}
      style={cssVars as React.CSSProperties}
      onCopyCapture={handleCopyCapture}
      onFocusCapture={handleFocusCapture}
      onMouseLeave={clearCopyTarget}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseMove={handleCodeBlockCopyMouseMove}
      onPasteCapture={handlePasteCapture}
    >
      {isDragOver && (
        <div className="editor__drop-overlay">
          <div className="editor__drop-overlay-label">Drop image here</div>
        </div>
      )}
      <BlockNoteRenderRecoveryBoundary onRecover={(_, reason) => repairEditorDocumentForRenderRecovery(editor, reason)}>
        {(recoveryKey) => (
          <VaultExpressionProvider
            currentContent={currentContent}
            entries={entries}
            locale={locale}
            sourceEntry={sourceEntry ?? null}
            vaultPath={vaultPath ?? ''}
          >
            <SharedContextBlockNoteView
              key={recoveryKey}
              editor={editor}
              theme={themeMode}
              onChange={handleEditorChange}
              editable={editable}
              emojiPicker={false}
              formattingToolbar={false}
              linkToolbar={false}
              slashMenu={false}
              sideMenu={false}
              filePanel={false}
            >
              <EditorInteractionControllers
                {...suggestionMenuItems}
                locale={locale}
                onToolbarMouseDown={handleToolbarMouseDownCapture}
                runEditorAction={runEditorAction}
                vaultPath={vaultPath}
              />
            </SharedContextBlockNoteView>
          </VaultExpressionProvider>
        )}
      </BlockNoteRenderRecoveryBoundary>
      {copyTarget && <CodeBlockCopyButton copyTarget={copyTarget} locale={locale} />}
      <ImageLightbox image={lightbox.image} locale={locale} onClose={lightbox.close} />
    </div>
  )
}
