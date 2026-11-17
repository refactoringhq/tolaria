import type { FilterGroup, SidebarSelection, VaultEntry, ViewFile } from '../types'

export const COLLECTION_PRESENTATION_LIST = 'list'
export const COLLECTION_PRESENTATION_KANBAN = 'kanban'

export type CollectionPresentationType = typeof COLLECTION_PRESENTATION_LIST | typeof COLLECTION_PRESENTATION_KANBAN

export interface ListCollectionPresentationConfig {
  type: typeof COLLECTION_PRESENTATION_LIST
  sort: string | null
  properties: string[]
}

export interface KanbanCollectionPresentationConfig {
  type: typeof COLLECTION_PRESENTATION_KANBAN
  groupBy: string | null
  properties: string[]
  columnOrder: string[]
  /** Column values shown as a narrow vertical strip. */
  collapsedColumns: string[]
  /** Column values left off the board; listed under "Hidden columns". */
  hiddenColumns: string[]
}

export type CollectionPresentationConfig = ListCollectionPresentationConfig | KanbanCollectionPresentationConfig

export type CollectionOrigin = 'builtin' | 'type' | 'folder' | 'saved-view' | 'neighborhood'

export interface CollectionDefinition {
  id: string
  label: string
  origin: CollectionOrigin
  selection: SidebarSelection
  presentation: CollectionPresentationConfig
  filter?: FilterGroup
  entry?: VaultEntry
  view?: ViewFile
}
