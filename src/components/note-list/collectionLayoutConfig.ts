import { invoke } from '@tauri-apps/api/core'
import { collectionLayoutKey } from '../../collections/collectionLayoutKey'
import {
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationConfig,
  type CollectionPresentationType,
} from '../../collections/collectionTypes'
import type { SidebarSelection, VaultEntry, ViewDefinition, ViewFile } from '../../types'

export interface LayoutSettings {
  layout: CollectionPresentationType
  groupBy: string
  properties: string[]
  columnOrder: string[]
  collapsedColumns: string[]
  hiddenColumns: string[]
}

/** The Kanban-only part of the layout settings that a View keeps while it shows as List. */
type KanbanColumnSettings = Pick<LayoutSettings, 'properties' | 'columnOrder' | 'collapsedColumns' | 'hiddenColumns'>

export interface LayoutPersistenceTarget {
  selection: SidebarSelection
  views?: ViewFile[]
  vaultPath?: string
  presentation: CollectionPresentationConfig
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>, rootPath?: string) => void
}

type StoredKanbanConfig = KanbanColumnSettings & { groupBy: string | null }
type ViewPresentation = NonNullable<ViewDefinition['presentation']> & { kanbanConfig?: StoredKanbanConfig }

const DEFAULT_GROUP_BY = 'status'

export function viewFor(target: LayoutPersistenceTarget): ViewFile | undefined {
  const { selection, views } = target
  if (selection.kind !== 'view' || !views) return undefined
  return views.find((view) => view.filename === selection.filename && (view.rootPath ?? '') === (selection.rootPath ?? ''))
}

function kanbanColumnSettings(source: Partial<KanbanColumnSettings>): KanbanColumnSettings {
  return {
    properties: stringArray(source.properties),
    columnOrder: stringArray(source.columnOrder),
    collapsedColumns: stringArray(source.collapsedColumns),
    hiddenColumns: stringArray(source.hiddenColumns),
  }
}

function storedKanbanConfig(existing: ViewPresentation): StoredKanbanConfig {
  return { groupBy: existing.groupBy ?? null, ...kanbanColumnSettings(existing) }
}

function mergedViewPresentation(existing: ViewPresentation | undefined, next: ViewDefinition['presentation']): ViewPresentation {
  const merged = { ...existing, ...next } as ViewPresentation
  if (next?.type === COLLECTION_PRESENTATION_LIST && existing?.type === COLLECTION_PRESENTATION_KANBAN) {
    merged.kanbanConfig = storedKanbanConfig(existing)
  } else if (next?.type === COLLECTION_PRESENTATION_KANBAN) {
    delete merged.kanbanConfig
  }
  return merged
}

function saveViewPresentation(target: LayoutPersistenceTarget, view: ViewFile, presentation: ViewDefinition['presentation']) {
  const existing = view.definition.presentation as ViewPresentation | undefined
  const rootPath = target.selection.kind === 'view' ? target.selection.rootPath : undefined
  target.onUpdateViewDefinition?.(view.filename, { presentation: mergedViewPresentation(existing, presentation) }, rootPath)
}

export function configVaultPath(target: Pick<LayoutPersistenceTarget, 'selection' | 'vaultPath'>): string | undefined {
  const { selection } = target
  if (selection.kind === 'view' || selection.kind === 'folder') return selection.rootPath ?? target.vaultPath
  return target.vaultPath
}

export function canUseVaultLayoutFile(selection: SidebarSelection): boolean {
  return selection.kind !== 'view' && selection.kind !== 'entity'
}

function saveVaultLayoutFile(target: LayoutPersistenceTarget, settings: LayoutSettings) {
  const vaultPath = configVaultPath(target)
  if (!vaultPath || !canUseVaultLayoutFile(target.selection)) return
  void invoke('save_collection_layout_cmd', {
    vaultPath,
    collection: collectionLayoutKey(target.selection),
    presentation: { type: settings.layout, groupBy: settings.groupBy, ...kanbanColumnSettings(settings) },
  }).catch(() => undefined)
}

function viewPresentationFor(view: ViewFile, settings: LayoutSettings): ViewDefinition['presentation'] {
  if (settings.layout === COLLECTION_PRESENTATION_KANBAN) {
    return { type: COLLECTION_PRESENTATION_KANBAN, groupBy: settings.groupBy, ...kanbanColumnSettings(settings) }
  }
  return { type: COLLECTION_PRESENTATION_LIST, sort: view.definition.sort, properties: view.definition.listPropertiesDisplay }
}

/** Writes layout settings to the file that owns the collection: the View YAML, or the vault `layouts/` file. */
export function persistLayoutSettings(target: LayoutPersistenceTarget, settings: LayoutSettings) {
  const view = viewFor(target)
  if (view) saveViewPresentation(target, view, viewPresentationFor(view, settings))
  else saveVaultLayoutFile(target, settings)
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLayoutType(value: unknown): value is CollectionPresentationType {
  return value === COLLECTION_PRESENTATION_LIST || value === COLLECTION_PRESENTATION_KANBAN
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function readStoredLayout(value: unknown): LayoutSettings | undefined {
  if (!isConfigRecord(value) || !isLayoutType(value.type)) return undefined
  return {
    layout: value.type,
    groupBy: typeof value.groupBy === 'string' ? value.groupBy : DEFAULT_GROUP_BY,
    ...kanbanColumnSettings(value),
  }
}

function viewKanbanConfig(presentation: ViewPresentation | undefined): StoredKanbanConfig | undefined {
  if (presentation?.type === COLLECTION_PRESENTATION_KANBAN) return storedKanbanConfig(presentation)
  return presentation?.kanbanConfig
}

export function persistedViewLayout(target: LayoutPersistenceTarget): LayoutSettings | undefined {
  const view = viewFor(target)
  const config = viewKanbanConfig(view?.definition.presentation as ViewPresentation | undefined)
  if (!config) return undefined
  return {
    layout: target.presentation.type,
    groupBy: config.groupBy ?? DEFAULT_GROUP_BY,
    ...kanbanColumnSettings(config),
  }
}

function presentationLayout(presentation: CollectionPresentationConfig): LayoutSettings {
  if (presentation.type !== COLLECTION_PRESENTATION_KANBAN) {
    return { layout: presentation.type, groupBy: DEFAULT_GROUP_BY, ...kanbanColumnSettings({}) }
  }
  return {
    layout: COLLECTION_PRESENTATION_KANBAN,
    groupBy: presentation.groupBy ?? DEFAULT_GROUP_BY,
    ...kanbanColumnSettings(presentation),
  }
}

export function effectiveLayout(presentation: CollectionPresentationConfig, saved: LayoutSettings | undefined): LayoutSettings {
  const fallback = presentationLayout(presentation)
  if (!saved) return fallback
  return { ...saved, groupBy: saved.groupBy || fallback.groupBy }
}

function isScalarProperty(value: unknown) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function addEntryKeys(keys: Set<string>, entry: VaultEntry, accept: (value: unknown) => boolean) {
  if (entry.status) keys.add('status')
  Object.entries(entry.properties).forEach(([key, value]) => {
    if (key.trim() && accept(value)) keys.add(key)
  })
}

export function availableGroupProperties(entries: VaultEntry[]): string[] {
  const keys = new Set<string>()
  for (const entry of entries) addEntryKeys(keys, entry, isScalarProperty)
  return [...keys]
}

export function availableCardProperties(entries: VaultEntry[], configured: string[]): string[] {
  const keys = new Set(configured)
  for (const entry of entries) addEntryKeys(keys, entry, () => true)
  return [...keys].sort((left, right) => left.localeCompare(right))
}

/** Property names a Kanban drop may write: letters, digits, `_`, spaces, `.` and `-`, starting with a letter, digit or `_`. */
const WRITABLE_GROUP_KEY = /^[\p{L}\p{N}_][\p{L}\p{N}_ .-]*$/u

/**
 * Kanban drops write the group-by key into note frontmatter. The key comes from layout YAML, so it is only
 * writable when it matches a plain property-name grammar and the board's notes already carry it.
 */
export function isWritableGroupKey(key: string, groups: readonly string[]): boolean {
  if (key.trim() !== key || !WRITABLE_GROUP_KEY.test(key)) return false
  return groups.includes(key)
}
