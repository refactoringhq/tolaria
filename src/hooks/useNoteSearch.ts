import { useState, useMemo, useCallback, useEffect } from 'react'
import type { VaultEntry } from '../types'
import { fuzzyMatch } from '../utils/fuzzyMatch'
import { getTypeColor, buildTypeEntryMap } from '../utils/typeColors'
import { getTypeIcon } from '../components/NoteItem'
import type { NoteSearchResultItem } from '../components/NoteSearchList'

const DEFAULT_MAX_RESULTS = 20

export interface NoteSearchResult extends NoteSearchResultItem {
  entry: VaultEntry
}

function toResult(e: VaultEntry, typeEntryMap: Record<string, VaultEntry>): NoteSearchResult {
  const noteType = e.isA && e.isA !== 'Note' ? e.isA : undefined
  const te = typeEntryMap[e.isA ?? '']
  return {
    entry: e,
    title: e.title,
    noteType,
    typeColor: noteType ? getTypeColor(e.isA, te?.color) : undefined,
    TypeIcon: noteType ? getTypeIcon(e.isA, te?.icon) : undefined,
  }
}

export function useNoteSearch(entries: VaultEntry[], query: string, maxResults = DEFAULT_MAX_RESULTS) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const results: NoteSearchResult[] = useMemo(() => {
    const mapResult = (e: VaultEntry) => toResult(e, typeEntryMap)
    if (!query.trim()) {
      return [...entries]
        .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
        .slice(0, maxResults)
        .map(mapResult)
    }
    return entries
      .map((e) => ({ entry: e, ...fuzzyMatch(query, e.title) }))
      .filter((r) => r.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((r) => mapResult(r.entry))
  }, [entries, query, maxResults, typeEntryMap])

  useEffect(() => {
    setSelectedIndex(0) // eslint-disable-line react-hooks/set-state-in-effect -- reset on query change
  }, [query])

  const selectedEntry = results[selectedIndex]?.entry ?? null

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
    },
    [results.length],
  )

  return { results, selectedIndex, setSelectedIndex, selectedEntry, handleKeyDown }
}
