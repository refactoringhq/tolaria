/** Utility functions for parsing wikilink syntax: [[target|display]] */

import type { VaultEntry } from '../types'

/** Extracts the target path from a wikilink reference (strips [[ ]] and display text). */
export function wikilinkTarget(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  return pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner
}

/** Extracts the display label from a wikilink reference. Falls back to humanised path stem. */
export function wikilinkDisplay(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  if (pipeIdx !== -1) return inner.slice(pipeIdx + 1)
  const last = inner.split('/').pop() ?? inner
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Unified wikilink resolution: find the VaultEntry matching a wikilink target.
 * Handles pipe syntax, case-insensitive matching, title/alias/filename/path lookup.
 */
export function resolveEntry(entries: VaultEntry[], rawTarget: string): VaultEntry | undefined {
  const key = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget
  const keyLower = key.toLowerCase()
  const suffix = '/' + key + '.md'
  const lastSegment = key.split('/').pop() ?? key
  const asWords = lastSegment.replace(/-/g, ' ').toLowerCase()

  return entries.find(e => {
    if (e.title.toLowerCase() === keyLower) return true
    if (e.aliases.some(a => a.toLowerCase() === keyLower)) return true
    const stem = e.filename.replace(/\.md$/, '')
    if (stem.toLowerCase() === keyLower) return true
    if (e.path.endsWith(suffix)) return true
    if (stem.toLowerCase() === lastSegment.toLowerCase()) return true
    if (e.title.toLowerCase() === asWords) return true
    return false
  })
}
