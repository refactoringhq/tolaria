/**
 * AI contextual chat — builds a structured context snapshot from the active note,
 * open tabs, vault metadata, and optional explicit note references.
 */

import type { VaultEntry } from '../types'
import { wikilinkTarget } from './wikilink'

/** Resolve a link target string to a VaultEntry by matching title, aliases, or filename stem. */
export function resolveTarget(target: string, entries: VaultEntry[]): VaultEntry | undefined {
  const lower = target.toLowerCase()
  return entries.find(e => {
    if (e.title.toLowerCase() === lower) return true
    if (e.aliases.some(a => a.toLowerCase() === lower)) return true
    const stem = e.filename.replace(/\.md$/, '')
    if (stem.toLowerCase() === lower) return true
    return false
  })
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

/** Parameters for building the structured context snapshot. */
export interface ContextSnapshotParams {
  activeEntry: VaultEntry
  allContent: Record<string, string>
  openTabs?: VaultEntry[]
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

/** Build a structured context snapshot as a system prompt for Claude. */
export function buildContextSnapshot(params: ContextSnapshotParams): string {
  const { activeEntry, allContent, openTabs, noteListFilter, entries, references } = params

  const snapshot: Record<string, unknown> = {
    activeNote: {
      path: activeEntry.path,
      title: activeEntry.title,
      type: activeEntry.isA ?? 'Note',
      frontmatter: entryFrontmatter(activeEntry),
      body: allContent[activeEntry.path] ?? '',
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
    snapshot.referencedNotes = references
      .filter(ref => allContent[ref.path] !== undefined)
      .map(ref => ({
        path: ref.path,
        title: ref.title,
        type: ref.type ?? 'Note',
        body: allContent[ref.path] ?? '',
      }))
  }

  const preamble = [
    'You are an AI assistant integrated into Laputa, a personal knowledge management app.',
    'The user is viewing a specific note. Use the structured context below to answer questions accurately.',
    'You can also use MCP tools to search, read, create, or edit notes in the vault.',
  ].join('\n')

  return `${preamble}\n\n## Context Snapshot\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
}

/** Legacy: Build a contextual system prompt (text-based). */
export function buildContextualPrompt(
  active: VaultEntry,
  linkedEntries: VaultEntry[],
  allContent: Record<string, string>,
): string {
  const parts: string[] = [
    'You are an AI assistant integrated into Laputa, a personal knowledge management app.',
    'The user is viewing a specific note. Use the note and its linked context to answer questions accurately.',
    'You can also use MCP tools to search, read, create, or edit notes in the vault.',
    '',
    `## Active Note: ${active.title}`,
    `Type: ${active.isA ?? 'Note'} | Path: ${active.path}`,
    '',
    allContent[active.path] ?? '(no content)',
  ]

  if (linkedEntries.length > 0) {
    parts.push('', '## Linked Notes')
    for (const entry of linkedEntries) {
      const content = allContent[entry.path]
      parts.push(
        '',
        `### ${entry.title} (${entry.isA ?? 'Note'})`,
        content ? content.slice(0, 2000) : '(no content loaded)',
      )
    }
  }

  return parts.join('\n')
}
