import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { WebRoute } from '../utils/webRoute'
import { publishPhoneNoteStack } from './phoneNoteStackStore'
import { useKeyboardAwareViewport } from './useKeyboardAwareViewport'
import { usePhoneLayout } from './usePhoneLayout'

/** Set on a history entry pushed while leaving the note list (useWebRouting). */
export const BACK_TO_NOTE_LIST_STATE_KEY = 'tolariaBackToNoteList'
/** On `<html>` while the phone layout is active; App.css lays the panes out from it. */
export const PHONE_PANE_ATTRIBUTE = 'data-phone-pane'

export type PhonePane = 'list' | 'note'

/** The phone web layout (TOL-193): the note list, then the note, one pane at a time. */
export interface PhoneNoteStack {
  active: boolean
  pane: PhonePane
  /** The in-app back control. */
  backToList: () => void
  showNote: () => void
}

/** What useWebRouting needs: the URL names no note while the phone shows the list. */
export interface NoteListPane {
  shown: boolean
  show: (shown: boolean) => void
}

interface PhoneNoteStackOptions {
  activeNotePath: string | null
  enabled: boolean
  initialRoute: WebRoute | null
  /** The last open note was restored: from here an opened note is shown. */
  ready: boolean
}

function enteredFromNoteList(): boolean {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && Reflect.get(state, BACK_TO_NOTE_LIST_STATE_KEY) === true
}

/** A note opened after startup (list, wikilink, search, back/forward) takes the screen. */
function useShowOpenedNote(activeNotePath: string | null, ready: boolean, showNote: () => void): void {
  const seenPathRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!ready) return
    const seenPath = seenPathRef.current
    seenPathRef.current = activeNotePath
    if (seenPath !== undefined && activeNotePath && seenPath !== activeNotePath) showNote()
  }, [activeNotePath, ready, showNote])
}

/** Back on the list, the hidden editor lets go of focus, so the phone keyboard closes. */
function useBlurHiddenEditor(listShown: boolean): void {
  useEffect(() => {
    if (!listShown) return
    const focused = document.activeElement
    if (focused instanceof HTMLElement && focused.closest('.app__editor')) focused.blur()
  }, [listShown])
}

/** Marks the page before it paints, so the phone never shows the three panes first. */
function usePhonePaneAttribute(pane: PhonePane | null): void {
  useLayoutEffect(() => {
    if (!pane) return
    const root = document.documentElement
    root.setAttribute(PHONE_PANE_ATTRIBUTE, pane)
    return () => { root.removeAttribute(PHONE_PANE_ATTRIBUTE) }
  }, [pane])
}

function usePublishedControls(stack: PhoneNoteStack): void {
  const { active, backToList, showNote } = stack
  useLayoutEffect(() => {
    if (!active) return
    publishPhoneNoteStack({ active, backToList, showNote })
    return () => { publishPhoneNoteStack(null) }
  }, [active, backToList, showNote])
}

function noteListPaneFor(active: boolean, shown: boolean, show: (shown: boolean) => void): NoteListPane | undefined {
  return active ? { shown, show } : undefined
}

/**
 * Phone-width web layout: the list comes first, unless the opening URL names a note. The
 * restored last note stays open behind the list so tapping it is instant. Back, in the app or
 * the browser, returns to the list through the history entry the list pushed.
 */
export function usePhoneNoteStack({ activeNotePath, enabled, initialRoute, ready }: PhoneNoteStackOptions): {
  noteListPane: NoteListPane | undefined
  stack: PhoneNoteStack
} {
  const active = usePhoneLayout(enabled)
  const [listShown, setListShown] = useState(() => !initialRoute?.note)
  const showNote = useCallback(() => { setListShown(false) }, [])
  const backToList = useCallback(() => {
    if (enteredFromNoteList()) window.history.back()
    else setListShown(true)
  }, [])
  useShowOpenedNote(activeNotePath, enabled && ready, showNote)
  useKeyboardAwareViewport(active)

  const shown = listShown || !activeNotePath
  const pane: PhonePane = shown ? 'list' : 'note'
  const stack: PhoneNoteStack = { active, pane, backToList, showNote }
  useBlurHiddenEditor(active && shown)
  usePhonePaneAttribute(active ? pane : null)
  usePublishedControls(stack)
  return { noteListPane: noteListPaneFor(active, shown, setListShown), stack }
}
