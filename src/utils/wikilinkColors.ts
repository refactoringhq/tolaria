/**
 * Wikilink color resolution: maps wikilink targets to their note-type accent color.
 * Used by the WikiLink inline content renderer in the editor.
 */
import type { VaultEntry } from '../types'
import { getTypeColor } from './typeColors'

/** Broken-link color: muted text to signal the target note doesn't exist */
const BROKEN_LINK_COLOR = 'var(--text-muted)'

/** Find a vault entry matching a wikilink target string */
export function findEntryByTarget(entries: VaultEntry[], target: string): VaultEntry | undefined {
  // Handle pipe syntax: [[path|display name]] → use path part for matching
  const key = target.includes('|') ? target.split('|')[0] : target
  return entries.find(e =>
    e.title === key ||
    e.filename.replace(/\.md$/, '') === key ||
    e.aliases.includes(key),
  )
}

/** Resolve the accent color for a given entry based on its type */
export function lookupColorForEntry(entries: VaultEntry[], entry: VaultEntry): string {
  if (!entry.isA) return getTypeColor(null)
  const typeEntry = entries.find(e => e.isA === 'Type' && e.title === entry.isA)
  return getTypeColor(entry.isA, typeEntry?.color)
}

export interface WikilinkColorResult { color: string; isBroken: boolean }

/** Resolve the display color for a wikilink target */
export function resolveWikilinkColor(entries: VaultEntry[], target: string): WikilinkColorResult {
  if (!entries.length) return { color: getTypeColor(null), isBroken: false }
  const entry = findEntryByTarget(entries, target)
  if (!entry) return { color: BROKEN_LINK_COLOR, isBroken: true }
  return { color: lookupColorForEntry(entries, entry), isBroken: false }
}
