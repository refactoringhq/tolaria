import type { MouseEvent, ReactNode } from 'react'
import { CalendarBlank, Kanban, Rows, type Icon } from '@phosphor-icons/react'
import { KanbanLayout } from '../components/note-list/KanbanLayout'
import { CalendarLayout, CalendarMissingProperty } from '../components/note-list/calendar/CalendarLayout'
import type { DayKey } from '../components/note-list/calendar/calendarDates'
import { type DateWrite, isTimestampProperty } from '../components/note-list/calendar/calendarModel'
import type { AppLocale, TranslationKey } from '../lib/i18n'
import type { VaultEntry } from '../types'
import {
  type CalendarSettings,
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationType,
} from './collectionTypes'

/** What every layout gets: the list's notes, how to draw a card, and how to open a note. */
export interface CollectionLayoutSharedProps {
  entries: VaultEntry[]
  /** Every vault entry, so card property chips resolve links exactly like list rows. */
  allEntries: VaultEntry[]
  properties: string[]
  locale: AppLocale
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  selectedNotePath?: string | null
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
}

export interface KanbanLayoutBindings {
  groupBy: string
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
  collapsedColumns: string[]
  hiddenColumns: string[]
  onToggleColumnCollapsed: (group: string) => void
  onToggleColumnHidden: (group: string) => void
  onMove: (entry: VaultEntry, value: string | null) => void
}

export interface CalendarLayoutBindings {
  settings: CalendarSettings
  /** The configured date property, or the list's best one; null when the list has no date property. */
  dateProperty: string | null
  /** Frontmatter date properties the list's notes carry. */
  dateOptions: string[]
  /** False for read-only sources (created/modified dates) and keys a drop must not write. */
  canReschedule: boolean
  onSettingsChange: (patch: Partial<CalendarSettings>) => void
  /** Writes one date property; a range move calls it once per date, in order. */
  onWriteDate: (entry: VaultEntry, write: DateWrite) => Promise<void>
  onCreate: (day: DayKey) => void
  onUseList: () => void
}

export interface CollectionLayoutRendererProps extends CollectionLayoutSharedProps {
  listContent: ReactNode
  kanban: KanbanLayoutBindings
  calendar: CalendarLayoutBindings
}

export type LayoutRequirementConfig = Partial<Pick<CalendarSettings, 'dateProperty' | 'endDateProperty'>> & { groupBy?: string }

export type CollectionLayoutControl = 'groupBy' | 'dateProperty'

export interface CollectionLayoutRegistration {
  type: CollectionPresentationType
  labelKey: TranslationKey
  icon: Icon
  /** Header controls this layout adds next to the shared note-list actions. */
  controls: readonly CollectionLayoutControl[]
  requiredProperties: (config: LayoutRequirementConfig) => string[]
  render: (props: CollectionLayoutRendererProps) => ReactNode
  /** Replaces the generic "no notes have this property" state with a layout-specific one. */
  renderMissing?: (props: CollectionLayoutRendererProps, property: string) => ReactNode
}

function sharedLayoutProps(props: CollectionLayoutRendererProps): CollectionLayoutSharedProps {
  const { entries, allEntries, properties, locale, typeEntryMap, displayPropsOverride, selectedNotePath, onOpen } = props
  return { entries, allEntries, properties, locale, typeEntryMap, displayPropsOverride, selectedNotePath, onOpen }
}

function calendarRequiredProperties({ dateProperty, endDateProperty }: LayoutRequirementConfig): string[] {
  return [dateProperty, endDateProperty]
    .filter((property): property is string => typeof property === 'string' && !isTimestampProperty(property))
}

const registrations: CollectionLayoutRegistration[] = [
  {
    type: COLLECTION_PRESENTATION_LIST,
    labelKey: 'layout.list',
    icon: Rows,
    controls: [],
    requiredProperties: () => [],
    render: ({ listContent }) => listContent,
  },
  {
    type: COLLECTION_PRESENTATION_KANBAN,
    labelKey: 'layout.kanban',
    icon: Kanban,
    controls: ['groupBy'],
    requiredProperties: (config) => typeof config.groupBy === 'string' ? [config.groupBy] : [],
    render: (props) => <KanbanLayout {...sharedLayoutProps(props)} {...props.kanban} />,
  },
  {
    type: COLLECTION_PRESENTATION_CALENDAR,
    labelKey: 'layout.calendar',
    icon: CalendarBlank,
    controls: ['dateProperty'],
    requiredProperties: calendarRequiredProperties,
    render: (props) => <CalendarLayout {...sharedLayoutProps(props)} calendar={props.calendar} />,
    renderMissing: ({ calendar, locale }, property) => <CalendarMissingProperty calendar={calendar} locale={locale} property={property} />,
  },
]

export function getCollectionLayouts(): readonly CollectionLayoutRegistration[] {
  return registrations
}

export function getCollectionLayout(type: CollectionPresentationType): CollectionLayoutRegistration {
  return registrations.find((layout) => layout.type === type) ?? registrations[0]
}
