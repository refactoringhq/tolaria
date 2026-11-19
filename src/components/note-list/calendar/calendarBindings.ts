import { COLLECTION_PRESENTATION_LIST } from '../../../collections/collectionTypes'
import type { CalendarLayoutBindings } from '../../../collections/layoutRegistry'
import type { WriteNoteProperty } from '../CollectionLayoutBody'
import { isWritableGroupKey } from '../collectionLayoutConfig'
import type { InitialNoteProperties } from '../noteListCreate'
import type { CollectionLayoutState } from '../useCollectionLayout'
import { isTimestampProperty } from './calendarModel'

interface CalendarBindingSource {
  layout: CollectionLayoutState
  write: WriteNoteProperty
  create?: (properties: InitialNoteProperties) => void
}

function isWritableDateKey(property: string, groups: readonly string[]): boolean {
  return !isTimestampProperty(property) && isWritableGroupKey(property, groups)
}

/** Drops and new notes write the date properties, so both must be plain frontmatter keys the notes carry. */
export function canWriteCalendarDates(dateProperty: string | null, endDateProperty: string | null, groups: readonly string[]): boolean {
  if (!dateProperty || !isWritableDateKey(dateProperty, groups)) return false
  return endDateProperty === null || isWritableDateKey(endDateProperty, groups)
}

export function calendarBindings({ layout, write, create }: CalendarBindingSource): CalendarLayoutBindings {
  const { dateProperty, calendar } = layout
  const canReschedule = canWriteCalendarDates(dateProperty, calendar.endDateProperty, layout.groups)
  return {
    settings: calendar,
    dateProperty,
    dateOptions: layout.dateOptions,
    canReschedule,
    onSettingsChange: layout.changeCalendar,
    onReschedule: async (entry, writes) => {
      if (!canReschedule) return
      for (const { property, value } of writes) await write(entry, property, value)
    },
    onCreate: (day) => {
      if (!canReschedule || !dateProperty || !create) return
      layout.panel.reopen()
      create(Object.fromEntries([[dateProperty, day]]))
    },
    onUseList: () => layout.changeLayout(COLLECTION_PRESENTATION_LIST),
  }
}
