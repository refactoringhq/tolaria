import { useCallback, useEffect, useRef } from 'react'
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
 * Hook that manages editor content persistence with auto-save.
 * Content is auto-saved 500ms after the last edit. Cmd+S flushes immediately.
 */
const noop = () => {}

const AUTO_SAVE_DEBOUNCE_MS = 500

export function useEditorSave({ updateVaultContent, setTabs, setToastMessage, onAfterSave = noop, onNotePersisted }: EditorSaveConfig) {
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Stable ref for onAfterSave so the auto-save timer closure always calls the latest version
  const onAfterSaveRef = useRef(onAfterSave)
  useEffect(() => { onAfterSaveRef.current = onAfterSave }, [onAfterSave])

  /** Cancel any pending auto-save timer. */
  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  /** Called by Cmd+S — persists the current editor content to disk.
   *  Accepts optional fallback for unsaved notes with no pending edits. */
  const handleSave = useCallback(async (unsavedFallback?: { path: string; content: string }) => {
    cancelAutoSave()
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
  }, [cancelAutoSave, flushPending, setToastMessage, onAfterSave, saveNote, onNotePersisted])

  /** Called by Editor onChange — buffers the latest content, syncs tab state,
   *  and schedules an auto-save after 500ms of inactivity. */
  const handleContentChange = useCallback((path: string, content: string) => {
    pendingContentRef.current = { path, content }
    setTabs((prev: Tab[]) =>
      prev.map((t) => t.entry.path === path ? { ...t, content } : t)
    )
    cancelAutoSave()
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null
      try {
        const saved = await flushPending()
        if (saved) onAfterSaveRef.current()
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, AUTO_SAVE_DEBOUNCE_MS)
  }, [setTabs, cancelAutoSave, flushPending])

  // Clear auto-save timer on unmount
  useEffect(() => () => cancelAutoSave(), [cancelAutoSave])

  /** Save pending content for a specific path (used before rename / tab close) */
  const savePendingForPath = useCallback(
    (path: string): Promise<boolean> => { cancelAutoSave(); return flushPending(path) },
    [cancelAutoSave, flushPending],
  )

  /** Flush any pending content to disk silently (used before git commit).
   * Does NOT call onAfterSave — callers manage their own refresh. */
  const savePending = useCallback((): Promise<boolean> => { cancelAutoSave(); return flushPending() }, [cancelAutoSave, flushPending])

  return { handleSave, handleContentChange, savePendingForPath, savePending }
}
