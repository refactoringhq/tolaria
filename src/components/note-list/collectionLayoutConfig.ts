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
}

export interface LayoutPersistenceTarget {
  selection: SidebarSelection
  views?: ViewFile[]
  vaultPath?: string
  presentation: CollectionPresentationConfig
  onUpdateViewDefinition?: (filename: string, patch: Partial<ViewDefinition>, rootPath?: string) => void
}

type StoredKanbanConfig = { groupBy: string | null; properties: string[]; columnOrder: string[] }
type ViewPresentation = NonNullable<ViewDefinition['presentation']> & { kanbanConfig?: StoredKanbanConfig }

const DEFAULT_GROUP_BY = 'status'

export function viewFor(target: LayoutPersistenceTarget): ViewFile | undefined {
  const { selection, views } = target
  if (selection.kind !== 'view' || !views) return undefined
  return views.find((view) => view.filename === selection.filename && (view.rootPath ?? '') === (selection.rootPath ?? ''))
}

function storedKanbanConfig(existing: ViewPresentation): StoredKanbanConfig {
  return {
    groupBy: existing.groupBy ?? null,
    properties: existing.properties ?? [],
    columnOrder: existing.columnOrder ?? [],
  }
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
    presentation: {
      type: settings.layout,
      groupBy: settings.groupBy,
      columnOrder: settings.columnOrder,
      properties: settings.properties,
    },
  }).catch(() => undefined)
}

function viewPresentationFor(view: ViewFile, settings: LayoutSettings): ViewDefinition['presentation'] {
  if (settings.layout === COLLECTION_PRESENTATION_KANBAN) {
    const { groupBy, properties, columnOrder } = settings
    return { type: COLLECTION_PRESENTATION_KANBAN, groupBy, properties, columnOrder }
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
    properties: stringArray(value.properties),
    columnOrder: stringArray(value.columnOrder),
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
    properties: config.properties ?? [],
    columnOrder: config.columnOrder ?? [],
  }
}

function presentationLayout(presentation: CollectionPresentationConfig): LayoutSettings {
  if (presentation.type !== COLLECTION_PRESENTATION_KANBAN) {
    return { layout: presentation.type, groupBy: DEFAULT_GROUP_BY, properties: [], columnOrder: [] }
  }
  return {
    layout: COLLECTION_PRESENTATION_KANBAN,
    groupBy: presentation.groupBy ?? DEFAULT_GROUP_BY,
    properties: presentation.properties,
    columnOrder: presentation.columnOrder,
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
  entries.forEach((entry) => addEntryKeys(keys, entry, isScalarProperty))
  return [...keys]
}

export function availableCardProperties(entries: VaultEntry[], configured: string[]): string[] {
  const keys = new Set(configured)
  entries.forEach((entry) => addEntryKeys(keys, entry, () => true))
  return [...keys].sort((left, right) => left.localeCompare(right))
}

/**
 * Kanban drops write the group-by key into note frontmatter. The key comes from layout YAML, so it is only
 * writable when it is a single-line key that the board's notes already carry.
 */
export function isWritableGroupKey(key: string, groups: readonly string[]): boolean {
  if (key === '' || key.trim() !== key || hasControlCharacter(key)) return false
  return groups.includes(key)
}

/** NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR also break lines in YAML. */
const YAML_UNICODE_LINE_BREAKS = new Set([0x85, 0x2028, 0x2029])

function hasControlCharacter(text: string): boolean {
  return [...text].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 || YAML_UNICODE_LINE_BREAKS.has(code)
  })
}
