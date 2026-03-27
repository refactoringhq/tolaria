import { useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, addMockEntry } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { resolveEntry } from '../utils/wikilink'

export interface NewEntryParams {
  path: string
  slug: string
  title: string
  type: string
  status: string | null
}

export function buildNewEntry({ path, slug, title, type, status }: NewEntryParams): VaultEntry {
  const now = Math.floor(Date.now() / 1000)
  return {
    path, filename: `${slug}.md`, title, isA: type,
    aliases: [], belongsTo: [], relatedTo: [],
    status, archived: false, trashed: false, trashedAt: null,
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

export function entryMatchesTarget(e: VaultEntry, target: string): boolean {
  return resolveEntry([e], target) === e
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

export function buildNoteContent(title: string, type: string, status: string | null, template?: string | null): string {
  const lines = ['---', `title: ${title}`, `type: ${type}`]
  if (status) lines.push(`status: ${status}`)
  lines.push('---')
  const body = template ? `\n${template}` : '\n'
  return `${lines.join('\n')}\n\n# ${title}\n${body}`
}

export function resolveNewNote(title: string, type: string, vaultPath: string, template?: string | null): { entry: VaultEntry; content: string } {
  const slug = slugify(title)
  const status = NO_STATUS_TYPES.has(type) ? null : 'Active'
  const entry = buildNewEntry({ path: `${vaultPath}/${slug}.md`, slug, title, type, status })
  return { entry, content: buildNoteContent(title, type, status, template) }
}

export function resolveNewType(typeName: string, vaultPath: string): { entry: VaultEntry; content: string } {
  const slug = slugify(typeName)
  const entry = buildNewEntry({ path: `${vaultPath}/${slug}.md`, slug, title: typeName, type: 'Type', status: null })
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
  const entry = buildNewEntry({ path: `${vaultPath}/${date}.md`, slug: date, title: date, type: 'Journal', status: null })
  return { entry, content: buildDailyNoteContent(date) }
}

export function findDailyNote(entries: VaultEntry[], date: string): VaultEntry | undefined {
  return entries.find(e => e.filename === `${date}.md` && e.isA === 'Journal')
}

/** Persist a newly created note to disk. Returns a Promise for error handling. */
export function persistNewNote(path: string, content: string): Promise<void> {
  if (!isTauri()) return Promise.resolve()
  return invoke<void>('save_note_content', { path, content }).then(() => {})
}

function addEntryWithMock(entry: VaultEntry, content: string, addEntry: (e: VaultEntry) => void) {
  if (!isTauri()) addMockEntry(entry, content)
  addEntry(entry)
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

type PersistFn = (resolved: { entry: VaultEntry; content: string }) => void

/** Optimistically open note, add entry to vault, and persist to disk. */
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

/** Open today's daily note: navigate to it if it exists, or create + persist a new one. */
function openDailyNote(entries: VaultEntry[], selectNote: (e: VaultEntry) => void, persist: PersistFn, vaultPath: string): void {
  const date = todayDateString()
  const existing = findDailyNote(entries, date)
  if (existing) selectNote(existing)
  else persist(resolveDailyNote(date, vaultPath))
  signalFocusEditor()
}

interface ImmediateCreateDeps {
  entries: VaultEntry[]
  vaultPath: string
  pendingNames: Set<string>
  openTabWithContent: (entry: VaultEntry, content: string) => void
  addEntry: (entry: VaultEntry) => void
  trackUnsaved?: (path: string) => void
  markContentPending?: (path: string, content: string) => void
}

/** Create an untitled note without persisting to disk (deferred save). */
function createNoteImmediate(deps: ImmediateCreateDeps, type?: string): void {
  const noteType = type || 'Note'
  const title = generateUntitledName(deps.entries, noteType, deps.pendingNames)
  deps.pendingNames.add(title)
  const template = resolveTemplate(deps.entries, noteType)
  const resolved = resolveNewNote(title, noteType, deps.vaultPath, template)
  deps.openTabWithContent(resolved.entry, resolved.content)
  addEntryWithMock(resolved.entry, resolved.content, deps.addEntry)
  deps.trackUnsaved?.(resolved.entry.path)
  deps.markContentPending?.(resolved.entry.path, resolved.content)
  signalFocusEditor({ selectTitle: true })
  setTimeout(() => deps.pendingNames.delete(title), 500)
}

interface RelationshipCreateDeps {
  entries: VaultEntry[]
  vaultPath: string
  openTabWithContent: (entry: VaultEntry, content: string) => void
  addEntry: (entry: VaultEntry) => void
  removeEntry: (path: string) => void
  setToastMessage: (msg: string | null) => void
  onNewNotePersisted?: () => void
}

/** Create a note for a relationship link; persist in background. */
function createNoteForRelationship(deps: RelationshipCreateDeps, title: string): void {
  const template = resolveTemplate(deps.entries, 'Note')
  const resolved = resolveNewNote(title, 'Note', deps.vaultPath, template)
  deps.openTabWithContent(resolved.entry, resolved.content)
  addEntryWithMock(resolved.entry, resolved.content, deps.addEntry)
  persistNewNote(resolved.entry.path, resolved.content)
    .then(() => deps.onNewNotePersisted?.())
    .catch(() => {
      deps.removeEntry(resolved.entry.path)
      deps.setToastMessage('Failed to create note — disk write error')
    })
}

export interface NoteCreationConfig {
  addEntry: (entry: VaultEntry) => void
  removeEntry: (path: string) => void
  entries: VaultEntry[]
  setToastMessage: (msg: string | null) => void
  vaultPath: string
  addPendingSave?: (path: string) => void
  removePendingSave?: (path: string) => void
  trackUnsaved?: (path: string) => void
  clearUnsaved?: (path: string) => void
  unsavedPaths?: Set<string>
  markContentPending?: (path: string, content: string) => void
  onNewNotePersisted?: () => void
}

interface CreationTabDeps {
  openTabWithContent: (entry: VaultEntry, content: string) => void
  handleSelectNote: (entry: VaultEntry) => void
}

export function useNoteCreation(config: NoteCreationConfig, tabDeps: CreationTabDeps) {
  const { addEntry, removeEntry, entries, setToastMessage, addPendingSave, removePendingSave } = config
  const { openTabWithContent, handleSelectNote } = tabDeps

  const revertOptimisticNote = useCallback((path: string) => {
    removeEntry(path)
    setToastMessage('Failed to create note — disk write error')
  }, [removeEntry, setToastMessage])

  const pendingNamesRef = useRef<Set<string>>(new Set())

  const persistNew: PersistFn = useCallback(
    (resolved) => createAndPersist(resolved, addEntry, openTabWithContent, {
      onFail: revertOptimisticNote,
      onStart: addPendingSave,
      onEnd: removePendingSave,
      onPersisted: config.onNewNotePersisted,
    }),
    [openTabWithContent, addEntry, revertOptimisticNote, addPendingSave, removePendingSave, config.onNewNotePersisted],
  )

  const handleCreateNote = useCallback((title: string, type: string) => {
    const template = resolveTemplate(entries, type)
    persistNew(resolveNewNote(title, type, config.vaultPath, template))
  }, [entries, persistNew, config.vaultPath])

  const handleCreateNoteImmediate = useCallback((type?: string) => {
    createNoteImmediate({
      entries, vaultPath: config.vaultPath, pendingNames: pendingNamesRef.current,
      openTabWithContent, addEntry, trackUnsaved: config.trackUnsaved, markContentPending: config.markContentPending,
    }, type)
  }, [entries, openTabWithContent, addEntry, config.vaultPath, config.trackUnsaved, config.markContentPending, setToastMessage])

  const handleCreateNoteForRelationship = useCallback((title: string): Promise<boolean> => {
    createNoteForRelationship({
      entries, vaultPath: config.vaultPath, openTabWithContent, addEntry,
      removeEntry, setToastMessage, onNewNotePersisted: config.onNewNotePersisted,
    }, title)
    return Promise.resolve(true)
  }, [entries, openTabWithContent, addEntry, removeEntry, setToastMessage, config.vaultPath, config.onNewNotePersisted])

  const handleOpenDailyNote = useCallback(() => openDailyNote(entries, handleSelectNote, persistNew, config.vaultPath), [entries, handleSelectNote, persistNew, config.vaultPath])

  const handleCreateType = useCallback((typeName: string) => persistNew(resolveNewType(typeName, config.vaultPath)), [persistNew, config.vaultPath])

  /** Create a Type entry file silently (no tab opened). Adds to state and persists to disk. */
  const createTypeEntrySilent = useCallback(async (typeName: string): Promise<VaultEntry> => {
    const resolved = resolveNewType(typeName, config.vaultPath)
    addEntryWithMock(resolved.entry, resolved.content, addEntry)
    await persistNewNote(resolved.entry.path, resolved.content)
    return resolved.entry
  }, [addEntry, config.vaultPath])

  return {
    handleCreateNote,
    handleCreateNoteImmediate,
    handleCreateNoteForRelationship,
    handleOpenDailyNote,
    handleCreateType,
    createTypeEntrySilent,
  }
}
