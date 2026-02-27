import type { VaultEntry } from '../types'
import { getTypeColor, getTypeLightColor } from './typeColors'
import { getTypeIcon } from '../components/NoteItem'
import { deduplicateByPath, disambiguateTitles } from './wikilinkSuggestions'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import type { WikilinkSuggestionItem } from '../components/WikilinkSuggestionMenu'

const MAX_RESULTS = 20

interface BaseSuggestionItem {
  title: string
  aliases: string[]
  group: string
  entryTitle: string
  path: string
}

/** Add onItemClick to raw suggestion candidates */
export function attachClickHandlers(
  candidates: BaseSuggestionItem[],
  insertWikilink: (target: string) => void,
) {
  return candidates.map(item => ({
    ...item,
    onItemClick: () => insertWikilink(item.entryTitle),
  }))
}

/** Filter, deduplicate, disambiguate, and enrich suggestion items with type metadata */
export function enrichSuggestionItems(
  items: (BaseSuggestionItem & { onItemClick: () => void })[],
  query: string,
  typeEntryMap: Record<string, VaultEntry>,
): WikilinkSuggestionItem[] {
  const filtered = filterSuggestionItems(items, query).slice(0, MAX_RESULTS)
  const final = disambiguateTitles(deduplicateByPath(filtered))
  return final.map(({ group, ...rest }) => {
    const noteType = group !== 'Note' ? group : undefined
    const te = typeEntryMap[group]
    return {
      ...rest,
      noteType,
      typeColor: noteType ? getTypeColor(group, te?.color) : undefined,
      typeLightColor: noteType ? getTypeLightColor(group, te?.color) : undefined,
      TypeIcon: noteType ? getTypeIcon(group, te?.icon) : undefined,
    }
  })
}
