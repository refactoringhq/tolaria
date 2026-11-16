import type { MouseEvent, ReactNode } from 'react'
import { COLLECTION_PRESENTATION_LIST } from '../../collections/collectionTypes'
import { getCollectionLayout } from '../../collections/layoutRegistry'
import { type AppLocale, translate } from '../../lib/i18n'
import type { VaultEntry } from '../../types'
import { Button } from '@/components/ui/button'
import { isWritableGroupKey } from './collectionLayoutConfig'
import type { CollectionLayoutState } from './useCollectionLayout'

interface CollectionLayoutBodyProps {
  layout: CollectionLayoutState
  listContent: ReactNode
  entries: VaultEntry[]
  allEntries: VaultEntry[]
  locale: AppLocale
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  selectedNotePath?: string | null
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
  onMove: (entry: VaultEntry, property: string, value: string | null) => void
}

function MissingGroupProperty({ property, locale, onUseList }: { property: string; locale: AppLocale; onUseList: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground" data-testid="kanban-missing-property">
      <p className="m-0 max-w-md">{translate(locale, 'layout.noPropertyValues', { property })}</p>
      <Button type="button" variant="outline" size="sm" onClick={onUseList}>{translate(locale, 'layout.useList')}</Button>
    </div>
  )
}

export function CollectionLayoutBody({ layout, listContent, entries, allEntries, locale, typeEntryMap, displayPropsOverride, selectedNotePath, onOpen, onMove }: CollectionLayoutBodyProps) {
  const renderer = getCollectionLayout(layout.layout)
  const missingProperty = renderer.requiredProperties({ groupBy: layout.groupBy })
    .find((property) => !layout.groups.includes(property))
  if (missingProperty) {
    return <MissingGroupProperty property={missingProperty} locale={locale} onUseList={() => layout.changeLayout(COLLECTION_PRESENTATION_LIST)} />
  }
  return renderer.render({
    listContent,
    entries,
    allEntries,
    groupBy: layout.groupBy,
    properties: layout.properties,
    columnOrder: layout.columnOrder,
    onColumnOrderChange: layout.changeColumnOrder,
    locale,
    typeEntryMap,
    displayPropsOverride,
    selectedNotePath,
    onOpen: (entry, event) => {
      layout.panel.reopen()
      onOpen(entry, event)
    },
    onMove: (entry, value) => {
      if (isWritableGroupKey(layout.groupBy, layout.groups)) onMove(entry, layout.groupBy, value)
    },
  })
}
