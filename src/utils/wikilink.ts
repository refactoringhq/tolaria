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

/** Extract the vault-relative path stem (no leading slash, no .md extension). */
export function relativePathStem(absolutePath: string, vaultPath: string): string {
  const prefix = vaultPath.endsWith('/') ? vaultPath : vaultPath + '/'
  if (absolutePath.startsWith(prefix)) return absolutePath.slice(prefix.length).replace(/\.md$/, '')
  // Fallback: just the filename stem
  const filename = absolutePath.split('/').pop() ?? absolutePath
  return filename.replace(/\.md$/, '')
}

/**
 * Unified wikilink resolution: find the VaultEntry matching a wikilink target.
 * Handles pipe syntax, case-insensitive matching.
 * Resolution order (multi-pass, global priority):
 *   1. Path-suffix match (for path-style targets like "docs/adr/0031-foo")
 *   2. Filename stem match (strongest for flat vaults)
 *   3. Alias match
 *   4. Exact title match
 *   5. Humanized title match (kebab-case → words)
 */
export function resolveEntry(entries: VaultEntry[], rawTarget: string): VaultEntry | undefined {
  const key = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget
  const keyLower = key.toLowerCase()
  const lastSegment = key.includes('/') ? (key.split('/').pop() ?? key) : key
  const lastSegmentLower = lastSegment.toLowerCase()
  const asWords = lastSegmentLower.replace(/-/g, ' ')
  const pathSuffix = key.includes('/') ? '/' + key.toLowerCase() + '.md' : null

  // Pass 1: path-suffix match (for subfolder targets like "docs/adr/0031-foo")
  if (pathSuffix) {
    for (const e of entries) {
      if (e.path.toLowerCase().endsWith(pathSuffix)) return e
    }
  }
  // Pass 2: filename stem (strongest for flat vault)
  for (const e of entries) {
    const stem = e.filename.replace(/\.md$/, '').toLowerCase()
    if (stem === keyLower || stem === lastSegmentLower) return e
  }
  // Pass 3: alias
  for (const e of entries) {
    if (e.aliases.some(a => a.toLowerCase() === keyLower)) return e
  }
  // Pass 4: exact title
  for (const e of entries) {
    if (e.title.toLowerCase() === keyLower || e.title.toLowerCase() === lastSegmentLower) return e
  }
  // Pass 5: humanized title (kebab-case → words)
  if (asWords !== keyLower) {
    for (const e of entries) {
      if (e.title.toLowerCase() === asWords) return e
    }
  }
  return undefined
}
