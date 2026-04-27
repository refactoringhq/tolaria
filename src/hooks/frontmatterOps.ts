import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import { updateMockFrontmatter, deleteMockFrontmatterProperty } from './mockFrontmatterHelpers'
import { updateMockContent, trackMockChange } from '../mock-tauri'
import { parseFrontmatter } from '../utils/frontmatter'
import { canonicalSystemMetadataKey, isSystemMetadataKey } from '../utils/systemMetadata'

const ENTRY_DELETE_MAP: Record<string, Partial<VaultEntry>> = {
  title: { title: '' },
  type: { isA: null }, is_a: { isA: null }, status: { status: null }, color: { color: null },
  _icon: { icon: null }, _sidebar_label: { sidebarLabel: null },
  aliases: { aliases: [] }, belongs_to: { belongsTo: [] }, related_to: { relatedTo: [] },
  _archived: { archived: false }, archived: { archived: false },
  _order: { order: null },
  template: { template: null }, _sort: { sort: null }, visible: { visible: null },
  _width: { noteWidth: null },
  _organized: { organized: false },
  _favorite: { favorite: false }, _favorite_index: { favoriteIndex: null },
  _list_properties_display: { listPropertiesDisplay: [] },
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

/** Properties patch: a partial update to merge into `entry.properties`.
 *  Keys map to their new scalar values. A `null` value means "remove this key". */
export type PropertiesPatch = Record<string, string | number | boolean | null>

export interface EntryPatchResult {
  patch: Partial<VaultEntry>
  relationshipPatch: RelationshipPatch | null
  propertiesPatch: PropertiesPatch | null
}

function applyRecordPatch<T>(
  existing: Record<string, T>,
  patch: Record<string, T | null>,
): Record<string, T> {
  const merged = { ...existing }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key]
    else merged[key] = value
  }
  return merged
}

/** Map a frontmatter key+value to the corresponding VaultEntry field(s). */
export function frontmatterToEntryPatch(
  op: 'update' | 'delete', key: string, value?: FrontmatterValue,
): EntryPatchResult {
  const lookupKey = canonicalSystemMetadataKey(key)
  const systemMetadataKey = isSystemMetadataKey(key)
  if (op === 'delete') {
    const relationshipPatch = systemMetadataKey ? null : { [key]: null }
    const propertiesPatch = !systemMetadataKey && !(lookupKey in ENTRY_DELETE_MAP) ? { [key]: null } : null
    return { patch: ENTRY_DELETE_MAP[lookupKey] ?? {}, relationshipPatch, propertiesPatch }
  }
  const str = value != null ? String(value) : null
  const arr = Array.isArray(value) ? value.map(String) : []
  const updates: Record<string, Partial<VaultEntry>> = {
    title: { title: str ?? '' },
    type: { isA: str }, is_a: { isA: str }, status: { status: str }, color: { color: str },
    _icon: { icon: str }, _sidebar_label: { sidebarLabel: str },
    aliases: { aliases: arr }, belongs_to: { belongsTo: arr }, related_to: { relatedTo: arr },
    _archived: { archived: Boolean(value) }, archived: { archived: Boolean(value) },
    _order: { order: typeof value === 'number' ? value : null },
    template: { template: str },
    _sort: { sort: str },
    view: { view: str },
    _width: { noteWidth: str === 'wide' || str === 'normal' ? str : null },
    visible: { visible: value === false ? false : null },
    _organized: { organized: Boolean(value) },
    _favorite: { favorite: Boolean(value) },
    _favorite_index: { favoriteIndex: typeof value === 'number' ? value : null },
    _list_properties_display: { listPropertiesDisplay: Array.isArray(value) ? value.map(String) : [] },
  }
  // Also update the relationships map for wikilink-containing values
  const wikilinks = value != null ? extractWikilinks(value) : []
  const relationshipPatch: RelationshipPatch | null =
    !systemMetadataKey && wikilinks.length > 0 ? { [key]: wikilinks } : null
  // For unknown keys (custom properties), produce a propertiesPatch
  const isKnownKey = lookupKey in updates
  const propertiesPatch: PropertiesPatch | null =
    !systemMetadataKey && !isKnownKey && value != null
      ? { [key]: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : String(value) }
      : null
  return { patch: updates[lookupKey] ?? {}, relationshipPatch, propertiesPatch }
}

/** Parse frontmatter from full content and return a merged VaultEntry patch for all known fields. */
export function contentToEntryPatch(content: string): Partial<VaultEntry> {
  const fm = parseFrontmatter(content)
  const merged: Partial<VaultEntry> = {}
  const customProps: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(fm)) {
    const { patch, propertiesPatch } = frontmatterToEntryPatch('update', key, value)
    Object.assign(merged, patch)
    if (propertiesPatch) Object.assign(customProps, propertiesPatch)
  }
  if (Object.keys(customProps).length > 0) merged.properties = customProps
  return merged
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

/** Apply a properties patch by merging into the existing properties map. */
export function applyPropertiesPatch(
  existing: Record<string, string | number | boolean | null>, propPatch: PropertiesPatch,
): Record<string, string | number | boolean | null> {
  return applyRecordPatch(existing, propPatch)
}

/** Apply a relationship patch by merging into the existing relationships map. */
export function applyRelationshipPatch(
  existing: Record<string, string[]>, relPatch: RelationshipPatch,
): Record<string, string[]> {
  return applyRecordPatch(existing, relPatch)
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
    const { patch, relationshipPatch, propertiesPatch } = frontmatterToEntryPatch(op, key, value)
    const fullPatch = { ...patch }
    if ((relationshipPatch || propertiesPatch) && callbacks.getEntry) {
      const current = callbacks.getEntry(path)
      if (current) {
        if (relationshipPatch) {
          fullPatch.relationships = applyRelationshipPatch(current.relationships, relationshipPatch)
        }
        if (propertiesPatch) {
          fullPatch.properties = applyPropertiesPatch(current.properties, propertiesPatch)
        }
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
