/**
 * AI contextual chat — builds the context note list from the active note
 * and its first-degree linked notes (outgoingLinks + relationships).
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

  // outgoingLinks are raw targets (no [[ ]] wrapper)
  for (const target of active.outgoingLinks) {
    addTarget(target)
  }

  // relationships values are wikilink references like [[target]]
  for (const refs of Object.values(active.relationships)) {
    for (const ref of refs) {
      addTarget(wikilinkTarget(ref))
    }
  }

  // belongsTo and relatedTo are also wikilink references
  for (const ref of active.belongsTo) {
    addTarget(wikilinkTarget(ref))
  }
  for (const ref of active.relatedTo) {
    addTarget(wikilinkTarget(ref))
  }

  return linked
}

/** Build a contextual system prompt from the active note and its linked notes. */
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
