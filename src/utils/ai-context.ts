/**
 * AI contextual chat — builds a structured context snapshot from the active note,
 * open tabs, vault metadata, and optional explicit note references.
 */

import type { VaultEntry } from '../types'
import { wikilinkTarget, resolveEntry } from './wikilink'
import { splitFrontmatter } from './wikilinks'

/** Extract only the body text from raw file content (strips YAML frontmatter). */
function extractBody(rawContent: string): string {
  const [, body] = splitFrontmatter(rawContent)
  return body.trim()
}

/** Resolve a link target string to a VaultEntry by matching title, aliases, or filename stem.
 *  Delegates to the unified resolveEntry for consistent matching. */
export function resolveTarget(target: string, entries: VaultEntry[]): VaultEntry | undefined {
  return resolveEntry(entries, target)
}

/** Collect first-degree linked notes from the active entry. */
export function collectLinkedEntries(
  active: VaultEntry,
  entries: VaultEntry[],
): VaultEntry[] {
  const seen = new Set<string>([active.path])
  const linked: VaultEntry[] = []

  const addTarget = (target: string) => {
    const entry = resolveTarget(target, entries)
    if (entry && !seen.has(entry.path)) {
      seen.add(entry.path)
      linked.push(entry)
    }
  }

  for (const target of active.outgoingLinks) {
    addTarget(target)
  }

  for (const refs of Object.values(active.relationships)) {
    for (const ref of refs) {
      addTarget(wikilinkTarget(ref))
    }
  }

  for (const ref of active.belongsTo) {
    addTarget(wikilinkTarget(ref))
  }
  for (const ref of active.relatedTo) {
    addTarget(wikilinkTarget(ref))
  }

  return linked
}

/** A note reference from the user's [[wikilink]] selection in the chat input. */
export interface NoteReference {
  title: string
  path: string
  type: string | null
}

/** Lightweight note summary for the context snapshot. */
export interface NoteListItem {
  path: string
  title: string
  type: string
}

/** Parameters for building the structured context snapshot. */
export interface ContextSnapshotParams {
  activeEntry: VaultEntry
  /** Direct content of the active note from the editor tab (most reliable source). */
  activeNoteContent?: string
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  entries: VaultEntry[]
  references?: NoteReference[]
}

function entryFrontmatter(e: VaultEntry): Record<string, unknown> {
  const fm: Record<string, unknown> = {}
  if (e.isA) fm.type = e.isA
  if (e.status) fm.status = e.status
  if (e.owner) fm.owner = e.owner
  if (e.belongsTo.length > 0) fm.belongsTo = e.belongsTo
  if (e.relatedTo.length > 0) fm.relatedTo = e.relatedTo
  if (Object.keys(e.relationships).length > 0) fm.relationships = e.relationships
  return fm
}

const MAX_NOTE_LIST_ITEMS = 100

/** Build a structured context snapshot as a system prompt for Claude. */
export function buildContextSnapshot(params: ContextSnapshotParams): string {
  const { activeEntry, activeNoteContent, openTabs, noteList, noteListFilter, entries, references } = params

  const rawContent = activeNoteContent || ''
  let body = extractBody(rawContent)

  // Defence-in-depth: when body is empty but the note has content on disk,
  // include an explicit instruction in the body field itself (more reliable
  // than a preamble instruction that Claude might skip).
  if (!body && activeEntry.wordCount > 0) {
    body = `[Content not available in editor context — use get_note("${activeEntry.path}") to read the full note (${activeEntry.wordCount} words)]`
  }

  const snapshot: Record<string, unknown> = {
    activeNote: {
      path: activeEntry.path,
      title: activeEntry.title,
      type: activeEntry.isA ?? 'Note',
      frontmatter: entryFrontmatter(activeEntry),
      body,
      wordCount: activeEntry.wordCount,
    },
  }

  const otherTabs = openTabs?.filter(t => t.path !== activeEntry.path)
  if (otherTabs && otherTabs.length > 0) {
    snapshot.openTabs = otherTabs.map(t => ({
      path: t.path,
      title: t.title,
      type: t.isA ?? 'Note',
      frontmatter: entryFrontmatter(t),
    }))
  }

  if (noteList && noteList.length > 0) {
    const items = noteList.slice(0, MAX_NOTE_LIST_ITEMS)
    snapshot.noteList = items
    if (noteList.length > MAX_NOTE_LIST_ITEMS) {
      snapshot.noteListTruncated = { shown: MAX_NOTE_LIST_ITEMS, total: noteList.length }
    }
  }

  if (noteListFilter && (noteListFilter.type || noteListFilter.query)) {
    snapshot.noteListFilter = noteListFilter
  }

  const types = new Set<string>()
  for (const e of entries) {
    if (e.isA) types.add(e.isA)
  }
  snapshot.vault = {
    types: [...types].sort(),
    totalNotes: entries.length,
  }

  if (references && references.length > 0) {
    snapshot.referencedNotes = references.map(ref => ({
      path: ref.path,
      title: ref.title,
      type: ref.type ?? 'Note',
    }))
  }

  const preamble = [
    'You are an AI assistant integrated into Laputa, a personal knowledge management app.',
    'The user is viewing a specific note. Use the structured context below to answer questions accurately.',
    'You can also use MCP tools to search, read, create, or edit notes in the vault.',
    'If the body field is empty but wordCount is > 0, the content may be stale — use get_note to read the full note from disk.',
    'When you mention or reference a note by name, always use [[Note Title]] wikilink syntax so the user can click to open it.',
  ].join('\n')

  return `${preamble}\n\n## Context Snapshot\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
}

/** Legacy: Build a contextual system prompt (text-based). */
export function buildContextualPrompt(
  active: VaultEntry,
  linkedEntries: VaultEntry[],
): string {
  const parts: string[] = [
    'You are an AI assistant integrated into Laputa, a personal knowledge management app.',
    'The user is viewing a specific note. Use the note and its linked context to answer questions accurately.',
    'You can also use MCP tools to search, read, create, or edit notes in the vault.',
    '',
    `## Active Note: ${active.title}`,
    `Type: ${active.isA ?? 'Note'} | Path: ${active.path}`,
  ]

  if (linkedEntries.length > 0) {
    parts.push('', '## Linked Notes')
    for (const entry of linkedEntries) {
      parts.push(
        '',
        `### ${entry.title} (${entry.isA ?? 'Note'})`,
      )
    }
  }

  return parts.join('\n')
}
