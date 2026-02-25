import type { ComponentType, SVGAttributes } from 'react'
import { NoteSearchList } from './NoteSearchList'
import './WikilinkSuggestionMenu.css'

export interface WikilinkSuggestionItem {
  title: string
  onItemClick: () => void
  noteType?: string
  typeColor?: string
  TypeIcon?: ComponentType<SVGAttributes<SVGSVGElement>>
  aliases?: string[]
  entryTitle?: string
  path?: string
}

interface WikilinkSuggestionMenuProps {
  items: WikilinkSuggestionItem[]
  loadingState: 'loading-initial' | 'loading' | 'loaded'
  selectedIndex: number | undefined
  onItemClick?: (item: WikilinkSuggestionItem) => void
}

export function WikilinkSuggestionMenu({ items, selectedIndex, onItemClick }: WikilinkSuggestionMenuProps) {
  return (
    <div className="wikilink-menu">
      <NoteSearchList
        items={items}
        selectedIndex={selectedIndex ?? 0}
        getItemKey={(item, i) => `${item.title}-${item.path ?? i}`}
        onItemClick={(item) => {
          item.onItemClick()
          onItemClick?.(item)
        }}
        emptyMessage="No results"
      />
    </div>
  )
}
