import {
  COLLECTION_PRESENTATION_CALENDAR,
  COLLECTION_PRESENTATION_GRAPH,
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationType,
  SET_COLLECTION_LAYOUT_EVENT,
} from '../../collections/collectionTypes'
import { type FeatureFlagName, readFeatureFlag } from '../useFeatureFlag'
import type { CommandAction } from './types'

interface CollectionLayoutCommand {
  layout: CollectionPresentationType
  label: string
  keywords: string[]
  /** Layouts still in development are offered only while their flag is on. */
  featureFlag?: FeatureFlagName
}

const COLLECTION_LAYOUT_COMMANDS: readonly CollectionLayoutCommand[] = [
  { layout: COLLECTION_PRESENTATION_LIST, label: 'Show Note List as List', keywords: ['layout', 'list', 'rows'] },
  { layout: COLLECTION_PRESENTATION_KANBAN, label: 'Show Note List as Kanban', keywords: ['layout', 'kanban', 'board', 'columns'] },
  { layout: COLLECTION_PRESENTATION_CALENDAR, label: 'Show Note List as Calendar', keywords: ['layout', 'calendar', 'month', 'week', 'date', 'schedule'] },
  {
    layout: COLLECTION_PRESENTATION_GRAPH,
    label: 'Show Note List as Graph',
    keywords: ['layout', 'graph', 'network', 'links', 'relationships', 'map'],
    featureFlag: 'graph_layout',
  },
]

function isAvailable({ featureFlag }: CollectionLayoutCommand): boolean {
  return featureFlag === undefined || readFeatureFlag(featureFlag)
}

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
  return COLLECTION_LAYOUT_COMMANDS.filter(isAvailable).map(collectionLayoutCommand)
}
