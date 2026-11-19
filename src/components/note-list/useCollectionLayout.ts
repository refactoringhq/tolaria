import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectionLayoutKey } from '../../collections/collectionLayoutKey'
import {
  type CalendarSettings,
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_GRAPH,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationType,
  type GraphSettings,
  SET_COLLECTION_LAYOUT_EVENT,
} from '../../collections/collectionTypes'
import { getCollectionLayout, getCollectionLayouts } from '../../collections/layoutRegistry'
import { trackEvent } from '../../lib/telemetry'
import type { SidebarSelection, VaultEntry } from '../../types'
import {
  availableCardProperties,
  availableGroupProperties,
  canUseVaultLayoutFile,
  configVaultPath,
  effectiveLayout,
  type LayoutPersistenceTarget,
  type LayoutSettings,
  persistedViewLayout,
  persistLayoutSettings,
  readStoredLayout,
} from './collectionLayoutConfig'
import { availableDateProperties, resolveDateProperty } from './calendar/calendarModel'
import { buildGraphData } from './graph/graphModel'
import { toggleColumnValue } from './kanbanModel'

export interface CollectionLayoutSource extends LayoutPersistenceTarget {
  visibleEntries: VaultEntry[]
  /** Every vault note, so graph links resolve aliases and titles exactly like the editor. */
  allEntries?: VaultEntry[]
  selectedNotePath?: string | null
}

type SettingsMap = Map<string, LayoutSettings>
type SetSettingsMap = React.Dispatch<React.SetStateAction<SettingsMap>>

function usePersistedLayout(source: CollectionLayoutSource, key: string) {
  const [storedConfigs, setStoredConfigs] = useState<SettingsMap>(() => new Map())
  const vaultPath = configVaultPath(source)
  const canLoad = canUseVaultLayoutFile(source.selection)
  useEffect(() => {
    if (!vaultPath || !canLoad) return
    let current = true
    void invoke<Record<string, unknown>>('list_collection_layouts', { vaultPath }).then((configs) => {
      const saved = readStoredLayout(Object.entries(configs).find(([collection]) => collection === key)?.[1])
      if (current && saved) setStoredConfigs((previous) => new Map(previous).set(key, saved))
    }).catch(() => undefined)
    return () => { current = false }
  }, [canLoad, key, vaultPath])
  return storedConfigs.get(key) ?? persistedViewLayout(source)
}

function isFormField(target: HTMLElement): boolean {
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

function isLayoutToggleShortcut(event: KeyboardEvent): boolean {
  if (event.target instanceof HTMLElement && isFormField(event.target)) return false
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g'
}

function requestedLayout(event: Event): CollectionPresentationType | undefined {
  if (!(event instanceof CustomEvent)) return undefined
  return getCollectionLayouts().find((layout) => layout.type === event.detail)?.type
}

function useLayoutShortcut(enabled: boolean, layout: CollectionPresentationType, changeLayout: (next: CollectionPresentationType) => void) {
  useEffect(() => {
    if (!enabled) return
    const toggle = () => changeLayout(layout === COLLECTION_PRESENTATION_LIST ? COLLECTION_PRESENTATION_KANBAN : COLLECTION_PRESENTATION_LIST)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLayoutToggleShortcut(event)) return
      event.preventDefault()
      toggle()
    }
    const onSetLayout = (event: Event) => {
      const next = requestedLayout(event)
      if (next) changeLayout(next)
    }
    window.addEventListener('laputa:toggle-collection-layout', toggle)
    window.addEventListener(SET_COLLECTION_LAYOUT_EVENT, onSetLayout)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('laputa:toggle-collection-layout', toggle)
      window.removeEventListener(SET_COLLECTION_LAYOUT_EVENT, onSetLayout)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [changeLayout, enabled, layout])
}

/**
 * Tracks which open note the user dismissed, so the editor panel of a non-list layout (Kanban, Calendar)
 * starts closed and reopens on a new card.
 */
function useKanbanPanel(key: string, layout: CollectionPresentationType, selectedNotePath: string | null) {
  const [dismissal, setDismissal] = useState({ key, layout, path: selectedNotePath })
  if (dismissal.key !== key || dismissal.layout !== layout) {
    setDismissal({ key, layout, path: selectedNotePath })
  }
  const open = layout !== COLLECTION_PRESENTATION_LIST && selectedNotePath !== null && selectedNotePath !== dismissal.path
  const close = useCallback(() => setDismissal({ key, layout, path: selectedNotePath }), [key, layout, selectedNotePath])
  const reopen = useCallback(() => setDismissal({ key, layout, path: null }), [key, layout])
  return { open, close, reopen }
}

function sameLayoutSettings(left: LayoutSettings, right: LayoutSettings): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

interface ColumnToggleActions {
  added: string
  removed: string
}

const COLLAPSE_ACTIONS: ColumnToggleActions = { added: 'collapse', removed: 'expand' }
const HIDE_ACTIONS: ColumnToggleActions = { added: 'hide', removed: 'show' }

/** Toggles a column in a collapsed or hidden list and reports which way it went (never the column name). */
function toggledColumnList(list: readonly string[], group: string, actions: ColumnToggleActions): string[] {
  trackEvent('kanban_column_visibility_changed', { action: list.includes(group) ? actions.removed : actions.added })
  return toggleColumnValue(list, group)
}

/** The calendar settings to save: a default date property is pinned, so a later new date key never moves the notes. */
function pinnedCalendar(calendar: CalendarSettings, resolvedDateProperty: string | null, patch: Partial<CalendarSettings> = {}): CalendarSettings {
  return { ...calendar, dateProperty: calendar.dateProperty ?? resolvedDateProperty, ...patch }
}

function layoutPatch(layout: CollectionPresentationType, current: LayoutSettings, resolvedDateProperty: string | null): Partial<LayoutSettings> {
  if (layout !== COLLECTION_PRESENTATION_CALENDAR) return { layout }
  return { layout, calendar: pinnedCalendar(current.calendar, resolvedDateProperty) }
}

interface LayoutActionSource {
  source: CollectionLayoutSource
  key: string
  current: LayoutSettings
  setOverrides: SetSettingsMap
  resolvedDateProperty: string | null
}

function useLayoutActions({ source, key, current, setOverrides, resolvedDateProperty }: LayoutActionSource) {
  const enabled = supportsLayouts(source.selection)
  const update = useCallback((patch: Partial<LayoutSettings>) => {
    const next = { ...current, ...patch }
    if (sameLayoutSettings(current, next)) return
    setOverrides((overrides) => new Map(overrides).set(key, next))
    persistLayoutSettings(source, next)
  }, [current, key, setOverrides, source])
  const changeLayout = useCallback((layout: CollectionPresentationType) => {
    if (layout === current.layout) return
    update(layoutPatch(layout, current, resolvedDateProperty))
    trackEvent('collection_layout_changed', { layout, collection: source.selection.kind })
  }, [current, resolvedDateProperty, source.selection.kind, update])
  useLayoutShortcut(enabled, current.layout, changeLayout)
  return {
    changeLayout,
    changeGroupBy: (groupBy: string) => update({ groupBy }),
    changeCardProperties: (properties: string[] | null) => update({ properties: properties ?? [] }),
    changeColumnOrder: (columnOrder: string[]) => update({ columnOrder }),
    toggleColumnCollapsed: (group: string) => update({ collapsedColumns: toggledColumnList(current.collapsedColumns, group, COLLAPSE_ACTIONS) }),
    toggleColumnHidden: (group: string) => update({ hiddenColumns: toggledColumnList(current.hiddenColumns, group, HIDE_ACTIONS) }),
    changeCalendar: (patch: Partial<CalendarSettings>) => update({ calendar: pinnedCalendar(current.calendar, resolvedDateProperty, patch) }),
    changeGraph: (patch: Partial<GraphSettings>) => {
      update({ graph: { ...current.graph, ...patch } })
      trackEvent('graph_filter_changed', { filter: Object.keys(patch).join(',') })
    },
  }
}

/** The calendar's date property: the configured one, or the best date property the list's notes carry. */
function useCalendarDates(entries: VaultEntry[], calendar: CalendarSettings) {
  const dateOptions = useMemo(() => availableDateProperties(entries), [entries])
  return { dateOptions, dateProperty: resolveDateProperty(calendar.dateProperty, dateOptions) }
}

/** Links between the list's notes, only computed while the list shows as a graph. */
function useGraphData(source: CollectionLayoutSource, layout: CollectionPresentationType) {
  const { visibleEntries, allEntries } = source
  return useMemo(
    () => layout === COLLECTION_PRESENTATION_GRAPH ? buildGraphData(visibleEntries, allEntries ?? visibleEntries) : null,
    [allEntries, layout, visibleEntries],
  )
}

/** Neighborhood and Changes lists have their own structure, so they always render as List. */
export function supportsLayouts(selection: SidebarSelection): boolean {
  if (selection.kind === 'entity') return false
  return !(selection.kind === 'filter' && selection.filter === 'changes')
}

function resolveCurrentLayout(source: CollectionLayoutSource, saved: LayoutSettings | undefined): LayoutSettings {
  const current = effectiveLayout(source.presentation, saved)
  // A saved layout whose feature flag is off (or that this build doesn't know) shows as List; the file stays untouched.
  const layout = supportsLayouts(source.selection) ? getCollectionLayout(current.layout).type : COLLECTION_PRESENTATION_LIST
  return { ...current, layout }
}

export function useCollectionLayout(source: CollectionLayoutSource) {
  const key = collectionLayoutKey(source.selection)
  const [overrides, setOverrides] = useState<SettingsMap>(() => new Map())
  const persisted = usePersistedLayout(source, key)
  const current = resolveCurrentLayout(source, overrides.get(key) ?? persisted)
  const groups = useMemo(() => availableGroupProperties(source.visibleEntries), [source.visibleEntries])
  const cardFields = useMemo(
    () => availableCardProperties(source.visibleEntries, current.properties),
    [current.properties, source.visibleEntries],
  )
  const calendarDates = useCalendarDates(source.visibleEntries, current.calendar)
  const actions = useLayoutActions({ source, key, current, setOverrides, resolvedDateProperty: calendarDates.dateProperty })
  const panel = useKanbanPanel(key, current.layout, source.selectedNotePath ?? null)
  const graphData = useGraphData(source, current.layout)
  return { ...current, enabled: supportsLayouts(source.selection), groups, cardFields, panel, graphData, ...calendarDates, ...actions }
}

export type CollectionLayoutState = ReturnType<typeof useCollectionLayout>
