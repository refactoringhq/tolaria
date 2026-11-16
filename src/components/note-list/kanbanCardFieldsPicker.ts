import { COLLECTION_PRESENTATION_KANBAN } from '../../collections/collectionTypes'
import { type AppLocale, translate } from '../../lib/i18n'
import type { NoteListPropertyPicker } from './noteListHooks'

interface CardFieldsSource {
  layout: string
  properties: string[]
  cardFields: string[]
  changeCardProperties: (properties: string[] | null) => void
}

/**
 * In Kanban, the note-list visible-properties control edits the card fields. Until the board has its own
 * fields, cards show the same properties as list rows.
 */
export function layoutPropertyPicker(
  layout: CardFieldsSource,
  listPicker: NoteListPropertyPicker | null,
  locale: AppLocale,
): NoteListPropertyPicker | null {
  if (layout.layout !== COLLECTION_PRESENTATION_KANBAN) return listPicker
  const inherited = listPicker?.currentDisplay ?? []
  const available = new Set([...(listPicker?.availableProperties ?? []), ...layout.cardFields])
  return {
    scope: listPicker?.scope ?? 'view',
    availableProperties: [...available],
    currentDisplay: layout.properties.length > 0 ? layout.properties : inherited,
    onSave: layout.changeCardProperties,
    triggerTitle: translate(locale, 'layout.cardFields'),
  }
}
