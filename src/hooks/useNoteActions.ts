import { useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, addMockEntry, updateMockContent, trackMockChange } from '../mock-tauri'
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

interface MoveResult {
  new_path: string
  updated_links: number
  moved: boolean
}

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
  /** Called when an unsaved note is created so the save system can buffer its initial content. */
  markContentPending?: (path: string, content: string) => void
  /** Called after a new note is persisted to disk (e.g. to refresh git status for Changes view). */
  onNewNotePersisted?: () => void
  /** Replace an entry at oldPath with a patch (handles path changes in entries). */
  replaceEntry?: (oldPath: string, patch: Partial<VaultEntry> & { path: string }) => void
}

async function performMoveToTypeFolder(
  vaultPath: string, notePath: string, newType: string,
): Promise<MoveResult> {
  if (isTauri()) {
    return invoke<MoveResult>('move_note_to_type_folder', { vaultPath, notePath, newType })
  }
  return mockInvoke<MoveResult>('move_note_to_type_folder', { vault_path: vaultPath, note_path: notePath, new_type: newType })
}

/** Check if a frontmatter key represents the note type. */
function isTypeKey(key: string): boolean {
  const k = key.toLowerCase().replace(/\s+/g, '_')
  return k === 'type' || k === 'is_a'
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
    snippet: '', wordCount: 0, relationships: {}, icon: null, color: null, order: null, outgoingLinks: [], sidebarLabel: null, template: null, sort: null, view: null, visible: null, properties: {},
  }
}

export function slugify(text: string): string {
  const result = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return result || 'untitled'
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
  trackMockChange(path)
  return content
}

function applyMockFrontmatterDelete(path: string, key: string): string {
  const content = deleteMockFrontmatterProperty(path, key)
  updateMockContent(path, content)
  trackMockChange(path)
  return content
}

const TYPE_FOLDER_MAP: Record<string, string> = {
  Note: 'note', Project: 'project', Experiment: 'experiment',
  Responsibility: 'responsibility', Procedure: 'procedure',
  Person: 'person', Event: 'event', Topic: 'topic',
  Journal: 'journal',
}

const NO_STATUS_TYPES = new Set(['Topic', 'Person', 'Journal'])

/** Default templates for built-in types. Used when the type entry has no custom template. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  Project: '## Objective\n\n\n\n## Key Results\n\n\n\n## Notes\n\n',
  Person: '## Role\n\n\n\n## Contact\n\n\n\n## Notes\n\n',
  Responsibility: '## Description\n\n\n\n## Key Activities\n\n\n\n## Notes\n\n',
  Experiment: '## Hypothesis\n\n\n\n## Method\n\n\n\n## Results\n\n\n\n## Conclusion\n\n',
}

/** Look up the template for a given type from the type entry or defaults. */
export function resolveTemplate(entries: VaultEntry[], typeName: string): string | null {
  const typeEntry = entries.find(e => e.isA === 'Type' && e.title === typeName)
  return typeEntry?.template ?? DEFAULT_TEMPLATES[typeName] ?? null
}

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  icon: { icon: null }, owner: { owner: null }, cadence: { cadence: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  archived: { archived: false }, trashed: { trashed: false }, order: { order: null },
  template: { template: null }, sort: { sort: null }, visible: { visible: null },
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
    template: { template: str },
    sort: { sort: str },
    view: { view: str },
    visible: { visible: value === false ? false : null },
  }
  return updates[k] ?? {}
}

function addEntryWithMock(entry: VaultEntry, content: string, addEntry: (e: VaultEntry) => void) {
  if (!isTauri()) addMockEntry(entry, content)
  addEntry(entry)
}

export function buildNoteContent(title: string, type: string, status: string | null, template?: string | null): string {
  const lines = ['---', `title: ${title}`, `type: ${type}`]
  if (status) lines.push(`status: ${status}`)
  lines.push('---')
  const body = template ? `\n${template}` : '\n'
  return `${lines.join('\n')}\n\n# ${title}\n${body}`
}

export function resolveNewNote(title: string, type: string, vaultPath: string, template?: string | null): { entry: VaultEntry; content: string } {
  const folder = TYPE_FOLDER_MAP[type] || slugify(type)
  const slug = slugify(title)
  const status = NO_STATUS_TYPES.has(type) ? null : 'Active'
  const entry = buildNewEntry({ path: `${vaultPath}/${folder}/${slug}.md`, slug, title, type, status })
  return { entry, content: buildNoteContent(title, type, status, template) }
}

export function resolveNewType(typeName: string, vaultPath: string): { entry: VaultEntry; content: string } {
  const slug = slugify(typeName)
  const entry = buildNewEntry({ path: `${vaultPath}/type/${slug}.md`, slug, title: typeName, type: 'Type', status: null })
  return { entry, content: `---\ntype: Type\n---\n\n# ${typeName}\n\n` }
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function buildDailyNoteContent(date: string): string {
  const lines = ['---', `title: ${date}`, 'type: Journal', `date: ${date}`, '---']
  return `${lines.join('\n')}\n\n# ${date}\n\n## Intentions\n\n\n\n## Reflections\n\n`
}

export function resolveDailyNote(date: string, vaultPath: string): { entry: VaultEntry; content: string } {
  const entry = buildNewEntry({ path: `${vaultPath}/journal/${date}.md`, slug: date, title: date, type: 'Journal', status: null })
  return { entry, content: buildDailyNoteContent(date) }
}

export function findDailyNote(entries: VaultEntry[], date: string): VaultEntry | undefined {
  const suffix = `journal/${date}.md`
  return entries.find(e => e.path.endsWith(suffix))
}

type PersistFn = (resolved: { entry: VaultEntry; content: string }) => void

/** Open today's daily note: navigate to it if it exists, or create + persist a new one. */
function openDailyNote(entries: VaultEntry[], selectNote: (e: VaultEntry) => void, persist: PersistFn, vaultPath: string): void {
  const date = todayDateString()
  const existing = findDailyNote(entries, date)
  if (existing) selectNote(existing)
  else persist(resolveDailyNote(date, vaultPath))
  signalFocusEditor()
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
function signalFocusEditor(opts?: { selectTitle?: boolean }): void {
  window.dispatchEvent(new CustomEvent('laputa:focus-editor', {
    detail: { t0: performance.now(), selectTitle: opts?.selectTitle ?? false },
  }))
}

interface PersistCallbacks {
  onFail: (p: string) => void
  onStart?: (p: string) => void
  onEnd?: (p: string) => void
  onPersisted?: () => void
}

/** Persist to disk; track pending state via onStart/onEnd; revert on failure. */
function persistOptimistic(path: string, content: string, cbs: PersistCallbacks): void {
  cbs.onStart?.(path)
  persistNewNote(path, content)
    .then(() => { cbs.onEnd?.(path); cbs.onPersisted?.() })
    .catch(() => { cbs.onEnd?.(path); cbs.onFail(path) })
}

/** Optimistically open tab, add entry to vault, and persist to disk.
 *  Tab creation (setTabs/setActiveTabPath) runs at normal priority so the
 *  tab appears instantly.  addEntry uses startTransition internally so the
 *  expensive entries update (NoteList re-filter/sort on 9000+ entries) is
 *  deferred and doesn't block the tab from rendering. */
function createAndPersist(
  resolved: { entry: VaultEntry; content: string },
  addFn: (e: VaultEntry) => void,
  openTab: (e: VaultEntry, c: string) => void,
  cbs: PersistCallbacks,
): void {
  openTab(resolved.entry, resolved.content)
  addEntryWithMock(resolved.entry, resolved.content, addFn)
  persistOptimistic(resolved.entry.path, resolved.content, cbs)
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
  const { addEntry, removeEntry, entries, setToastMessage, updateEntry, addPendingSave, removePendingSave } = config
  const tabMgmt = useTabManagement()
  const { setTabs, handleSelectNote, openTabWithContent, handleCloseTab, handleCloseTabRef, activeTabPathRef, handleSwitchTab } = tabMgmt
  const tabsRef = useRef(tabMgmt.tabs)
  // eslint-disable-next-line react-hooks/refs
  tabsRef.current = tabMgmt.tabs
  const unsavedPathsRef = useRef(config.unsavedPaths)
  // eslint-disable-next-line react-hooks/refs
  unsavedPathsRef.current = config.unsavedPaths

  const updateTabContent = useCallback((path: string, newContent: string) => {
    setTabs((prev) => prev.map((t) => t.entry.path === path ? { ...t, content: newContent } : t))
  }, [setTabs])

  const handleNavigateWikilink = useCallback(
    (target: string) => navigateWikilink(entries, target, handleSelectNote),
    [entries, handleSelectNote],
  )

  const revertOptimisticNote = useCallback((path: string) => {
    handleCloseTab(path)
    removeEntry(path)
    setToastMessage('Failed to create note — disk write error')
  }, [handleCloseTab, removeEntry, setToastMessage])

  const persistCbs: PersistCallbacks = {
    onFail: revertOptimisticNote,
    onStart: addPendingSave,
    onEnd: removePendingSave,
    onPersisted: config.onNewNotePersisted,
  }

  const pendingNamesRef = useRef<Set<string>>(new Set())

  const persistNew: PersistFn = useCallback(
    (resolved) => createAndPersist(resolved, addEntry, openTabWithContent, persistCbs),
    [openTabWithContent, addEntry, revertOptimisticNote, addPendingSave, removePendingSave], // eslint-disable-line react-hooks/exhaustive-deps -- persistCbs is stable when deps are
  )

  const handleCreateNote = useCallback((title: string, type: string) => {
    const template = resolveTemplate(entries, type)
    persistNew(resolveNewNote(title, type, config.vaultPath, template))
  }, [entries, persistNew, config.vaultPath])

  const handleCreateNoteImmediate = useCallback((type?: string) => {
    try {
      const noteType = type || 'Note'
      const title = generateUntitledName(entries, noteType, pendingNamesRef.current)
      pendingNamesRef.current.add(title)
      const template = resolveTemplate(entries, noteType)
      const resolved = resolveNewNote(title, noteType, config.vaultPath, template)
      openTabWithContent(resolved.entry, resolved.content)
      addEntryWithMock(resolved.entry, resolved.content, addEntry)
      config.trackUnsaved?.(resolved.entry.path)
      config.markContentPending?.(resolved.entry.path, resolved.content)
      signalFocusEditor({ selectTitle: true })
      setTimeout(() => pendingNamesRef.current.delete(title), 500)
    } catch (err) {
      console.error('Failed to create note:', err)
      setToastMessage('Failed to create note')
    }
  }, [entries, openTabWithContent, addEntry, config.vaultPath, config.trackUnsaved, config.markContentPending]) // eslint-disable-line react-hooks/exhaustive-deps -- config callbacks are stable

  /** Close tab and discard entry+unsaved state if the note was never persisted. */
  const handleCloseTabWithCleanup = useCallback((path: string) => {
    if (unsavedPathsRef.current?.has(path)) { removeEntry(path); config.clearUnsaved?.(path) }
    handleCloseTab(path)
  }, [handleCloseTab, removeEntry, config.clearUnsaved]) // eslint-disable-line react-hooks/exhaustive-deps -- ref access is stable

  // Keep handleCloseTabRef in sync so Cmd+W and menu events also clean up unsaved notes.
  useEffect(() => { handleCloseTabRef.current = handleCloseTabWithCleanup })

  const handleOpenDailyNote = useCallback(() => openDailyNote(entries, handleSelectNote, persistNew, config.vaultPath), [entries, handleSelectNote, persistNew, config.vaultPath])

  const handleCreateType = useCallback((typeName: string) => persistNew(resolveNewType(typeName, config.vaultPath)), [persistNew, config.vaultPath])

  /** Create a Type entry file silently (no tab opened). Adds to state and persists to disk. */
  const createTypeEntrySilent = useCallback(async (typeName: string): Promise<VaultEntry> => {
    const resolved = resolveNewType(typeName, config.vaultPath)
    addEntryWithMock(resolved.entry, resolved.content, addEntry)
    await persistNewNote(resolved.entry.path, resolved.content)
    return resolved.entry
  }, [addEntry, config.vaultPath])

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
    handleCloseTab: handleCloseTabWithCleanup,
    handleNavigateWikilink,
    handleCreateNote,
    handleCreateNoteImmediate,
    handleOpenDailyNote,
    handleCreateType,
    createTypeEntrySilent,
    handleUpdateFrontmatter: useCallback(async (path: string, key: string, value: FrontmatterValue) => {
      await runFrontmatterOp('update', path, key, value)
      if (isTypeKey(key) && typeof value === 'string' && value !== '') {
        try {
          const result = await performMoveToTypeFolder(config.vaultPath, path, value)
          if (result.moved) {
            const newFilename = result.new_path.split('/').pop() ?? ''
            // Update the vault entry with the new path.  Only pass the changed
            // fields — avoid spreading a stale closure entry which would revert
            // the isA update that runFrontmatterOp already applied.
            config.replaceEntry?.(path, { path: result.new_path, filename: newFilename } as Partial<VaultEntry> & { path: string })
            // Preserve the tab content already set by runFrontmatterOp.
            // Re-reading from disk via loadNoteContent is unnecessary (the move
            // does not change content) and dangerous: if the path collides or a
            // stale cache intervenes it could return a different note's content.
            setTabs(prev => prev.map(t => t.entry.path === path
              ? { entry: { ...t.entry, path: result.new_path, filename: newFilename }, content: t.content }
              : t))
            if (activeTabPathRef.current === path) handleSwitchTab(result.new_path)
            const folder = result.new_path.split('/').slice(-2, -1)[0] ?? ''
            setToastMessage(`Note moved to ${folder}/`)
          }
        } catch (err) {
          console.error('Failed to move note to type folder:', err)
        }
      }
    }, [runFrontmatterOp, config.vaultPath, config.replaceEntry, setTabs, activeTabPathRef, handleSwitchTab, setToastMessage]),
    handleDeleteProperty: useCallback((path: string, key: string) => runFrontmatterOp('delete', path, key), [runFrontmatterOp]),
    handleAddProperty: useCallback((path: string, key: string, value: FrontmatterValue) => runFrontmatterOp('update', path, key, value), [runFrontmatterOp]),
    handleRenameNote,
  }
}
