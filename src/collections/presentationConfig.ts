import type { ViewDefinition } from '../types'
import {
  type CalendarCollectionPresentationConfig,
  type CalendarSettings,
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationConfig,
  type KanbanCollectionPresentationConfig,
  type ListCollectionPresentationConfig,
} from './collectionTypes'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function listPresentation(source: UnknownRecord, fallback: ListCollectionPresentationConfig): ListCollectionPresentationConfig {
  return {
    type: COLLECTION_PRESENTATION_LIST,
    sort: nullableString(source.sort) ?? fallback.sort,
    properties: stringArray(source.properties).length > 0 ? stringArray(source.properties) : fallback.properties,
  }
}

function kanbanPresentation(source: UnknownRecord): KanbanCollectionPresentationConfig {
  return {
    type: COLLECTION_PRESENTATION_KANBAN,
    groupBy: nullableString(source.groupBy),
    properties: stringArray(source.properties),
    columnOrder: stringArray(source.columnOrder),
    collapsedColumns: stringArray(source.collapsedColumns),
    hiddenColumns: stringArray(source.hiddenColumns),
  }
}

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  dateProperty: null,
  endDateProperty: null,
  view: 'month',
  showWeekends: true,
}

const CALENDAR_SETTING_KEYS = ['dateProperty', 'endDateProperty', 'view', 'showWeekends'] as const

/** True when a stored presentation carries any calendar setting, even while it shows another layout. */
export function hasCalendarSettings(source: UnknownRecord): boolean {
  return CALENDAR_SETTING_KEYS.some((key) => key in source)
}

/** Reads calendar settings defensively: anything unexpected falls back to the default. */
export function calendarSettingsFrom(source: UnknownRecord): CalendarSettings {
  return {
    dateProperty: nullableString(source.dateProperty),
    endDateProperty: nullableString(source.endDateProperty),
    view: source.view === 'week' ? 'week' : 'month',
    showWeekends: source.showWeekends !== false,
  }
}

function calendarPresentation(source: UnknownRecord): CalendarCollectionPresentationConfig {
  return { type: COLLECTION_PRESENTATION_CALENDAR, ...calendarSettingsFrom(source), properties: stringArray(source.properties) }
}

export function defaultListPresentation(): ListCollectionPresentationConfig {
  return { type: COLLECTION_PRESENTATION_LIST, sort: null, properties: [] }
}

export function presentationFromViewDefinition(definition: ViewDefinition): CollectionPresentationConfig {
  const fallback: ListCollectionPresentationConfig = {
    type: COLLECTION_PRESENTATION_LIST,
    sort: nullableString(definition.sort),
    properties: stringArray(definition.listPropertiesDisplay),
  }
  const rawPresentation = Reflect.get(definition as unknown as UnknownRecord, 'presentation')
  if (!isRecord(rawPresentation)) return fallback
  if (rawPresentation.type === COLLECTION_PRESENTATION_KANBAN) return kanbanPresentation(rawPresentation)
  if (rawPresentation.type === COLLECTION_PRESENTATION_CALENDAR) return calendarPresentation(rawPresentation)
  if (rawPresentation.type === COLLECTION_PRESENTATION_LIST) return listPresentation(rawPresentation, fallback)
  return fallback
}
