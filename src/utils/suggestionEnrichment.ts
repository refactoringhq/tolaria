import type { VaultEntry } from '../types'
import { getTypeColor, getTypeLightColor } from './typeColors'
import { getTypeIcon } from '../components/NoteItem'
import { deduplicateByPath, disambiguateTitles } from './wikilinkSuggestions'
import { bestSearchRank } from './fuzzyMatch'
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

/** Build a vault-relative path target with pipe display: "type/slug|Title" */
function buildPathTarget(item: BaseSuggestionItem): string {
  const parts = item.path.split('/')
  const vaultRelPath = parts.slice(-2).join('/').replace(/\.md$/, '')
  return `${vaultRelPath}|${item.entryTitle}`
}

/** Add onItemClick to raw suggestion candidates.
 *  When multiple candidates share the same title, inserts a path-based
 *  target with pipe syntax so the wikilink uniquely identifies the note. */
export function attachClickHandlers(
  candidates: BaseSuggestionItem[],
  insertWikilink: (target: string) => void,
) {
  const titleCounts = new Map<string, number>()
  for (const item of candidates) {
    titleCounts.set(item.entryTitle, (titleCounts.get(item.entryTitle) ?? 0) + 1)
  }

  return candidates.map(item => ({
    ...item,
    onItemClick: () => {
      const isDuplicate = (titleCounts.get(item.entryTitle) ?? 0) > 1
      insertWikilink(isDuplicate ? buildPathTarget(item) : item.entryTitle)
    },
  }))
}

/** Filter, deduplicate, disambiguate, and enrich suggestion items with type metadata */
export function enrichSuggestionItems(
  items: (BaseSuggestionItem & { onItemClick: () => void })[],
  query: string,
  typeEntryMap: Record<string, VaultEntry>,
): WikilinkSuggestionItem[] {
  const filtered = filterSuggestionItems(items, query)
  filtered.sort((a, b) =>
    bestSearchRank(query, a.entryTitle, a.aliases) - bestSearchRank(query, b.entryTitle, b.aliases),
  )
  const sliced = filtered.slice(0, MAX_RESULTS)
  const final = disambiguateTitles(deduplicateByPath(sliced))
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
