import { useCallback } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { useTabManagement } from './useTabManagement'
import { resolveEntry } from '../utils/wikilink'
import { useNoteCreation } from './useNoteCreation'
import {
  useNoteRename,
  performRename, loadNoteContent, renameToastMessage, reloadTabsAfterRename,
} from './useNoteRename'
import { runFrontmatterAndApply, type FrontmatterOpOptions } from './frontmatterOps'

export interface NoteActionsConfig {
  addEntry: (entry: VaultEntry) => void
  removeEntry: (path: string) => void
  entries: VaultEntry[]
  setToastMessage: (msg: string | null) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  vaultPath: string
  addPendingSave?: (path: string) => void
  removePendingSave?: (path: string) => void
  trackUnsaved?: (path: string) => void
  clearUnsaved?: (path: string) => void
  unsavedPaths?: Set<string>
  markContentPending?: (path: string, content: string) => void
  onNewNotePersisted?: () => void
  replaceEntry?: (oldPath: string, patch: Partial<VaultEntry> & { path: string }) => void
  /** Called after frontmatter is written to disk — used for live-reloading theme CSS vars. */
  onFrontmatterContentChanged?: (path: string, content: string) => void
}

function isTitleKey(key: string): boolean {
  return key.toLowerCase().replace(/\s+/g, '_') === 'title'
}

interface TitleRenameDeps {
  vaultPath: string
  tabsRef: React.MutableRefObject<{ entry: VaultEntry; content: string }[]>
  replaceEntry?: (oldPath: string, patch: Partial<VaultEntry> & { path: string }) => void
  setTabs: React.Dispatch<React.SetStateAction<{ entry: VaultEntry; content: string }[]>>
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  setToastMessage: (msg: string | null) => void
  updateTabContent: (path: string, content: string) => void
}

async function renameAfterTitleChange(path: string, newTitle: string, deps: TitleRenameDeps): Promise<void> {
  const oldTitle = deps.tabsRef.current.find(t => t.entry.path === path)?.entry.title
  const result = await performRename(path, newTitle, deps.vaultPath, oldTitle)
  if (result.new_path !== path) {
    const newFilename = result.new_path.split('/').pop() ?? ''
    deps.replaceEntry?.(path, { path: result.new_path, filename: newFilename, title: newTitle } as Partial<VaultEntry> & { path: string })
    const newContent = await loadNoteContent(result.new_path)
    deps.setTabs(prev => prev.map(t => t.entry.path === path
      ? { entry: { ...t.entry, path: result.new_path, filename: newFilename, title: newTitle }, content: newContent }
      : t))
    if (deps.activeTabPathRef.current === path) deps.handleSwitchTab(result.new_path)
    const otherTabPaths = deps.tabsRef.current.filter(t => t.entry.path !== path && t.entry.path !== result.new_path).map(t => t.entry.path)
    await reloadTabsAfterRename(otherTabPaths, deps.updateTabContent)
  }
  deps.setToastMessage(renameToastMessage(result.updated_files))
}

function shouldRenameOnTitleUpdate(key: string, value: FrontmatterValue): value is string {
  return isTitleKey(key) && typeof value === 'string' && value !== ''
}

function navigateWikilink(entries: VaultEntry[], target: string, selectNote: (e: VaultEntry) => void): void {
  const found = resolveEntry(entries, target)
  if (found) selectNote(found)
  else console.warn(`Navigation target not found: ${target}`)
}

export function useNoteActions(config: NoteActionsConfig) {
  const { entries, setToastMessage, updateEntry } = config
  const tabMgmt = useTabManagement()
  const { setTabs, handleSelectNote, openTabWithContent, activeTabPathRef, handleSwitchTab } = tabMgmt

  const updateTabContent = useCallback((path: string, newContent: string) => {
    setTabs((prev) => prev.map((t) => t.entry.path === path ? { ...t, content: newContent } : t))
  }, [setTabs])

  const creation = useNoteCreation(config, { openTabWithContent, handleSelectNote })
  const rename = useNoteRename(
    { entries, setToastMessage },
    { tabs: tabMgmt.tabs, setTabs, activeTabPathRef, handleSwitchTab, updateTabContent },
  )

  const handleNavigateWikilink = useCallback(
    (target: string) => navigateWikilink(entries, target, handleSelectNote),
    [entries, handleSelectNote],
  )

  const runFrontmatterOp = useCallback(
    (op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue, options?: FrontmatterOpOptions) =>
      runFrontmatterAndApply(op, path, key, value, { updateTab: updateTabContent, updateEntry, toast: setToastMessage, getEntry: (p) => entries.find((e) => e.path === p) }, options),
    [updateTabContent, updateEntry, setToastMessage, entries],
  )

  return {
    ...tabMgmt,
    handleNavigateWikilink,
    handleCreateNote: creation.handleCreateNote,
    handleCreateNoteImmediate: creation.handleCreateNoteImmediate,
    handleCreateNoteForRelationship: creation.handleCreateNoteForRelationship,
    handleOpenDailyNote: creation.handleOpenDailyNote,
    handleCreateType: creation.handleCreateType,
    createTypeEntrySilent: creation.createTypeEntrySilent,
    handleUpdateFrontmatter: useCallback(async (path: string, key: string, value: FrontmatterValue, options?: FrontmatterOpOptions) => {
      const newContent = await runFrontmatterOp('update', path, key, value, options)
      if (newContent) config.onFrontmatterContentChanged?.(path, newContent)
      if (shouldRenameOnTitleUpdate(key, value)) {
        try {
          await renameAfterTitleChange(path, value, {
            vaultPath: config.vaultPath, tabsRef: rename.tabsRef, replaceEntry: config.replaceEntry,
            setTabs, activeTabPathRef, handleSwitchTab, setToastMessage, updateTabContent,
          })
        } catch (err) {
          console.error('Failed to rename note after title change:', err)
        }
      }
    }, [runFrontmatterOp, config, rename.tabsRef, setTabs, activeTabPathRef, handleSwitchTab, setToastMessage, updateTabContent]),
    handleDeleteProperty: useCallback(async (path: string, key: string, options?: FrontmatterOpOptions) => {
      const newContent = await runFrontmatterOp('delete', path, key, undefined, options)
      if (newContent) config.onFrontmatterContentChanged?.(path, newContent)
    }, [runFrontmatterOp, config]),
    handleAddProperty: useCallback(async (path: string, key: string, value: FrontmatterValue) => {
      const newContent = await runFrontmatterOp('update', path, key, value)
      if (newContent) config.onFrontmatterContentChanged?.(path, newContent)
    }, [runFrontmatterOp, config]),
    handleRenameNote: rename.handleRenameNote,
  }
}
