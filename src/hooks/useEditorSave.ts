import { useCallback, useRef } from 'react'
import type { SetStateAction } from 'react'
import { useSaveNote } from './useSaveNote'

interface Tab {
  entry: { path: string }
  content: string
}

interface EditorSaveConfig {
  updateVaultContent: (path: string, content: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tab types vary between layers
  setTabs: (fn: SetStateAction<any[]>) => void
  setToastMessage: (msg: string | null) => void
}

/**
 * Hook that manages explicit save (Cmd+S) for editor content.
 * Tracks pending (unsaved) content and provides save + pre-rename helpers.
 */
export function useEditorSave({ updateVaultContent, setTabs, setToastMessage }: EditorSaveConfig) {
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null)

  const updateTabAndContent = useCallback((path: string, content: string) => {
    updateVaultContent(path, content)
    setTabs((prev: Tab[]) =>
      prev.map((t) => t.entry.path === path ? { ...t, content } : t)
    )
  }, [updateVaultContent, setTabs])

  const { saveNote } = useSaveNote(updateTabAndContent)

  /** Called by Cmd+S — persists the current editor content to disk */
  const handleSave = useCallback(async () => {
    const pending = pendingContentRef.current
    if (!pending) {
      setToastMessage('Nothing to save')
      return
    }
    try {
      await saveNote(pending.path, pending.content)
      pendingContentRef.current = null
      setToastMessage('Saved')
    } catch (err) {
      console.error('Save failed:', err)
      setToastMessage(`Save failed: ${err}`)
    }
  }, [saveNote, setToastMessage])

  /** Called by Editor onChange — buffers the latest content without saving */
  const handleContentChange = useCallback((path: string, content: string) => {
    pendingContentRef.current = { path, content }
  }, [])

  /** Save pending content for a specific path (used before rename) */
  const savePendingForPath = useCallback(async (path: string): Promise<void> => {
    const pending = pendingContentRef.current
    if (pending && pending.path === path) {
      await saveNote(pending.path, pending.content)
      pendingContentRef.current = null
    }
  }, [saveNote])

  return { handleSave, handleContentChange, savePendingForPath }
}
