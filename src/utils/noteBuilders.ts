import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'

export interface NewEntryParams {
  path: string
  slug: string
  title: string
  type: string
  status: string | null
}

const TYPE_FOLDER_MAP: Record<string, string> = {
  Note: 'note', Project: 'project', Experiment: 'experiment',
  Responsibility: 'responsibility', Procedure: 'procedure',
  Person: 'person', Event: 'event', Topic: 'topic',
  Journal: 'journal',
}

const NO_STATUS_TYPES = new Set(['Topic', 'Person', 'Journal'])

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  icon: { icon: null }, owner: { owner: null }, cadence: { cadence: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  archived: { archived: false }, trashed: { trashed: false }, order: { order: null },
  template: { template: null }, sort: { sort: null }, visible: { visible: null },
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
