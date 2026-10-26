import { useEffect } from 'react'
import { focusEditorWithRetries, type FocusableEditor } from './editorFocusUtils'
import { resumeEditorFocus } from './editorFocusOwnership'

const TAB_SWAP_EVENT_NAME = 'laputa:editor-tab-swapped'
const FOCUS_EVENT_NAME = 'laputa:focus-editor'
const SWAP_WAIT_FALLBACK_MS = 250
const FOCUS_STABILITY_CHECK_DELAYS_MS = [160, 500, 1_000, 2_000, 4_000] as const

export interface FocusEventDetail {
  t0?: number
  selectTitle?: boolean
  path?: string | null
}

interface PendingFocusRequest {
  id: number
  detail: FocusEventDetail
}

const PENDING_FOCUS_TTL_MS = 6_000
let nextFocusRequestId = 0
let pendingFocusRequest: PendingFocusRequest | null = null

function rememberPendingFocusRequest(detail: FocusEventDetail): PendingFocusRequest | null {
  if (!detail.path) return null
  const request = { id: ++nextFocusRequestId, detail }
  pendingFocusRequest = request
  window.setTimeout(() => {
    if (pendingFocusRequest?.id === request.id) pendingFocusRequest = null
  }, PENDING_FOCUS_TTL_MS)
  return request
}

function clearPendingFocusRequest(path: string): void {
  if (pendingFocusRequest?.detail.path === path) pendingFocusRequest = null
}

const TRIGGER_CONTROL_SELECTOR = 'button, [role="button"], [role="menuitem"]'

/**
 * A new note takes the keyboard from the control that created it at once. A remote note opens
 * its live document before its editor can take focus; until then a space or Enter typed for the
 * title would press that control again and create another note.
 */
function releaseTriggerControlFocus(): void {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement && activeElement.matches(TRIGGER_CONTROL_SELECTOR)) {
    activeElement.blur()
  }
}

export function requestEditorFocus(detail: FocusEventDetail): void {
  if (detail.path && detail.selectTitle) releaseTriggerControlFocus()
  rememberPendingFocusRequest(detail)
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(FOCUS_EVENT_NAME, { detail }))
  }, 0)
}

interface EditorFocusContext {
  editor: FocusableEditor,
  editorMountedRef: React.RefObject<boolean>,
  selectTitle: boolean,
  t0: number | undefined,
}

function scheduleEditorFocus(context: EditorFocusContext, onFocused?: () => void): void {
  const { editor, editorMountedRef, selectTitle, t0 } = context
  const focus = () => {
    focusEditorWithRetries(editor, selectTitle, t0)
    if (editorHasFocus()) onFocused?.()
  }
  if (editorMountedRef.current) {
    requestAnimationFrame(focus)
    return
  }
  setTimeout(focus, 80)
}

function focusReturnedToDocumentChrome(): boolean {
  const activeElement = document.activeElement
  return activeElement === null
    || activeElement === document.body
    || activeElement === document.documentElement
}

function editorHasFocus(): boolean {
  const activeElement = document.activeElement
  return activeElement instanceof Element
    && (Reflect.get(activeElement, 'isContentEditable') === true
      || activeElement.closest('[contenteditable="true"]') !== null)
}

interface FocusStabilityOptions {
  context: EditorFocusContext
  targetPath: string
  pendingCleanups: Set<() => void>
}

function scheduleFocusStabilityChecks(options: FocusStabilityOptions): void {
  const { context, targetPath, pendingCleanups } = options
  for (const delay of FOCUS_STABILITY_CHECK_DELAYS_MS) {
    let timeoutId = 0
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      pendingCleanups.delete(cleanup)
    }
    timeoutId = window.setTimeout(() => {
      pendingCleanups.delete(cleanup)
      if (editorHasFocus()) {
        clearPendingFocusRequest(targetPath)
        return
      }
      if (!focusReturnedToDocumentChrome()) return
      resumeEditorFocus()
      focusEditorWithRetries(context.editor, context.selectTitle, context.t0)
      if (editorHasFocus()) clearPendingFocusRequest(targetPath)
    }, delay)
    pendingCleanups.add(cleanup)
  }
}

interface TargetFocusOptions {
  context: EditorFocusContext
  detail: FocusEventDetail
  targetPath: string
  pendingCleanups: Set<() => void>
}

function handleTargetFocusRequest(options: TargetFocusOptions): void {
  const { context, detail, targetPath, pendingCleanups } = options
  if (pendingFocusRequest?.detail.path !== targetPath) rememberPendingFocusRequest(detail)
  const scheduleFocus = () => {
    if (editorHasFocus()) {
      clearPendingFocusRequest(targetPath)
      return
    }
    resumeEditorFocus()
    scheduleEditorFocus(context, () => clearPendingFocusRequest(targetPath))
    scheduleFocusStabilityChecks({ context, targetPath, pendingCleanups })
  }
  registerPendingTabFocus(targetPath, scheduleFocus, pendingCleanups)
}

function registerPendingTabFocus(
  targetPath: string,
  scheduleFocus: () => void,
  pendingCleanups: Set<() => void>,
): void {
  const handleTabSwap = (event: Event) => {
    const swapPath = (event as CustomEvent).detail?.path
    if (swapPath !== targetPath) return
    cleanupPending()
    scheduleFocus()
  }

  const fallbackTimer = window.setTimeout(() => {
    cleanupPending()
    scheduleFocus()
  }, SWAP_WAIT_FALLBACK_MS)

  const cleanupPending = () => {
    window.clearTimeout(fallbackTimer)
    window.removeEventListener(TAB_SWAP_EVENT_NAME, handleTabSwap)
    pendingCleanups.delete(cleanupPending)
  }

  pendingCleanups.add(cleanupPending)
  window.addEventListener(TAB_SWAP_EVENT_NAME, handleTabSwap)
}

/**
 * Focus editor when a new note is created (signaled via custom event).
 * Uses adaptive timing: fast rAF path when editor is already mounted,
 * short timeout when waiting for first mount.
 * When selectTitle is true, also selects all text in the first H1 block.
 */
export function useEditorFocus(
  editor: FocusableEditor,
  editorMountedRef: React.RefObject<boolean>,
) {
  useEffect(() => {
    const pendingCleanups = new Set<() => void>()

    const handleFocusRequest = (detail: FocusEventDetail | undefined) => {
      const t0 = detail?.t0
      const selectTitle = detail?.selectTitle ?? false
      const targetPath = detail?.path ?? null
      const context = { editor, editorMountedRef, selectTitle, t0 }

      if (!targetPath) {
        scheduleEditorFocus(context)
        return
      }
      handleTargetFocusRequest({ context, detail: detail ?? {}, targetPath, pendingCleanups })
    }

    const handler = (e: Event) => {
      handleFocusRequest((e as CustomEvent).detail as FocusEventDetail | undefined)
    }

    window.addEventListener(FOCUS_EVENT_NAME, handler)
    if (pendingFocusRequest) handleFocusRequest(pendingFocusRequest.detail)
    return () => {
      window.removeEventListener(FOCUS_EVENT_NAME, handler)
      for (const cleanup of pendingCleanups) {
        cleanup()
      }
      pendingCleanups.clear()
    }
  }, [editor, editorMountedRef])
}
