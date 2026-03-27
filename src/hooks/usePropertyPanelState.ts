import { useMemo, useState, useCallback } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from '../components/Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import {
  type PropertyDisplayMode,
  loadDisplayModeOverrides,
  saveDisplayModeOverride,
  removeDisplayModeOverride,
} from '../utils/propertyTypes'
import { containsWikilinks } from '../components/DynamicPropertiesPanel'

// Keys to skip showing in Properties (handled by dedicated UI or internal)
// Compared case-insensitively via isVisibleProperty()
const SKIP_KEYS = new Set(['aliases', 'workspace', 'title', 'type', 'is_a', 'is a', 'trashed', 'trashed_at', 'archived', 'archived_at', 'icon'])

function coerceValue(raw: string): FrontmatterValue {
  if (raw.toLowerCase() === 'true') return true
  if (raw.toLowerCase() === 'false') return false
  if (!isNaN(Number(raw)) && raw.trim() !== '') return Number(raw)
  return raw
}

function parseNewValue(rawValue: string): FrontmatterValue {
  if (!rawValue.includes(',')) return rawValue.trim() || ''
  const items = rawValue.split(',').map(s => s.trim()).filter(s => s)
  return items.length === 1 ? items[0] : items
}

function reconcileListUpdate(
  newItems: string[],
  onUpdate: (key: string, value: FrontmatterValue) => void,
  onDelete: ((key: string) => void) | undefined,
  key: string,
) {
  if (newItems.length === 0) onDelete?.(key)
  else if (newItems.length === 1) onUpdate(key, newItems[0])
  else onUpdate(key, newItems)
}

function deriveTypeInfo(entries: VaultEntry[] | undefined, entryIsA: string | null) {
  const typeEntries = (entries ?? []).filter(e => e.isA === 'Type')
  const typeColorKeys: Record<string, string | null> = {}
  const typeIconKeys: Record<string, string | null> = {}
  for (const e of typeEntries) {
    typeColorKeys[e.title] = e.color ?? null
    typeIconKeys[e.title] = e.icon ?? null
  }
  return {
    availableTypes: typeEntries.map(e => e.title).sort((a, b) => a.localeCompare(b)),
    customColorKey: entryIsA ? (typeColorKeys[entryIsA] ?? null) : null,
    typeColorKeys,
    typeIconKeys,
  }
}

function collectVaultStatuses(entries: VaultEntry[] | undefined): string[] {
  const seen = new Set<string>()
  for (const e of entries ?? []) {
    if (e.status) seen.add(e.status)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

function collectAllVaultTags(entries: VaultEntry[] | undefined): Record<string, string[]> {
  if (!entries) return {}
  const tagsByKey = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!entry.properties) continue
    for (const [key, value] of Object.entries(entry.properties)) {
      if (!Array.isArray(value)) continue
      let set = tagsByKey.get(key)
      if (!set) { set = new Set(); tagsByKey.set(key, set) }
      for (const tag of value) set.add(String(tag))
    }
  }
  const result: Record<string, string[]> = {}
  for (const [key, set] of tagsByKey) result[key] = Array.from(set).sort((a, b) => a.localeCompare(b))
  return result
}

function isVisibleProperty([key, value]: [string, FrontmatterValue]): boolean {
  return !SKIP_KEYS.has(key.toLowerCase()) && !containsWikilinks(value)
}

function parseAddedValue(rawValue: string, mode: PropertyDisplayMode): FrontmatterValue {
  if (mode === 'boolean') return rawValue.toLowerCase() === 'true'
  if (mode === 'tags') {
    const items = rawValue.split(',').map(s => s.trim()).filter(s => s)
    return items
  }
  return parseNewValue(rawValue)
}

function persistModeOverride(key: string, mode: PropertyDisplayMode | null) {
  if (mode === null) removeDisplayModeOverride(key)
  else saveDisplayModeOverride(key, mode)
}

export interface PropertyPanelDeps {
  entries: VaultEntry[] | undefined
  entryIsA: string | null
  frontmatter: ParsedFrontmatter
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
}

export function usePropertyPanelState(deps: PropertyPanelDeps) {
  const { entries, entryIsA, frontmatter, onUpdateProperty, onDeleteProperty, onAddProperty } = deps
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [displayOverrides, setDisplayOverrides] = useState(() => loadDisplayModeOverrides())

  const { availableTypes, customColorKey, typeColorKeys, typeIconKeys } = useMemo(() => deriveTypeInfo(entries, entryIsA), [entries, entryIsA])
  const vaultStatuses = useMemo(() => collectVaultStatuses(entries), [entries])
  const vaultTagsByKey = useMemo(() => collectAllVaultTags(entries), [entries])
  const propertyEntries = useMemo(() => Object.entries(frontmatter).filter(isVisibleProperty), [frontmatter])

  const handleSaveValue = useCallback((key: string, newValue: string) => {
    setEditingKey(null)
    if (onUpdateProperty) onUpdateProperty(key, coerceValue(newValue))
  }, [onUpdateProperty])

  const handleSaveList = useCallback((key: string, newItems: string[]) => {
    if (!onUpdateProperty) return
    reconcileListUpdate(newItems, onUpdateProperty, onDeleteProperty, key)
  }, [onUpdateProperty, onDeleteProperty])

  const handleAdd = useCallback((rawKey: string, rawValue: string, mode: PropertyDisplayMode) => {
    if (!rawKey.trim() || !onAddProperty) return
    onAddProperty(rawKey.trim(), parseAddedValue(rawValue, mode))
    if (mode !== 'text') {
      persistModeOverride(rawKey.trim(), mode)
      setDisplayOverrides(loadDisplayModeOverrides())
    }
    setShowAddDialog(false)
  }, [onAddProperty])

  const handleDisplayModeChange = useCallback((key: string, mode: PropertyDisplayMode | null) => {
    persistModeOverride(key, mode)
    setDisplayOverrides(loadDisplayModeOverrides())
  }, [])

  return {
    editingKey, setEditingKey, showAddDialog, setShowAddDialog, displayOverrides,
    availableTypes, customColorKey, typeColorKeys, typeIconKeys, vaultStatuses, vaultTagsByKey, propertyEntries,
    handleSaveValue, handleSaveList, handleAdd, handleDisplayModeChange,
  }
}
