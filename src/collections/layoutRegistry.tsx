import type { MouseEvent, ReactNode } from 'react'
import { KanbanLayout } from '../components/note-list/KanbanLayout'
import type { AppLocale } from '../lib/i18n'
import type { VaultEntry } from '../types'
import { COLLECTION_PRESENTATION_KANBAN, COLLECTION_PRESENTATION_LIST, type CollectionPresentationType } from './collectionTypes'

export interface CollectionLayoutRegistration {
  type: CollectionPresentationType
  label: string
  requiredProperties: (config: Record<string, unknown>) => string[]
  render: (props: CollectionLayoutRendererProps) => ReactNode
}

const registrations: CollectionLayoutRegistration[] = [
  {
    type: COLLECTION_PRESENTATION_LIST,
    label: 'List',
    requiredProperties: () => [],
    render: ({ listContent }) => listContent,
  },
  {
    type: COLLECTION_PRESENTATION_KANBAN,
    label: 'Kanban',
    requiredProperties: (config) => typeof config.groupBy === 'string' ? [config.groupBy] : [],
    render: ({ entries, groupBy, properties, columnOrder, onColumnOrderChange, locale, onOpen, onMove }) => (
      <KanbanLayout entries={entries} groupBy={groupBy} properties={properties} columnOrder={columnOrder} onColumnOrderChange={onColumnOrderChange} locale={locale} onOpen={onOpen} onMove={onMove} />
    ),
  },
]

export function getCollectionLayouts(): readonly CollectionLayoutRegistration[] {
  return registrations
}

export function getCollectionLayout(type: CollectionPresentationType): CollectionLayoutRegistration {
  return registrations.find((layout) => layout.type === type) ?? registrations[0]
}

export interface CollectionLayoutRendererProps {
  listContent: ReactNode
  entries: VaultEntry[]
  groupBy: string
  properties: string[]
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
  locale: AppLocale
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
  onMove: (entry: VaultEntry, value: string | null) => void
}
