import { useCallback, useEffect, useRef } from 'react'
import { useEditorSaveWithLinks } from './useEditorSaveWithLinks'
import { needsRenameOnSave } from './useNoteRename'
import { flushEditorContent } from '../utils/autoSave'
import type { VaultEntry } from '../types'

interface TabState {
  entry: VaultEntry
  content: string
}

function findUnsavedFallback(
  tabs: TabState[], activeTabPath: string | null, unsavedPaths: Set<string>,
): { path: string; content: string } | undefined {
  const activeTab = tabs.find(t => t.entry.path === activeTabPath)
  if (!activeTab || !unsavedPaths.has(activeTab.entry.path)) return undefined
  return { path: activeTab.entry.path, content: activeTab.content }
}

function activeTabNeedsRename(tabs: TabState[], activeTabPath: string | null): { path: string; title: string } | null {
  const activeTab = tabs.find(t => t.entry.path === activeTabPath)
  if (!activeTab) return null
  return needsRenameOnSave(activeTab.entry.title, activeTab.entry.filename)
    ? { path: activeTab.entry.path, title: activeTab.entry.title }
    : null
}

interface AppSaveDeps {
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSaveWithLinks>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  loadModifiedFiles: () => void
  clearUnsaved: (path: string) => void
  unsavedPaths: Set<string>
  tabs: TabState[]
  activeTabPath: string | null
  handleRenameNote: (path: string, newTitle: string, vaultPath: string, onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void) => Promise<void>
  replaceEntry: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void
  resolvedPath: string
}

export function useAppSave({
  updateEntry, setTabs, setToastMessage,
  loadModifiedFiles, clearUnsaved, unsavedPaths,
  tabs, activeTabPath,
  handleRenameNote, replaceEntry, resolvedPath,
}: AppSaveDeps) {
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})

  const onAfterSave = useCallback(() => {
    loadModifiedFiles()
  }, [loadModifiedFiles])

  const onNotePersisted = useCallback((path: string) => {
    clearUnsaved(path)
  }, [clearUnsaved])

  const { handleSave: handleSaveRaw, handleContentChange, savePendingForPath, savePending } = useEditorSaveWithLinks({
    updateEntry, setTabs, setToastMessage, onAfterSave, onNotePersisted,
  })

  useEffect(() => { contentChangeRef.current = handleContentChange }, [handleContentChange])

  // Refs for stable closure in flushBeforeAction
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs // eslint-disable-line react-hooks/refs -- ref sync pattern
  const unsavedPathsRef = useRef(unsavedPaths)
  unsavedPathsRef.current = unsavedPaths // eslint-disable-line react-hooks/refs -- ref sync pattern

  const flushBeforeAction = useCallback(async (path: string) => {
    try {
      await flushEditorContent(path, {
        savePendingForPath,
        getTabContent: (p) => tabsRef.current.find(t => t.entry.path === p)?.content,
        isUnsaved: (p) => unsavedPathsRef.current.has(p),
        onSaved: (p) => { clearUnsaved(p) },
      })
    } catch (err) {
      setToastMessage(`Auto-save failed: ${err}`)
      throw err
    }
  }, [savePendingForPath, clearUnsaved, setToastMessage])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    await savePendingForPath(path)
    await handleRenameNote(path, newTitle, resolvedPath, replaceEntry).then(loadModifiedFiles)
  }, [handleRenameNote, resolvedPath, replaceEntry, savePendingForPath, loadModifiedFiles])

  const handleSave = useCallback(async () => {
    await handleSaveRaw(findUnsavedFallback(tabs, activeTabPath, unsavedPaths))
    const rename = activeTabNeedsRename(tabs, activeTabPath)
    if (rename) await handleRenameTab(rename.path, rename.title)
  }, [handleSaveRaw, handleRenameTab, tabs, activeTabPath, unsavedPaths])

  const handleTitleSync = useCallback((path: string, newTitle: string) => {
    savePendingForPath(path)
      .then(() => handleRenameNote(path, newTitle, resolvedPath, replaceEntry))
      .then(loadModifiedFiles)
      .catch((err) => console.error('Title rename failed:', err))
  }, [handleRenameNote, resolvedPath, replaceEntry, savePendingForPath, loadModifiedFiles])

  return {
    contentChangeRef,
    handleContentChange,
    handleSave,
    handleTitleSync,
    savePending,
    savePendingForPath,
    flushBeforeAction,
  }
}
