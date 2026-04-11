import { useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, addMockEntry } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { resolveEntry } from '../utils/wikilink'
import { trackEvent } from '../lib/telemetry'

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
    status, archived: false,
    modifiedAt: now, createdAt: now, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {}, icon: null, color: null, order: null, outgoingLinks: [], sidebarLabel: null, template: null, sort: null, view: null, visible: null, properties: {}, organized: false, favorite: false, favoriteIndex: null, listPropertiesDisplay: [], hasH1: false,
  }
}

export function slugify(text: string): string {
  const result = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return result || 'untitled'
}

/** Convert a filename slug to a human-readable title (hyphens → spaces, title case). */
function slug_to_title(slug: string): string {
  return slug.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Generate a unique "Untitled <type>" name by checking existing entries and pending names. */
export interface UntitledNameParams {
  entries: VaultEntry[]
  type: string
  pendingTitles?: Set<string>
}

export function generateUntitledName({ entries, type, pendingTitles }: UntitledNameParams): string {
  const baseName = `Untitled ${type.toLowerCase()}`
  const existingTitles = new Set(entries.map(e => e.title))
  if (pendingTitles) pendingTitles.forEach((title) => existingTitles.add(title))
  let title = baseName
  let counter = 2
  while (existingTitles.has(title)) {
    title = `${baseName} ${counter}`
    counter++
  }
  return title
}

export interface EntryMatchParams {
  entry: VaultEntry
  target: string
}

export function entryMatchesTarget({ entry, target }: EntryMatchParams): boolean {
  return resolveEntry([entry], target) === entry
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
export interface TemplateLookupParams {
  entries: VaultEntry[]
  typeName: string
}

export function resolveTemplate({ entries, typeName }: TemplateLookupParams): string | null {
  const typeEntry = entries.find((entry) => entry.isA === 'Type' && entry.title === typeName)
  return typeEntry?.template ?? DEFAULT_TEMPLATES[typeName] ?? null
}

export interface NoteContentParams {
  title: string | null
  type: string
  status: string | null
  template?: string | null
  initialEmptyHeading?: boolean
}

function buildNoteBody({ template, initialEmptyHeading }: Pick<NoteContentParams, 'template' | 'initialEmptyHeading'>): string {
  if (initialEmptyHeading) {
    return template ? `\n# \n\n${template}` : '\n# \n\n'
  }
  return template ? `\n${template}` : ''
}

export function buildNoteContent({ title, type, status, template, initialEmptyHeading = false }: NoteContentParams): string {
  const lines = ['---']
  if (title) lines.push(`title: ${title}`)
  lines.push(`type: ${type}`)
  if (status) lines.push(`status: ${status}`)
  lines.push('---')
  const body = buildNoteBody({ template, initialEmptyHeading })
  return `${lines.join('\n')}\n${body}`
}

export interface NewNoteParams {
  title: string
  type: string
  vaultPath: string
  template?: string | null
}

export function resolveNewNote({ title, type, vaultPath, template }: NewNoteParams): { entry: VaultEntry; content: string } {
  const slug = slugify(title)
  const status = NO_STATUS_TYPES.has(type) ? null : 'Active'
  const entry = buildNewEntry({ path: `${vaultPath}/${slug}.md`, slug, title, type, status })
  return { entry, content: buildNoteContent({ title, type, status, template }) }
}

export interface NewTypeParams {
  typeName: string
  vaultPath: string
}

export function resolveNewType({ typeName, vaultPath }: NewTypeParams): { entry: VaultEntry; content: string } {
  const slug = slugify(typeName)
  const entry = buildNewEntry({ path: `${vaultPath}/${slug}.md`, slug, title: typeName, type: 'Type', status: null })
  return { entry, content: `---\ntype: Type\n---\n` }
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function buildDailyNoteContent(date: string): string {
  const lines = ['---', `title: ${date}`, 'type: Journal', `date: ${date}`, '---']
  return `${lines.join('\n')}\n\n## Intentions\n\n\n\n## Reflections\n\n`
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

// Rapid Cmd+N bursts can outpace the note-list render path on desktop. Keep
// the first create immediate, then serialize the rest so each new note settles
// before the next one is opened.
export const RAPID_CREATE_NOTE_SETTLE_MS = 200

function addEntryWithMock(entry: VaultEntry, content: string, addEntry: (e: VaultEntry) => void) {
  if (!isTauri()) addMockEntry(entry, content)
  addEntry(entry)
}

/** Dispatch focus-editor event with perf timing marker. */
function signalFocusEditor(opts?: { selectTitle?: boolean; path?: string }): void {
  window.dispatchEvent(new CustomEvent('laputa:focus-editor', {
    detail: { t0: performance.now(), selectTitle: opts?.selectTitle ?? false, path: opts?.path ?? null },
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
  const targetPath = existing?.path ?? `${vaultPath}/${date}.md`
  if (existing) selectNote(existing)
  else persist(resolveDailyNote(date, vaultPath))
  signalFocusEditor({ path: targetPath })
}

interface ImmediateCreateDeps {
  entries: VaultEntry[]
  vaultPath: string
  pendingSlugs: Set<string>
  openTabWithContent: (entry: VaultEntry, content: string) => void
  addEntry: (entry: VaultEntry) => void
  trackUnsaved?: (path: string) => void
  markContentPending?: (path: string, content: string) => void
}

interface ImmediateCreateRequest {
  type?: string
}

/** Generate a unique untitled filename using a timestamp. */
function generateUntitledFilename(entries: VaultEntry[], type: string, pendingSlugs?: Set<string>): string {
  const ts = Math.floor(Date.now() / 1000)
  const typeSlug = type === 'Note' ? 'note' : slugify(type)
  const base = `untitled-${typeSlug}-${ts}`
  const existingSlugs = new Set(entries.map((entry) => entry.filename.replace(/\.md$/, '')))

  let candidate = base
  let suffix = 2
  while (existingSlugs.has(candidate) || pendingSlugs?.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  pendingSlugs?.add(candidate)
  return candidate
}

/** Create an untitled note without persisting to disk (deferred save). */
function createNoteImmediate(deps: ImmediateCreateDeps, type?: string): void {
  const noteType = type || 'Note'
  const slug = generateUntitledFilename(deps.entries, noteType, deps.pendingSlugs)
  const title = slug_to_title(slug)
  const template = resolveTemplate({ entries: deps.entries, typeName: noteType })
  const status = NO_STATUS_TYPES.has(noteType) ? null : 'Active'
  const entry = buildNewEntry({ path: `${deps.vaultPath}/${slug}.md`, slug, title, type: noteType, status })
  const content = buildNoteContent({ title: null, type: noteType, status, template, initialEmptyHeading: true })
  deps.openTabWithContent(entry, content)
  addEntryWithMock(entry, content, deps.addEntry)
  deps.trackUnsaved?.(entry.path)
  deps.markContentPending?.(entry.path, content)
  signalFocusEditor({ path: entry.path, selectTitle: true })
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
  const template = resolveTemplate({ entries: deps.entries, typeName: 'Note' })
  const resolved = resolveNewNote({ title, type: 'Note', vaultPath: deps.vaultPath, template })
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

  const pendingSlugsRef = useRef<Set<string>>(new Set())
  const queuedImmediateCreatesRef = useRef<ImmediateCreateRequest[]>([])
  const immediateCreateLockedRef = useRef(false)
  const immediateCreateTimerRef = useRef<number | null>(null)
  const latestImmediateCreateDepsRef = useRef<ImmediateCreateDeps | null>(null)

  const syncImmediateCreateDeps = useCallback(() => {
    latestImmediateCreateDepsRef.current = {
      entries,
      vaultPath: config.vaultPath,
      pendingSlugs: pendingSlugsRef.current,
      openTabWithContent,
      addEntry,
      trackUnsaved: config.trackUnsaved,
      markContentPending: config.markContentPending,
    }
  }, [entries, config.vaultPath, openTabWithContent, addEntry, config.trackUnsaved, config.markContentPending])

  useEffect(() => {
    syncImmediateCreateDeps()
  }, [syncImmediateCreateDeps])

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
    const template = resolveTemplate({ entries, typeName: type })
    persistNew(resolveNewNote({ title, type, vaultPath: config.vaultPath, template }))
    trackEvent('note_created', { has_type: type !== 'Note' ? 1 : 0, creation_path: 'plus_button' })
  }, [entries, persistNew, config.vaultPath])

  const executeImmediateCreateRequest = useCallback((request: ImmediateCreateRequest) => {
    const deps = latestImmediateCreateDepsRef.current
    if (!deps) return
    createNoteImmediate(deps, request.type)
    trackEvent('note_created', { has_type: request.type ? 1 : 0, creation_path: request.type ? 'type_section' : 'cmd_n' })
  }, [])

  const continueImmediateCreateBurst = useCallback(function scheduleImmediateCreateBurst() {
    if (immediateCreateTimerRef.current !== null) return

    immediateCreateTimerRef.current = window.setTimeout(() => {
      immediateCreateTimerRef.current = null
      const next = queuedImmediateCreatesRef.current.shift()
      if (!next) {
        immediateCreateLockedRef.current = false
        return
      }

      executeImmediateCreateRequest(next)
      scheduleImmediateCreateBurst()
    }, RAPID_CREATE_NOTE_SETTLE_MS)
  }, [executeImmediateCreateRequest])

  const handleCreateNoteImmediate = useCallback((type?: string) => {
    syncImmediateCreateDeps()
    const request = { type }
    if (immediateCreateLockedRef.current) {
      queuedImmediateCreatesRef.current.push(request)
      return
    }

    immediateCreateLockedRef.current = true
    executeImmediateCreateRequest(request)
    continueImmediateCreateBurst()
  }, [syncImmediateCreateDeps, executeImmediateCreateRequest, continueImmediateCreateBurst])

  useEffect(() => () => {
    if (immediateCreateTimerRef.current !== null) {
      window.clearTimeout(immediateCreateTimerRef.current)
    }
  }, [])

  const handleCreateNoteForRelationship = useCallback((title: string): Promise<boolean> => {
    createNoteForRelationship({
      entries, vaultPath: config.vaultPath, openTabWithContent, addEntry,
      removeEntry, setToastMessage, onNewNotePersisted: config.onNewNotePersisted,
    }, title)
    return Promise.resolve(true)
  }, [entries, openTabWithContent, addEntry, removeEntry, setToastMessage, config.vaultPath, config.onNewNotePersisted])

  const handleOpenDailyNote = useCallback(() => openDailyNote(entries, handleSelectNote, persistNew, config.vaultPath), [entries, handleSelectNote, persistNew, config.vaultPath])

  const handleCreateType = useCallback((typeName: string) => {
    persistNew(resolveNewType({ typeName, vaultPath: config.vaultPath }))
    trackEvent('type_created')
  }, [persistNew, config.vaultPath])

  /** Create a Type entry file silently (no tab opened). Adds to state and persists to disk. */
  const createTypeEntrySilent = useCallback(async (typeName: string): Promise<VaultEntry> => {
    const resolved = resolveNewType({ typeName, vaultPath: config.vaultPath })
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
