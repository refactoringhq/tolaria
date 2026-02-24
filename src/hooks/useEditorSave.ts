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
  onAfterSave?: () => void
  onNoteSaved?: (path: string) => void
}

/**
 * Hook that manages explicit save (Cmd+S) for editor content.
 * Tracks pending (unsaved) content and provides save + pre-rename helpers.
 */
const noop = () => {}

export function useEditorSave({ updateVaultContent, setTabs, setToastMessage, onAfterSave = noop, onNoteSaved }: EditorSaveConfig) {
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null)

  const updateTabAndContent = useCallback((path: string, content: string) => {
    updateVaultContent(path, content)
    setTabs((prev: Tab[]) =>
      prev.map((t) => t.entry.path === path ? { ...t, content } : t)
    )
  }, [updateVaultContent, setTabs])

  const { saveNote } = useSaveNote(updateTabAndContent)

  /** Persist pending content matching an optional path filter; returns true if saved */
  const flushPending = useCallback(async (pathFilter?: string): Promise<boolean> => {
    const pending = pendingContentRef.current
    if (!pending) return false
    if (pathFilter && pending.path !== pathFilter) return false
    await saveNote(pending.path, pending.content)
    pendingContentRef.current = null
    onNoteSaved?.(pending.path)
    return true
  }, [saveNote, onNoteSaved])

  /** Called by Cmd+S — persists the current editor content to disk */
  const handleSave = useCallback(async () => {
    try {
      const saved = await flushPending()
      setToastMessage(saved ? 'Saved' : 'Nothing to save')
      onAfterSave()
    } catch (err) {
      console.error('Save failed:', err)
      setToastMessage(`Save failed: ${err}`)
    }
  }, [flushPending, setToastMessage, onAfterSave])

  /** Called by Editor onChange — buffers the latest content without saving */
  const handleContentChange = useCallback((path: string, content: string) => {
    pendingContentRef.current = { path, content }
  }, [])

  /** Save pending content for a specific path (used before rename) */
  const savePendingForPath = useCallback(
    (path: string): Promise<boolean> => flushPending(path),
    [flushPending],
  )

  /** Flush any pending content to disk silently (used before git commit).
   * Does NOT call onAfterSave — callers manage their own refresh. */
  const savePending = useCallback((): Promise<boolean> => flushPending(), [flushPending])

  return { handleSave, handleContentChange, savePendingForPath, savePending }
}
