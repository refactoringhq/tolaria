import { useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, addMockEntry, updateMockContent } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { useTabManagement } from './useTabManagement'
import { updateMockFrontmatter, deleteMockFrontmatterProperty } from './mockFrontmatterHelpers'

interface NewEntryParams {
  path: string
  slug: string
  title: string
  type: string
  status: string | null
}

interface RenameResult {
  new_path: string
  updated_files: number
}

export interface NoteActionsConfig {
  addEntry: (entry: VaultEntry, content: string) => void
  removeEntry: (path: string) => void
  updateContent: (path: string, content: string) => void
  entries: VaultEntry[]
  setToastMessage: (msg: string | null) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
}

async function performRename(
  path: string,
  newTitle: string,
  vaultPath: string,
): Promise<RenameResult> {
  if (isTauri()) {
    return invoke<RenameResult>('rename_note', { vaultPath, oldPath: path, newTitle })
  }
  return mockInvoke<RenameResult>('rename_note', { vault_path: vaultPath, old_path: path, new_title: newTitle })
}

function buildRenamedEntry(entry: VaultEntry, newTitle: string, newPath: string): VaultEntry {
  const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return { ...entry, path: newPath, filename: `${slug}.md`, title: newTitle }
}

async function loadNoteContent(path: string): Promise<string> {
  return isTauri()
    ? invoke<string>('get_note_content', { path })
    : mockInvoke<string>('get_note_content', { path })
}

/** Persist a newly created note to disk. Returns a Promise for error handling. */
function persistNewNote(path: string, content: string): Promise<void> {
  if (!isTauri()) return Promise.resolve()
  return invoke<void>('save_note_content', { path, content }).then(() => {})
}

export function buildNewEntry({ path, slug, title, type, status }: NewEntryParams): VaultEntry {
  const now = Math.floor(Date.now() / 1000)
  return {
    path, filename: `${slug}.md`, title, isA: type,
    aliases: [], belongsTo: [], relatedTo: [],
    status, owner: null, cadence: null, archived: false, trashed: false, trashedAt: null,
    modifiedAt: now, createdAt: now, fileSize: 0,
    snippet: '', relationships: {}, icon: null, color: null, order: null, outgoingLinks: [],
  }
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Generate a unique "Untitled <type>" name by checking existing entries and pending names. */
export function generateUntitledName(entries: VaultEntry[], type: string, pending?: Set<string>): string {
  const baseName = `Untitled ${type.toLowerCase()}`
  const existingTitles = new Set(entries.map(e => e.title))
  if (pending) pending.forEach(n => existingTitles.add(n))
  let title = baseName
  let counter = 2
  while (existingTitles.has(title)) {
    title = `${baseName} ${counter}`
    counter++
  }
  return title
}

export function entryMatchesTarget(e: VaultEntry, targetLower: string, targetAsWords: string): boolean {
  if (e.title.toLowerCase() === targetLower) return true
  if (e.aliases.some((a) => a.toLowerCase() === targetLower)) return true
  const pathStem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
  if (pathStem.toLowerCase() === targetLower) return true
  const fileStem = e.filename.replace(/\.md$/, '')
  if (fileStem.toLowerCase() === targetLower.split('/').pop()) return true
  return e.title.toLowerCase() === targetAsWords
}

async function invokeFrontmatter(command: string, args: Record<string, unknown>): Promise<string> {
  return invoke<string>(command, args)
}

function applyMockFrontmatterUpdate(path: string, key: string, value: FrontmatterValue): string {
  const content = updateMockFrontmatter(path, key, value)
  updateMockContent(path, content)
  return content
}

function applyMockFrontmatterDelete(path: string, key: string): string {
  const content = deleteMockFrontmatterProperty(path, key)
  updateMockContent(path, content)
  return content
}

const TYPE_FOLDER_MAP: Record<string, string> = {
  Note: 'note', Project: 'project', Experiment: 'experiment',
  Responsibility: 'responsibility', Procedure: 'procedure',
  Person: 'person', Event: 'event', Topic: 'topic',
}

const NO_STATUS_TYPES = new Set(['Topic', 'Person'])

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  icon: { icon: null }, owner: { owner: null }, cadence: { cadence: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  archived: { archived: false }, trashed: { trashed: false }, order: { order: null },
}

/** Map a frontmatter key+value to the corresponding VaultEntry field(s). */
export function frontmatterToEntryPatch(
  op: 'update' | 'delete', key: string, value?: FrontmatterValue,
): Partial<VaultEntry> {
  const k = key.toLowerCase().replace(/\s+/g, '_')
  if (op === 'delete') return ENTRY_DELETE_MAP[k] ?? {}
  const str = value != null ? String(value) : null
  const arr = Array.isArray(value) ? value.map(String) : []
  const updates: Record<string, Partial<VaultEntry>> = {
    type: { isA: str }, is_a: { isA: str }, status: { status: str }, color: { color: str },
    icon: { icon: str }, owner: { owner: str }, cadence: { cadence: str },
    aliases: { aliases: arr }, belongs_to: { belongsTo: arr }, related_to: { relatedTo: arr },
    archived: { archived: Boolean(value) }, trashed: { trashed: Boolean(value) },
    order: { order: typeof value === 'number' ? value : null },
  }
  return updates[k] ?? {}
}

function addEntryWithMock(entry: VaultEntry, content: string, addEntry: (e: VaultEntry, c: string) => void) {
  if (!isTauri()) addMockEntry(entry, content)
  addEntry(entry, content)
}

export function buildNoteContent(title: string, type: string, status: string | null): string {
  const lines = ['---', `title: ${title}`, `type: ${type}`]
  if (status) lines.push(`status: ${status}`)
  lines.push('---')
  return `${lines.join('\n')}\n\n# ${title}\n\n`
}

export function resolveNewNote(title: string, type: string): { entry: VaultEntry; content: string } {
  const folder = TYPE_FOLDER_MAP[type] || slugify(type)
  const slug = slugify(title)
  const status = NO_STATUS_TYPES.has(type) ? null : 'Active'
  const entry = buildNewEntry({ path: `/Users/luca/Laputa/${folder}/${slug}.md`, slug, title, type, status })
  return { entry, content: buildNoteContent(title, type, status) }
}

export function resolveNewType(typeName: string): { entry: VaultEntry; content: string } {
  const slug = slugify(typeName)
  const entry = buildNewEntry({ path: `/Users/luca/Laputa/type/${slug}.md`, slug, title: typeName, type: 'Type', status: null })
  return { entry, content: `---\ntype: Type\n---\n\n# ${typeName}\n\n` }
}

function findWikilinkTarget(entries: VaultEntry[], target: string): VaultEntry | undefined {
  const targetLower = target.toLowerCase()
  const targetAsWords = target.split('/').pop()?.replace(/-/g, ' ').toLowerCase() ?? targetLower
  return entries.find((e) => entryMatchesTarget(e, targetLower, targetAsWords))
}

/** Navigate to a wikilink target, logging a warning if not found. */
function navigateWikilink(entries: VaultEntry[], target: string, selectNote: (e: VaultEntry) => void): void {
  const found = findWikilinkTarget(entries, target)
  if (found) selectNote(found)
  else console.warn(`Navigation target not found: ${target}`)
}

/** Dispatch focus-editor event with perf timing marker. */
function signalFocusEditor(): void {
  window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { t0: performance.now() } }))
}

/** Persist to disk; on failure, call the revert handler. */
function persistOptimistic(path: string, content: string, onFail: (p: string) => void): void {
  persistNewNote(path, content).catch(() => onFail(path))
}

/** Optimistically open tab, add entry to vault, and persist to disk.
 *  Tab creation (setTabs/setActiveTabPath) runs at normal priority so the
 *  tab appears instantly.  addEntry uses startTransition internally so the
 *  expensive entries update (NoteList re-filter/sort on 9000+ entries) is
 *  deferred and doesn't block the tab from rendering. */
function createAndPersist(
  resolved: { entry: VaultEntry; content: string },
  addFn: (e: VaultEntry, c: string) => void,
  openTab: (e: VaultEntry, c: string) => void,
  onFail: (p: string) => void,
): void {
  openTab(resolved.entry, resolved.content)
  addEntryWithMock(resolved.entry, resolved.content, addFn)
  persistOptimistic(resolved.entry.path, resolved.content, onFail)
}

async function executeFrontmatterOp(op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue): Promise<string> {
  if (op === 'update') {
    return isTauri() ? invokeFrontmatter('update_frontmatter', { path, key, value }) : applyMockFrontmatterUpdate(path, key, value!)
  }
  return isTauri() ? invokeFrontmatter('delete_frontmatter_property', { path, key }) : applyMockFrontmatterDelete(path, key)
}

function renameToastMessage(updatedFiles: number): string {
  if (updatedFiles === 0) return 'Renamed'
  return `Renamed — updated ${updatedFiles} wiki link${updatedFiles > 1 ? 's' : ''}`
}

/** Reload content for open tabs whose wikilinks may have changed after a rename. */
async function reloadTabsAfterRename(
  tabPaths: string[],
  updateTabContent: (path: string, content: string) => void,
): Promise<void> {
  for (const tabPath of tabPaths) {
    try {
      updateTabContent(tabPath, await loadNoteContent(tabPath))
    } catch { /* skip tabs that fail to reload */ }
  }
}

/** Run a frontmatter update/delete and apply the result to state. */
async function runFrontmatterAndApply(
  op: 'update' | 'delete', path: string, key: string, value: FrontmatterValue | undefined,
  callbacks: { updateTab: (p: string, c: string) => void; updateEntry: (p: string, patch: Partial<VaultEntry>) => void; toast: (m: string | null) => void },
): Promise<void> {
  try {
    callbacks.updateTab(path, await executeFrontmatterOp(op, path, key, value))
    const patch = frontmatterToEntryPatch(op, key, value)
    if (Object.keys(patch).length > 0) callbacks.updateEntry(path, patch)
    callbacks.toast(op === 'update' ? 'Property updated' : 'Property deleted')
  } catch (err) {
    console.error(`Failed to ${op} frontmatter:`, err)
    callbacks.toast(`Failed to ${op} property`)
  }
}

export function useNoteActions(config: NoteActionsConfig) {
  const { addEntry, removeEntry, updateContent, entries, setToastMessage, updateEntry } = config
  const tabMgmt = useTabManagement()
  const { setTabs, handleSelectNote, openTabWithContent, handleCloseTab, activeTabPathRef, handleSwitchTab } = tabMgmt
  const tabsRef = useRef(tabMgmt.tabs)
  // eslint-disable-next-line react-hooks/refs
  tabsRef.current = tabMgmt.tabs

  const updateTabContent = useCallback((path: string, newContent: string) => {
    setTabs((prev) => prev.map((t) => t.entry.path === path ? { ...t, content: newContent } : t))
    updateContent(path, newContent)
  }, [setTabs, updateContent])

  const handleNavigateWikilink = useCallback(
    (target: string) => navigateWikilink(entries, target, handleSelectNote),
    [entries, handleSelectNote],
  )

  const revertOptimisticNote = useCallback((path: string) => {
    handleCloseTab(path)
    removeEntry(path)
    setToastMessage('Failed to create note — disk write error')
  }, [handleCloseTab, removeEntry, setToastMessage])

  const pendingNamesRef = useRef<Set<string>>(new Set())

  const handleCreateNote = useCallback((title: string, type: string) => {
    createAndPersist(resolveNewNote(title, type), addEntry, openTabWithContent, revertOptimisticNote)
  }, [openTabWithContent, addEntry, revertOptimisticNote])

  const handleCreateNoteImmediate = useCallback((type?: string) => {
    const noteType = type || 'Note'
    const title = generateUntitledName(entries, noteType, pendingNamesRef.current)
    pendingNamesRef.current.add(title)
    handleCreateNote(title, noteType)
    signalFocusEditor()
    setTimeout(() => pendingNamesRef.current.delete(title), 500)
  }, [entries, handleCreateNote])

  const handleCreateType = useCallback((typeName: string) => {
    createAndPersist(resolveNewType(typeName), addEntry, openTabWithContent, revertOptimisticNote)
  }, [openTabWithContent, addEntry, revertOptimisticNote])

  const fmCallbacks = { updateTab: updateTabContent, updateEntry, toast: setToastMessage }

  const runFrontmatterOp = useCallback(
    (op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue) =>
      runFrontmatterAndApply(op, path, key, value, fmCallbacks),
    [updateTabContent, updateEntry, setToastMessage], // eslint-disable-line react-hooks/exhaustive-deps -- fmCallbacks is stable when deps are
  )

  const handleRenameNote = useCallback(async (
    path: string, newTitle: string, vaultPath: string,
    onEntryRenamed: (oldPath: string, newEntry: Partial<VaultEntry> & { path: string }, newContent: string) => void,
  ) => {
    try {
      const result = await performRename(path, newTitle, vaultPath)
      const newContent = await loadNoteContent(result.new_path)
      const entry = entries.find((e) => e.path === path)
      const newEntry = buildRenamedEntry(entry ?? {} as VaultEntry, newTitle, result.new_path)
      const otherTabPaths = tabsRef.current.filter(t => t.entry.path !== path).map(t => t.entry.path)
      setTabs((prev) => prev.map((t) => t.entry.path === path ? { entry: newEntry, content: newContent } : t))
      if (activeTabPathRef.current === path) handleSwitchTab(result.new_path)
      onEntryRenamed(path, newEntry, newContent)
      await reloadTabsAfterRename(otherTabPaths, updateTabContent)
      setToastMessage(renameToastMessage(result.updated_files))
    } catch (err) {
      console.error('Failed to rename note:', err)
      setToastMessage('Failed to rename note')
    }
  }, [entries, setTabs, activeTabPathRef, handleSwitchTab, updateTabContent, setToastMessage])

  return {
    ...tabMgmt,
    handleNavigateWikilink,
    handleCreateNote,
    handleCreateNoteImmediate,
    handleCreateType,
    handleUpdateFrontmatter: useCallback((path: string, key: string, value: FrontmatterValue) => runFrontmatterOp('update', path, key, value), [runFrontmatterOp]),
    handleDeleteProperty: useCallback((path: string, key: string) => runFrontmatterOp('delete', path, key), [runFrontmatterOp]),
    handleAddProperty: useCallback((path: string, key: string, value: FrontmatterValue) => runFrontmatterOp('update', path, key, value), [runFrontmatterOp]),
    handleRenameNote,
  }
}
