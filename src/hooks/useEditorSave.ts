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
  /** Called after content is persisted — used to clear unsaved state and live-reload themes. */
  onNotePersisted?: (path: string, content: string) => void
}

/**
 * Hook that manages explicit save (Cmd+S) for editor content.
 * Tracks pending (unsaved) content and provides save + pre-rename helpers.
 */
const noop = () => {}

export function useEditorSave({ updateVaultContent, setTabs, setToastMessage, onAfterSave = noop, onNotePersisted }: EditorSaveConfig) {
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
    const savedContent = pending.content
    pendingContentRef.current = null
    onNotePersisted?.(pending.path, savedContent)
    return true
  }, [saveNote, onNotePersisted])

  /** Called by Cmd+S — persists the current editor content to disk.
   *  Accepts optional fallback for unsaved notes with no pending edits. */
  const handleSave = useCallback(async (unsavedFallback?: { path: string; content: string }) => {
    try {
      const saved = await flushPending()
      if (!saved && unsavedFallback) {
        await saveNote(unsavedFallback.path, unsavedFallback.content)
        onNotePersisted?.(unsavedFallback.path, unsavedFallback.content)
        setToastMessage('Saved')
        onAfterSave()
        return
      }
      setToastMessage(saved ? 'Saved' : 'Nothing to save')
      onAfterSave()
    } catch (err) {
      console.error('Save failed:', err)
      setToastMessage(`Save failed: ${err}`)
    }
  }, [flushPending, setToastMessage, onAfterSave, saveNote, onNotePersisted])

  /** Called by Editor onChange — buffers the latest content and syncs tab state
   *  so consumers (e.g. AI panel) always see current editor content. */
  const handleContentChange = useCallback((path: string, content: string) => {
    pendingContentRef.current = { path, content }
    setTabs((prev: Tab[]) =>
      prev.map((t) => t.entry.path === path ? { ...t, content } : t)
    )
  }, [setTabs])

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
