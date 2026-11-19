import {
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationType,
  SET_COLLECTION_LAYOUT_EVENT,
} from '../../collections/collectionTypes'
import type { CommandAction } from './types'

interface CollectionLayoutCommand {
  layout: CollectionPresentationType
  label: string
  keywords: string[]
}

const COLLECTION_LAYOUT_COMMANDS: readonly CollectionLayoutCommand[] = [
  { layout: COLLECTION_PRESENTATION_LIST, label: 'Show Note List as List', keywords: ['layout', 'list', 'rows'] },
  { layout: COLLECTION_PRESENTATION_KANBAN, label: 'Show Note List as Kanban', keywords: ['layout', 'kanban', 'board', 'columns'] },
  { layout: COLLECTION_PRESENTATION_CALENDAR, label: 'Show Note List as Calendar', keywords: ['layout', 'calendar', 'month', 'week', 'date', 'schedule'] },
]

function collectionLayoutCommand({ layout, label, keywords }: CollectionLayoutCommand): CommandAction {
  return {
    id: `show-collection-as-${layout}`,
    label,
    group: 'View',
    keywords,
    enabled: true,
    execute: () => window.dispatchEvent(new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: layout })),
  }
}

/** Command-palette entries that switch the current note list to one layout. */
export function buildCollectionLayoutCommands(): CommandAction[] {
  return COLLECTION_LAYOUT_COMMANDS.map(collectionLayoutCommand)
}
