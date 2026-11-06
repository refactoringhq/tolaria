import { useCallback, useState } from 'react'
import type { EditorEditingMode } from './TabletEditorPanel.types'

type NoteEditorModeState = {
  noteId: string | undefined
  mode: EditorEditingMode
}

export function useNoteEditorMode(noteId: string | undefined, initialMode: EditorEditingMode) {
  const [state, setState] = useState<NoteEditorModeState>(() => ({ noteId, mode: initialMode }))
  if (state.noteId !== noteId) setState({ noteId, mode: initialMode })

  const mode = state.noteId === noteId ? state.mode : initialMode
  const toggle = useCallback(() => setState(current => ({
    ...current,
    mode: current.mode === 'source' ? 'wysiwyg' : 'source',
  })), [])

  return { mode, toggle }
}
