import { invoke } from '@tauri-apps/api/core'
import { collectionLayoutKey } from '../../collections/collectionLayoutKey'
import {
  type CalendarSettings,
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_GRAPH,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationConfig,
  type CollectionPresentationType,
  type GraphSettings,
} from '../../collections/collectionTypes'
import {
  calendarSettingsFrom,
  DEFAULT_CALENDAR_SETTINGS,
  DEFAULT_GRAPH_SETTINGS,
  graphSettingsFrom,
  hasCalendarSettings,
  hasGraphSettings,
} from '../../collections/presentationConfig'
import type { SidebarSelection, VaultEntry, ViewDefinition, ViewFile } from '../../types'

export interface LayoutSettings {
  layout: CollectionPresentationType
  groupBy: string
  properties: string[]
  columnOrder: string[]
  collapsedColumns: string[]
  hiddenColumns: string[]
  calendar: CalendarSettings
  graph: GraphSettings
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
  if (next?.type !== COLLECTION_PRESENTATION_KANBAN && existing?.type === COLLECTION_PRESENTATION_KANBAN) {
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
    presentation: { type: settings.layout, groupBy: settings.groupBy, ...kanbanColumnSettings(settings), ...storedCalendarSettings(settings), ...storedGraphSettings(settings) },
  }).catch(() => undefined)
}

function sameSettings<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Calendar settings are only written once the list has used or configured a calendar. */
function storedCalendarSettings(settings: LayoutSettings): Partial<CalendarSettings> {
  if (settings.layout !== COLLECTION_PRESENTATION_CALENDAR && sameSettings(settings.calendar, DEFAULT_CALENDAR_SETTINGS)) return {}
  return { ...settings.calendar }
}

/** Graph filters are only written once the list has used or configured a graph. */
function storedGraphSettings(settings: LayoutSettings): Partial<GraphSettings> {
  if (settings.layout !== COLLECTION_PRESENTATION_GRAPH && sameSettings(settings.graph, DEFAULT_GRAPH_SETTINGS)) return {}
  return { ...settings.graph }
}

function viewPresentationFor(view: ViewFile, settings: LayoutSettings): ViewDefinition['presentation'] {
  if (settings.layout === COLLECTION_PRESENTATION_KANBAN) {
    return { type: COLLECTION_PRESENTATION_KANBAN, groupBy: settings.groupBy, ...kanbanColumnSettings(settings) }
  }
  if (settings.layout === COLLECTION_PRESENTATION_CALENDAR) {
    return { type: COLLECTION_PRESENTATION_CALENDAR, ...settings.calendar, properties: settings.properties }
  }
  if (settings.layout === COLLECTION_PRESENTATION_GRAPH) return { type: COLLECTION_PRESENTATION_GRAPH, ...settings.graph }
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

const LAYOUT_TYPES: readonly unknown[] = [
  COLLECTION_PRESENTATION_LIST,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_GRAPH,
]

function isLayoutType(value: unknown): value is CollectionPresentationType {
  return LAYOUT_TYPES.includes(value)
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
    calendar: calendarSettingsFrom(value),
    graph: graphSettingsFrom(value),
  }
}

function viewKanbanConfig(presentation: ViewPresentation | undefined): StoredKanbanConfig | undefined {
  if (presentation?.type === COLLECTION_PRESENTATION_KANBAN) return storedKanbanConfig(presentation)
  return presentation?.kanbanConfig
}

/** Card fields: a calendar View keeps its own at the top level, every other layout uses the Kanban ones. */
function viewCardProperties(presentation: ViewPresentation | undefined, kanban: StoredKanbanConfig | undefined): string[] {
  if (presentation?.type === COLLECTION_PRESENTATION_CALENDAR) return stringArray(presentation.properties)
  return stringArray(kanban?.properties)
}

export function persistedViewLayout(target: LayoutPersistenceTarget): LayoutSettings | undefined {
  const presentation = viewFor(target)?.definition.presentation as ViewPresentation | undefined
  const config = viewKanbanConfig(presentation)
  const record: Record<string, unknown> = { ...presentation }
  if (!config && !hasCalendarSettings(record) && !hasGraphSettings(record)) return undefined
  return {
    layout: target.presentation.type,
    groupBy: config?.groupBy ?? DEFAULT_GROUP_BY,
    ...kanbanColumnSettings(config ?? {}),
    properties: viewCardProperties(presentation, config),
    calendar: calendarSettingsFrom(record),
    graph: graphSettingsFrom(record),
  }
}

function presentationLayout(presentation: CollectionPresentationConfig): LayoutSettings {
  const base = {
    layout: presentation.type,
    groupBy: DEFAULT_GROUP_BY,
    ...kanbanColumnSettings({}),
    calendar: DEFAULT_CALENDAR_SETTINGS,
    graph: DEFAULT_GRAPH_SETTINGS,
  }
  if (presentation.type === COLLECTION_PRESENTATION_CALENDAR) {
    return { ...base, properties: presentation.properties, calendar: calendarSettingsFrom({ ...presentation }) }
  }
  if (presentation.type === COLLECTION_PRESENTATION_GRAPH) return { ...base, graph: graphSettingsFrom({ ...presentation }) }
  if (presentation.type !== COLLECTION_PRESENTATION_KANBAN) return base
  return { ...base, groupBy: presentation.groupBy ?? DEFAULT_GROUP_BY, ...kanbanColumnSettings(presentation) }
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
