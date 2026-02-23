import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, updateMockContent } from '../mock-tauri'

async function persistContent(path: string, content: string): Promise<void> {
  if (isTauri()) {
    await invoke('save_note_content', { path, content })
  } else {
    await mockInvoke('save_note_content', { path, content })
  }
}

/**
 * Hook that provides an explicit save function for note content.
 * Called on Cmd+S — no debounce, no auto-save.
 *
 * @param updateContent - callback to also update in-memory state after save
 */
export function useSaveNote(updateContent: (path: string, content: string) => void) {
  const saveNote = useCallback(async (path: string, content: string) => {
    await persistContent(path, content)
    if (!isTauri()) {
      updateMockContent(path, content)
    }
    updateContent(path, content)
  }, [updateContent])

  return { saveNote }
}
