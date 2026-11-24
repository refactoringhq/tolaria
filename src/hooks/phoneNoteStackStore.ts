import { useCallback, useSyncExternalStore } from 'react'
import type { VaultEntry } from '../types'

/**
 * What the phone layout (TOL-193) tells the panes it does not render: whether it is active,
 * the way back to the list, and how to show a note. Published by usePhoneNoteStack, read by
 * the editor pane's back bar and the note list.
 */
export interface PhoneNoteStackControls {
  active: boolean
  backToList: () => void
  showNote: () => void
}

type NoteOpener = (entry: VaultEntry) => unknown

function ignore(): void {
  // Nothing to do off the phone layout.
}

const INACTIVE: PhoneNoteStackControls = { active: false, backToList: ignore, showNote: ignore }

let current = INACTIVE
const listeners = new Set<() => void>()

export function publishPhoneNoteStack(controls: PhoneNoteStackControls | null): void {
  current = controls ?? INACTIVE
  listeners.forEach((listener) => { listener() })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function snapshot(): PhoneNoteStackControls {
  return current
}

export function usePhoneNoteStackControls(): PhoneNoteStackControls {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** The list's opener; on the phone a tapped note is then shown, the already open one included. */
export function usePhoneNoteOpener<T extends NoteOpener>(open: T): T | NoteOpener {
  const { active, showNote } = usePhoneNoteStackControls()
  const openAndShow = useCallback(async (entry: VaultEntry) => {
    await open(entry)
    showNote()
  }, [open, showNote])
  return active ? openAndShow : open
}
