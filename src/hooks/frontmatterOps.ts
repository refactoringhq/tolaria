import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { updateMockFrontmatter, deleteMockFrontmatterProperty } from './mockFrontmatterHelpers'
import { updateMockContent, trackMockChange } from '../mock-tauri'

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  icon: { icon: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  archived: { archived: false }, trashed: { trashed: false }, order: { order: null },
  template: { template: null }, sort: { sort: null }, visible: { visible: null },
}

/** Check if a string contains a wikilink pattern `[[...]]`. */
function isWikilink(s: string): boolean {
  return s.startsWith('[[') && s.includes(']]')
}

/** Extract wikilink strings from a FrontmatterValue. Returns empty array if none. */
function extractWikilinks(value: FrontmatterValue): string[] {
  if (typeof value === 'string') return isWikilink(value) ? [value] : []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && isWikilink(v))
  return []
}

/**
 * Relationship patch: a partial update to merge into `entry.relationships`.
 * Keys map to their new ref arrays. A `null` value means "remove this key".
 */
export type RelationshipPatch = Record<string, string[] | null>

export interface EntryPatchResult {
  patch: Partial<VaultEntry>
  relationshipPatch: RelationshipPatch | null
}

/** Map a frontmatter key+value to the corresponding VaultEntry field(s). */
export function frontmatterToEntryPatch(
  op: 'update' | 'delete', key: string, value?: FrontmatterValue,
): EntryPatchResult {
  const k = key.toLowerCase().replace(/\s+/g, '_')
  if (op === 'delete') {
    const relPatch: RelationshipPatch = { [key]: null }
    return { patch: ENTRY_DELETE_MAP[k] ?? {}, relationshipPatch: relPatch }
  }
  const str = value != null ? String(value) : null
  const arr = Array.isArray(value) ? value.map(String) : []
  const updates: Record<string, Partial<VaultEntry>> = {
    type: { isA: str }, is_a: { isA: str }, status: { status: str }, color: { color: str },
    icon: { icon: str },
    aliases: { aliases: arr }, belongs_to: { belongsTo: arr }, related_to: { relatedTo: arr },
    archived: { archived: Boolean(value) }, trashed: { trashed: Boolean(value) },
    order: { order: typeof value === 'number' ? value : null },
    template: { template: str },
    sort: { sort: str },
    view: { view: str },
    visible: { visible: value === false ? false : null },
  }
  // Also update the relationships map for wikilink-containing values
  const wikilinks = value != null ? extractWikilinks(value) : []
  const relationshipPatch: RelationshipPatch | null =
    wikilinks.length > 0 ? { [key]: wikilinks } : null
  return { patch: updates[k] ?? {}, relationshipPatch }
}

async function invokeFrontmatter(command: string, args: Record<string, unknown>): Promise<string> {
  return invoke<string>(command, args)
}

function applyMockFrontmatterUpdate(path: string, key: string, value: FrontmatterValue): string {
  const content = updateMockFrontmatter(path, key, value)
  updateMockContent(path, content)
  trackMockChange(path)
  return content
}

function applyMockFrontmatterDelete(path: string, key: string): string {
  const content = deleteMockFrontmatterProperty(path, key)
  updateMockContent(path, content)
  trackMockChange(path)
  return content
}

async function executeFrontmatterOp(op: 'update' | 'delete', path: string, key: string, value?: FrontmatterValue): Promise<string> {
  if (op === 'update') {
    return isTauri() ? invokeFrontmatter('update_frontmatter', { path, key, value }) : applyMockFrontmatterUpdate(path, key, value!)
  }
  return isTauri() ? invokeFrontmatter('delete_frontmatter_property', { path, key }) : applyMockFrontmatterDelete(path, key)
}

export interface FrontmatterOpOptions {
  /** Suppress toast feedback (caller manages its own toast). */
  silent?: boolean
}

/** Apply a relationship patch by merging into the existing relationships map. */
export function applyRelationshipPatch(
  existing: Record<string, string[]>, relPatch: RelationshipPatch,
): Record<string, string[]> {
  const merged = { ...existing }
  for (const [k, v] of Object.entries(relPatch)) {
    if (v === null) delete merged[k]
    else merged[k] = v
  }
  return merged
}

/** Run a frontmatter update/delete and apply the result to state.
 *  Returns the new file content on success, or undefined on failure. */
export async function runFrontmatterAndApply(
  op: 'update' | 'delete', path: string, key: string, value: FrontmatterValue | undefined,
  callbacks: {
    updateTab: (p: string, c: string) => void
    updateEntry: (p: string, patch: Partial<VaultEntry>) => void
    toast: (m: string | null) => void
    getEntry?: (p: string) => VaultEntry | undefined
  },
  options?: FrontmatterOpOptions,
): Promise<string | undefined> {
  try {
    const newContent = await executeFrontmatterOp(op, path, key, value)
    callbacks.updateTab(path, newContent)
    const { patch, relationshipPatch } = frontmatterToEntryPatch(op, key, value)
    const fullPatch = { ...patch }
    if (relationshipPatch && callbacks.getEntry) {
      const current = callbacks.getEntry(path)
      if (current) {
        fullPatch.relationships = applyRelationshipPatch(current.relationships, relationshipPatch)
      }
    }
    if (Object.keys(fullPatch).length > 0) callbacks.updateEntry(path, fullPatch)
    if (!options?.silent) callbacks.toast(op === 'update' ? 'Property updated' : 'Property deleted')
    return newContent
  } catch (err) {
    console.error(`Failed to ${op} frontmatter:`, err)
    if (options?.silent) throw err
    callbacks.toast(`Failed to ${op} property`)
    return undefined
  }
}
