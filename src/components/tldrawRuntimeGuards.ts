import {
  Box,
  defaultHandleExternalTldrawContent,
  type Editor,
  type TLEventInfo,
} from 'tldraw'
import {
  isWhiteboardPlatformPermissionRejection,
  retainWhiteboardPlatformPermissionGuard,
} from '../utils/whiteboardPlatformPermissionRejection'
import { errorMessageIncludes } from '../utils/vaultErrors'

const TLDRAW_UI_ICON_SELECTOR = '.tlui-icon'
const WEBKIT_MASK_PROPERTY = '-webkit-mask'

export interface WhiteboardRuntimeGuardOptions {
  onIncompatiblePaste: () => void
  onPlatformPermissionDenied: () => void
}

function installTldrawPlatformPermissionGuard({
  onPlatformPermissionDenied,
}: WhiteboardRuntimeGuardOptions): () => void {
  const releaseWhiteboardPermissionGuard = retainWhiteboardPlatformPermissionGuard()
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isWhiteboardPlatformPermissionRejection(event.reason)) return
    event.preventDefault()
    onPlatformPermissionDenied()
  }

  // Sentry installs its global rejection handler during app startup, before tldraw mounts.
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true)
  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true)
    releaseWhiteboardPermissionGuard()
  }
}

function isIncompatibleTldrawPasteError(error: unknown): boolean {
  return errorMessageIncludes(error, 'Could not put content: could not migrate content')
}

function installTldrawPasteMigrationGuard(
  editor: Editor,
  { onIncompatiblePaste }: WhiteboardRuntimeGuardOptions,
): () => void {
  const handleTldrawContent = (externalContent: Parameters<typeof defaultHandleExternalTldrawContent>[1]) =>
    defaultHandleExternalTldrawContent(editor, externalContent)

  editor.registerExternalContentHandler('tldraw', async (externalContent) => {
    try {
      await handleTldrawContent(externalContent)
    } catch (error) {
      if (!isIncompatibleTldrawPasteError(error)) throw error
      onIncompatiblePaste()
    }
  })

  return () => {
    editor.registerExternalContentHandler('tldraw', handleTldrawContent)
  }
}

function documentZoom(): number {
  const inlineZoom = document.documentElement.style.getPropertyValue('zoom')
  const computedZoom = getComputedStyle(document.documentElement).zoom
  const zoom = inlineZoom || computedZoom
  const parsed = Number.parseFloat(zoom)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return zoom.endsWith('%') ? parsed / 100 : parsed
}

function viewportBounds(screenBounds: Box | HTMLElement): Box | HTMLElement {
  if (screenBounds instanceof Box) return screenBounds

  const zoom = documentZoom()
  if (zoom === 1) return screenBounds

  const rect = screenBounds.getBoundingClientRect()
  return new Box(
    (rect.left || rect.x) / zoom,
    (rect.top || rect.y) / zoom,
    Math.max(rect.width / zoom, 1),
    Math.max(rect.height / zoom, 1),
  )
}

function zoomAdjustedPoint<T extends { x: number; y: number; z?: number }>(point: T, zoom: number): T {
  return {
    ...point,
    x: point.x / zoom,
    y: point.y / zoom,
  }
}

function zoomAdjustedEvent(info: TLEventInfo): TLEventInfo {
  const zoom = documentZoom()
  if (zoom === 1) return info

  switch (info.type) {
    case 'click':
    case 'pinch':
    case 'pointer':
    case 'wheel':
      return {
        ...info,
        point: zoomAdjustedPoint(info.point, zoom),
      } as TLEventInfo
    default:
      return info
  }
}

function installZoomAwareViewport(editor: Editor): () => void {
  const updateViewportScreenBounds = editor.updateViewportScreenBounds.bind(editor)
  const updateViewport: Editor['updateViewportScreenBounds'] = (screenBounds, center) =>
    updateViewportScreenBounds(viewportBounds(screenBounds), center)
  const dispatch = editor.dispatch.bind(editor)
  const animationFrameIds: number[] = []
  const timeoutIds: number[] = []

  editor.updateViewportScreenBounds = updateViewport
  editor.dispatch = (info: TLEventInfo) => dispatch(zoomAdjustedEvent(info))

  const updateCurrentCanvas = () => {
    const canvas = editor.getContainer().querySelector<HTMLElement>('.tl-canvas')
    if (canvas) updateViewport(canvas)
  }

  const scheduleViewportUpdate = () => {
    updateCurrentCanvas()
    animationFrameIds.push(window.requestAnimationFrame(updateCurrentCanvas))
    timeoutIds.push(window.setTimeout(updateCurrentCanvas, 150))
  }

  scheduleViewportUpdate()
  window.addEventListener('laputa-zoom-change', scheduleViewportUpdate)

  return () => {
    window.removeEventListener('laputa-zoom-change', scheduleViewportUpdate)
    animationFrameIds.forEach((id) => { window.cancelAnimationFrame(id) })
    timeoutIds.forEach((id) => { window.clearTimeout(id) })
    editor.updateViewportScreenBounds = updateViewportScreenBounds
    editor.dispatch = dispatch
  }
}

function syncTldrawIconWebkitMask(icon: HTMLElement): void {
  const mask = icon.style.getPropertyValue('mask').trim()
  if (!mask) {
    icon.style.removeProperty(WEBKIT_MASK_PROPERTY)
    return
  }

  if (icon.style.getPropertyValue(WEBKIT_MASK_PROPERTY).trim() === mask) return
  icon.style.setProperty(WEBKIT_MASK_PROPERTY, mask)
}

function syncTldrawIconWebkitMasks(root: HTMLElement): void {
  if (root.matches(TLDRAW_UI_ICON_SELECTOR)) syncTldrawIconWebkitMask(root)

  for (const icon of root.querySelectorAll<HTMLElement>(TLDRAW_UI_ICON_SELECTOR)) {
    syncTldrawIconWebkitMask(icon)
  }
}

function syncAddedTldrawIconMasks(node: Node): void {
  if (node instanceof HTMLElement) syncTldrawIconWebkitMasks(node)
}

function installTldrawWebkitIconMaskBridge(container: HTMLElement): () => void {
  syncTldrawIconWebkitMasks(container)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        syncTldrawIconWebkitMasks(mutation.target)
        continue
      }
      mutation.addedNodes.forEach(syncAddedTldrawIconMasks)
    }
  })

  observer.observe(container, {
    attributeFilter: ['class', 'style'],
    attributes: true,
    childList: true,
    subtree: true,
  })

  return () => { observer.disconnect() }
}

export function installWhiteboardRuntimeGuards(
  editor: Editor,
  options: WhiteboardRuntimeGuardOptions,
): () => void {
  const cleanupZoomAwareViewport = installZoomAwareViewport(editor)
  const cleanupWebkitIconMaskBridge = installTldrawWebkitIconMaskBridge(editor.getContainer())
  const cleanupPlatformPermissionGuard = installTldrawPlatformPermissionGuard(options)
  const cleanupPasteMigrationGuard = installTldrawPasteMigrationGuard(editor, options)

  return () => {
    cleanupPasteMigrationGuard()
    cleanupPlatformPermissionGuard()
    cleanupWebkitIconMaskBridge()
    cleanupZoomAwareViewport()
  }
}
