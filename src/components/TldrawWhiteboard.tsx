import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  Tldraw,
  defaultUserPreferences,
  useDialogs,
  useTldrawUser,
  useValue,
  type Editor,
  type TLUiDialog,
  type TLUserPreferences,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { useDocumentThemeMode } from '../hooks/useDocumentThemeMode'
import { resolveEffectiveLocale, translate, type AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import type { ResolvedThemeMode } from '../lib/themeMode'
import { GuardedTldrawCanvas } from './GuardedTldrawCanvas'
import { Button } from './ui/button'
import { ActionTooltip } from './ui/action-tooltip'
import { installWhiteboardRuntimeGuards } from './tldrawRuntimeGuards'
import { useTldrawBoardStore } from './useTldrawBoardStore'

const EMPTY_TLDRAW_TRANSLATION_URL = 'data:application/json;base64,e30K'
const TOLARIA_TLDRAW_USER_ID = 'tolaria-whiteboard'
const WHITEBOARD_FULLSCREEN_BODY_CLASS = 'tldraw-whiteboard-fullscreen-open'

function resolveTldrawAssetUrl(assetUrl: string | undefined): string {
  return assetUrl ?? EMPTY_TLDRAW_TRANSLATION_URL
}

const tldrawAssetUrls = getAssetUrlsByImport(resolveTldrawAssetUrl)

interface TldrawWhiteboardProps {
  boardId: string
  height: string
  snapshot: string
  width: string
  onSnapshotChange: (snapshot: string) => void
  onSizeChange: (size: TldrawWhiteboardSize) => void
}

interface TldrawWhiteboardSize {
  height: string
  width: string
}

interface PixelSize {
  height: number
  width: number | null
}

interface ResizeStart {
  height: number
  pointerX: number
  pointerY: number
  width: number
}

type ResizeMode = 'height' | 'width' | 'both'

function resizeModeFromHandle(handle: HTMLButtonElement): ResizeMode {
  const mode = handle.dataset.resizeMode
  if (mode === 'height' || mode === 'width') return mode
  return 'both'
}

const DEFAULT_HEIGHT = 520
const MIN_HEIGHT = 260
const MIN_WIDTH = 360

function parsePixelValue(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeSize({ height, width }: TldrawWhiteboardSize): PixelSize {
  return {
    height: parsePixelValue(height, DEFAULT_HEIGHT),
    width: width ? parsePixelValue(width, MIN_WIDTH) : null,
  }
}

function sizeToProps({ height, width }: PixelSize): TldrawWhiteboardSize {
  return {
    height: String(Math.max(MIN_HEIGHT, Math.round(height))),
    width: width === null ? '' : String(Math.max(MIN_WIDTH, Math.round(width))),
  }
}

function cssSize({ height, width }: PixelSize): CSSProperties {
  return {
    '--tldraw-whiteboard-height': `${Math.max(MIN_HEIGHT, height)}px`,
    '--tldraw-whiteboard-width': width === null ? '100%' : `${Math.max(MIN_WIDTH, width)}px`,
  } as CSSProperties
}

function tldrawUserPreferences(themeMode: ResolvedThemeMode): TLUserPreferences {
  return {
    ...defaultUserPreferences,
    id: TOLARIA_TLDRAW_USER_ID,
    colorScheme: themeMode,
  }
}

function ignoreTldrawUserPreferencesUpdate(preferences: TLUserPreferences) {
  void preferences
}

function readDocumentLocale(): AppLocale {
  if (typeof document === 'undefined') return 'en'
  return resolveEffectiveLocale(document.documentElement.lang)
}

function useDocumentLocale(): AppLocale {
  const [locale, setLocale] = useState(readDocumentLocale)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const syncLocale = () => setLocale(readDocumentLocale())
    const observer = new MutationObserver(syncLocale)
    observer.observe(document.documentElement, { attributeFilter: ['lang'], attributes: true })
    syncLocale()

    return () => observer.disconnect()
  }, [])

  return locale
}

interface WhiteboardRuntimeAlertProps {
  body: string
  testId: string
  title: string
}

function WhiteboardRuntimeAlert({ body, testId, title }: WhiteboardRuntimeAlertProps) {
  return (
    <div
      role="alert"
      className="tldraw-whiteboard__permission-error"
      data-testid={testId}
    >
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

interface WhiteboardRuntimeAlertsProps {
  locale: AppLocale
  pasteError: boolean
  platformPermissionDenied: boolean
}

function WhiteboardRuntimeAlerts({
  locale,
  pasteError,
  platformPermissionDenied,
}: WhiteboardRuntimeAlertsProps) {
  return (
    <>
      {platformPermissionDenied ? (
        <WhiteboardRuntimeAlert
          body={translate(locale, 'editor.whiteboard.permissionDeniedBody')}
          testId="tldraw-whiteboard-permission-error"
          title={translate(locale, 'editor.whiteboard.permissionDeniedTitle')}
        />
      ) : null}
      {pasteError ? (
        <WhiteboardRuntimeAlert
          body={translate(locale, 'editor.whiteboard.incompatiblePasteBody')}
          testId="tldraw-whiteboard-paste-error"
          title={translate(locale, 'editor.whiteboard.incompatiblePasteTitle')}
        />
      ) : null}
    </>
  )
}

interface TolariaTldrawDialogProps {
  dialog: TLUiDialog
  onClose: (id: string) => void
}

const DIALOG_OPEN_DISMISS_GRACE_MS = 250
let retainedTolariaTldrawDialogs: TLUiDialog[] = []

function useDeferredDialogOpen() {
  const openedAtRef = useRef(0)
  const [readyToOpen, setReadyToOpen] = useState(false)

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      openedAtRef.current = performance.now()
      setReadyToOpen(true)
    })
    return () => { window.cancelAnimationFrame(animationFrameId) }
  }, [])

  return { openedAtRef, readyToOpen }
}

function canDismissDialog(openedAt: number): boolean {
  return performance.now() - openedAt >= DIALOG_OPEN_DISMISS_GRACE_MS
}

function isOverlayEvent(event: { currentTarget: EventTarget | null; target: EventTarget | null }): boolean {
  return event.target === event.currentTarget
}

function shouldCloseFromOverlayClick(
  event: { currentTarget: EventTarget | null; target: EventTarget | null },
  dialog: TLUiDialog,
  mouseDownInsideContent: boolean
): boolean {
  return isOverlayEvent(event) && !dialog.preventBackgroundClose && !mouseDownInsideContent
}

interface TolariaTldrawDialogContentProps {
  dialog: TLUiDialog
  mouseDownInsideContentRef: MutableRefObject<boolean>
  onClose: () => void
}

function TolariaTldrawDialogContent({
  dialog,
  mouseDownInsideContentRef,
  onClose,
}: TolariaTldrawDialogContentProps) {
  const ModalContent = dialog.component
  const handleClose = () => {
    mouseDownInsideContentRef.current = false
    onClose()
  }

  return (
    <div
      dir="ltr"
      className="tlui-dialog__content"
      aria-describedby={undefined}
      role="dialog"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        mouseDownInsideContentRef.current = false
        onClose()
      }}
      onMouseDown={() => { mouseDownInsideContentRef.current = true }}
      onMouseUp={() => { mouseDownInsideContentRef.current = false }}
    >
      <ModalContent onClose={handleClose} />
    </div>
  )
}

const TolariaTldrawDialog = memo(function TolariaTldrawDialog({ dialog, onClose }: TolariaTldrawDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const mouseDownInsideContentRef = useRef(false)
  const { openedAtRef, readyToOpen } = useDeferredDialogOpen()

  const closeDialogFromBackground = useCallback(() => {
    if (!canDismissDialog(openedAtRef.current)) return
    onClose(dialog.id)
  }, [dialog.id, onClose, openedAtRef])
  const closeDialogNow = useCallback(() => { onClose(dialog.id) }, [dialog.id, onClose])
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) closeDialogNow()
  }, [closeDialogNow])
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.target === overlay) mouseDownInsideContentRef.current = false
    }
    const handleClick = (event: MouseEvent) => {
      if (shouldCloseFromOverlayClick({ currentTarget: overlay, target: event.target }, dialog, mouseDownInsideContentRef.current)) {
        closeDialogFromBackground()
      }
    }

    overlay.addEventListener('mousedown', handleMouseDown)
    overlay.addEventListener('click', handleClick)
    return () => {
      overlay.removeEventListener('mousedown', handleMouseDown)
      overlay.removeEventListener('click', handleClick)
    }
  }, [closeDialogFromBackground, dialog])

  if (!readyToOpen) return null

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <div
        ref={overlayRef}
        dir="ltr"
        className="tlui-dialog__overlay"
      >
        <TolariaTldrawDialogContent
          dialog={dialog}
          mouseDownInsideContentRef={mouseDownInsideContentRef}
          onClose={closeDialogNow}
        />
      </div>
    </DialogPrimitive.Root>
  )
})

function TolariaTldrawDialogs() {
  const { dialogs, removeDialog } = useDialogs()
  const requestedDialogs = useValue('tolaria tldraw dialogs', () => dialogs.get(), [dialogs])
  const [visibleDialogs, setVisibleDialogs] = useState<TLUiDialog[]>(() =>
    retainedTolariaTldrawDialogs.length > 0 ? retainedTolariaTldrawDialogs : dialogs.get()
  )

  const closeVisibleDialog = useCallback((id: string) => {
    const nextDialogs = retainedTolariaTldrawDialogs.filter((dialog) => dialog.id !== id)
    retainedTolariaTldrawDialogs = nextDialogs
    setVisibleDialogs(nextDialogs)
    removeDialog(id)
  }, [removeDialog])

  useEffect(() => {
    if (requestedDialogs.length === 0) return
    // tldraw clears the dialog atom while Radix closes the menu; keep the last requested dialog mounted locally.
    retainedTolariaTldrawDialogs = requestedDialogs
    queueMicrotask(() => {
      setVisibleDialogs(requestedDialogs)
    })
  }, [requestedDialogs])

  return visibleDialogs.map((dialog) => (
    <TolariaTldrawDialog
      key={dialog.id}
      dialog={dialog}
      onClose={closeVisibleDialog}
    />
  ))
}

function useFullscreenWhiteboard() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    document.body.classList.add(WHITEBOARD_FULLSCREEN_BODY_CLASS)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.classList.remove(WHITEBOARD_FULLSCREEN_BODY_CLASS)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreen])

  useEffect(() => {
    void fullscreen
    const animationFrameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
    return () => { window.cancelAnimationFrame(animationFrameId) }
  }, [fullscreen])

  const toggleFullscreen = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setFullscreen((current) => !current)
  }, [])

  return { fullscreen, toggleFullscreen }
}

interface WhiteboardResizeContext {
  boardRef: MutableRefObject<HTMLDivElement | null>
  onSizeChange: TldrawWhiteboardProps['onSizeChange']
  setResizingSize: Dispatch<SetStateAction<PixelSize | null>>
  visibleSize: PixelSize
}

function beginWhiteboardResize(
  event: ReactPointerEvent<HTMLButtonElement>,
  { boardRef, onSizeChange, setResizingSize, visibleSize }: WhiteboardResizeContext,
) {
  event.preventDefault()
  event.stopPropagation()
  const mode = resizeModeFromHandle(event.currentTarget)
  const rect = boardRef.current?.getBoundingClientRect()
  const start: ResizeStart = {
    height: visibleSize.height,
    pointerX: event.clientX,
    pointerY: event.clientY,
    width: visibleSize.width ?? rect?.width ?? MIN_WIDTH,
  }
  const onPointerMove = (moveEvent: PointerEvent) => {
    const nextSize = {
      height: mode === 'width' ? start.height : start.height + moveEvent.clientY - start.pointerY,
      width: mode === 'height' ? visibleSize.width : start.width + moveEvent.clientX - start.pointerX,
    }
    setResizingSize(normalizeSize(sizeToProps(nextSize)))
  }
  const onPointerUp = (upEvent: PointerEvent) => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    const finalSize = {
      height: mode === 'width' ? start.height : start.height + upEvent.clientY - start.pointerY,
      width: mode === 'height' ? visibleSize.width : start.width + upEvent.clientX - start.pointerX,
    }
    setResizingSize(null)
    onSizeChange(sizeToProps(normalizeSize(sizeToProps(finalSize))))
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
}

interface WhiteboardControlsProps {
  fullscreen: boolean
  fullscreenLabel: string
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onToggleFullscreen: (event: ReactMouseEvent<HTMLButtonElement>) => void
}

function WhiteboardControls({
  fullscreen,
  fullscreenLabel,
  onResizeStart,
  onToggleFullscreen,
}: WhiteboardControlsProps) {
  return (
    <>
      <ActionTooltip copy={{ label: fullscreenLabel }} side="left">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={fullscreenLabel}
          aria-pressed={fullscreen}
          className="tldraw-whiteboard__fullscreen-button"
          data-testid="tldraw-whiteboard-fullscreen-toggle"
          title={fullscreenLabel}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <ArrowsIn aria-hidden="true" /> : <ArrowsOut aria-hidden="true" />}
        </Button>
      </ActionTooltip>
      <button type="button" aria-label="Resize whiteboard width" className="tldraw-whiteboard__resize-handle tldraw-whiteboard__resize-handle--width border-0 bg-transparent p-0" data-resize-mode="width" onPointerDown={onResizeStart} />
      <button type="button" aria-label="Resize whiteboard height" className="tldraw-whiteboard__resize-handle tldraw-whiteboard__resize-handle--height border-0 bg-transparent p-0" data-resize-mode="height" onPointerDown={onResizeStart} />
      <button type="button" aria-label="Resize whiteboard" className="tldraw-whiteboard__resize-handle tldraw-whiteboard__resize-handle--corner border-0 bg-transparent p-0" data-resize-mode="both" onPointerDown={onResizeStart} />
    </>
  )
}

function useWhiteboardRuntime({
  boardId,
  height,
  onSizeChange,
  onSnapshotChange,
  snapshot,
  width,
}: TldrawWhiteboardProps) {
  const store = useTldrawBoardStore({ boardId, onSnapshotChange, snapshot })
  const boardRef = useRef<HTMLDivElement | null>(null)
  const persistedSize = useMemo(() => normalizeSize({ height, width }), [height, width])
  const [resizingSize, setResizingSize] = useState<PixelSize | null>(null)
  const [permissionDeniedBoardId, setPermissionDeniedBoardId] = useState<string | null>(null)
  const [pasteErrorBoardId, setPasteErrorBoardId] = useState<string | null>(null)
  const platformPermissionDenied = permissionDeniedBoardId === boardId
  const pasteError = pasteErrorBoardId === boardId
  const visibleSize = resizingSize ?? persistedSize
  const { fullscreen, toggleFullscreen } = useFullscreenWhiteboard()
  const locale = useDocumentLocale()
  const fullscreenLabel = translate(
    locale,
    fullscreen ? 'editor.whiteboard.exitFullscreen' : 'editor.whiteboard.enterFullscreen',
  )
  const themeMode = useDocumentThemeMode()
  const userPreferences = useMemo(() => tldrawUserPreferences(themeMode), [themeMode])
  const tldrawUser = useTldrawUser({
    setUserPreferences: ignoreTldrawUserPreferencesUpdate,
    userPreferences,
  })
  const tldrawUiComponents = useMemo(() => ({
    Canvas: GuardedTldrawCanvas,
    Dialogs: TolariaTldrawDialogs,
  }), [])
  const handleTldrawMount = useCallback((editor: Editor) =>
    installWhiteboardRuntimeGuards(editor, {
      onIncompatiblePaste: () => {
        trackEvent('whiteboard_paste_rejected', { reason: 'incompatible_schema' })
        setPasteErrorBoardId(boardId)
      },
      onPlatformPermissionDenied: () => { setPermissionDeniedBoardId(boardId) },
    }), [boardId])

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => beginWhiteboardResize(event, {
    boardRef,
    onSizeChange,
    setResizingSize,
    visibleSize,
  })

  return {
    boardRef,
    fullscreen,
    fullscreenLabel,
    handleTldrawMount,
    locale,
    pasteError,
    platformPermissionDenied,
    startResize,
    store,
    tldrawUiComponents,
    tldrawUser,
    toggleFullscreen,
    visibleSize,
  }
}

export function TldrawWhiteboard(props: TldrawWhiteboardProps) {
  const {
    boardRef, fullscreen, fullscreenLabel, handleTldrawMount, locale, pasteError,
    platformPermissionDenied, startResize, store, tldrawUiComponents, tldrawUser,
    toggleFullscreen, visibleSize,
  } = useWhiteboardRuntime(props)

  return (
    <div
      ref={boardRef}
      className={fullscreen ? 'tldraw-whiteboard tldraw-whiteboard--fullscreen' : 'tldraw-whiteboard'}
      contentEditable={false}
      data-board-id={props.boardId}
      style={cssSize(visibleSize)}
    >
      <Tldraw
        assetUrls={tldrawAssetUrls}
        components={tldrawUiComponents}
        key={props.boardId}
        onMount={handleTldrawMount}
        store={store}
        user={tldrawUser}
      />
      <WhiteboardRuntimeAlerts
        locale={locale}
        pasteError={pasteError}
        platformPermissionDenied={platformPermissionDenied}
      />
      <WhiteboardControls
        fullscreen={fullscreen}
        fullscreenLabel={fullscreenLabel}
        onResizeStart={startResize}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  )
}
