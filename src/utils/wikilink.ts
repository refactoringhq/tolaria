/** Utility functions for parsing wikilink syntax: [[target|display]] */

import type { VaultEntry } from '../types'
import { slugifyNoteStem } from './noteSlug'

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

/** Slugify a human-readable title into the canonical wikilink filename stem. */
export const slugifyWikilinkTarget = slugifyNoteStem

/** Build the canonical wikilink target for a vault entry. */
export function canonicalWikilinkTargetForEntry(entry: VaultEntry, vaultPath: string): string {
  return relativePathStem(entry.path, vaultPath)
}

/** Resolve a user-facing title/path input to the canonical wikilink target. */
export function canonicalWikilinkTargetForTitle(
  titleOrTarget: string,
  entries: VaultEntry[],
  vaultPath: string,
): string {
  const trimmed = titleOrTarget.trim()
  const resolved = resolveEntry(entries, trimmed)
  return resolved
    ? canonicalWikilinkTargetForEntry(resolved, vaultPath)
    : trimmed.includes('/')
      ? trimmed.replace(/^\/+/, '').replace(/\.md$/, '')
      : slugifyWikilinkTarget(trimmed)
}

/** Wrap a target in wikilink syntax. */
export function formatWikilinkRef(target: string): string {
  return `[[${target}]]`
}

interface ResolutionKey {
  exactTarget: string
  lastSegment: string
  pathSuffix: string | null
  humanizedTarget: string | null
}

function buildResolutionKey(rawTarget: string): ResolutionKey {
  const exactTarget = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget
  const normalizedTarget = exactTarget.toLowerCase()
  const lastSegment = exactTarget.includes('/') ? (exactTarget.split('/').pop() ?? exactTarget).toLowerCase() : normalizedTarget
  const humanizedTarget = lastSegment.replace(/-/g, ' ')

  return {
    exactTarget: normalizedTarget,
    lastSegment,
    pathSuffix: exactTarget.includes('/') ? `/${normalizedTarget}.md` : null,
    humanizedTarget: humanizedTarget === normalizedTarget ? null : humanizedTarget,
  }
}

function findEntryByPathSuffix(entries: VaultEntry[], resolutionKey: ResolutionKey): VaultEntry | undefined {
  if (!resolutionKey.pathSuffix) return undefined
  const { pathSuffix } = resolutionKey
  return entries.find(entry => entry.path.toLowerCase().endsWith(pathSuffix))
}

function findEntryByFilename(entries: VaultEntry[], { exactTarget, lastSegment }: ResolutionKey): VaultEntry | undefined {
  return entries.find((entry) => {
    const stem = entry.filename.replace(/\.md$/, '').toLowerCase()
    return stem === exactTarget || stem === lastSegment
  })
}

function findEntryByAlias(entries: VaultEntry[], resolutionKey: ResolutionKey): VaultEntry | undefined {
  return entries.find(entry => entry.aliases.some(alias => alias.toLowerCase() === resolutionKey.exactTarget))
}

function findEntryByTitle(entries: VaultEntry[], resolutionKey: ResolutionKey): VaultEntry | undefined {
  return entries.find((entry) => {
    const lowerTitle = entry.title.toLowerCase()
    return lowerTitle === resolutionKey.exactTarget || lowerTitle === resolutionKey.lastSegment
  })
}

function findEntryByHumanizedTitle(entries: VaultEntry[], resolutionKey: ResolutionKey): VaultEntry | undefined {
  if (!resolutionKey.humanizedTarget) return undefined
  return entries.find(entry => entry.title.toLowerCase() === resolutionKey.humanizedTarget)
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
  const resolutionKey = buildResolutionKey(rawTarget)
  return (
    findEntryByPathSuffix(entries, resolutionKey)
    ?? findEntryByFilename(entries, resolutionKey)
    ?? findEntryByAlias(entries, resolutionKey)
    ?? findEntryByTitle(entries, resolutionKey)
    ?? findEntryByHumanizedTitle(entries, resolutionKey)
  )
}
