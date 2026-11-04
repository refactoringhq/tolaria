import {
  type MobileNoteSearchMatch,
  mobileNoteIdentitySearchMatch,
  mobileQuickOpenSearchText,
  normalizedMobileSearchQuery,
} from './mobileNoteSearch'
import type { MobileNote } from './mobileWorkspaceModel'

export type MobileQuickOpenDirection = 'next' | 'previous'
export type MobileQuickOpenRecentState = {
  noteIds: string[]
  searches: string[]
}
export type MobileQuickOpenSnippetPart = { matched: boolean; text: string }

export const mobileQuickOpenResultLimit = 16
export const mobileQuickOpenRecentSearchLimit = 5
export const mobileQuickOpenRecentNoteLimit = 8
const noQuickOpenMatch: MobileNoteSearchMatch = {
  match: false,
  rank: Number.POSITIVE_INFINITY,
  score: 0,
}

export function rememberMobileQuickOpenSearch(
  recent: MobileQuickOpenRecentState,
  query: string,
): MobileQuickOpenRecentState {
  const search = query.trim()
  if (!search) return recent

  return {
    ...recent,
    searches: [
      search,
      ...recent.searches.filter((value) => normalizedMobileSearchQuery(value) !== normalizedMobileSearchQuery(search)),
    ].slice(0, mobileQuickOpenRecentSearchLimit),
  }
}

export function rememberMobileQuickOpenNote(
  recent: MobileQuickOpenRecentState,
  noteId: string,
): MobileQuickOpenRecentState {
  if (!noteId) return recent

  return {
    ...recent,
    noteIds: [noteId, ...recent.noteIds.filter((id) => id !== noteId)].slice(0, mobileQuickOpenRecentNoteLimit),
  }
}

export function mobileQuickOpenRecentNotes(
  notes: MobileNote[],
  recent: MobileQuickOpenRecentState,
  currentNoteId?: string | null,
): MobileNote[] {
  const byId = new Map(notes.filter((note) => !note.archived).map((note) => [note.id, note]))
  return [...new Set([currentNoteId, ...recent.noteIds].filter((id): id is string => Boolean(id)))]
    .map((id) => byId.get(id))
    .filter((note): note is MobileNote => Boolean(note))
}

export function mobileQuickOpenSnippetParts(snippet: string, query: string): MobileQuickOpenSnippetPart[] {
  const terms = [...new Set(query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean))]
  if (!snippet || terms.length === 0) return [{ matched: false, text: snippet }]
  const parts: MobileQuickOpenSnippetPart[] = []
  let cursor = 0
  for (let start = 0; start < snippet.length; start += 1) {
    const term = terms.find((value) => snippet.slice(start, start + value.length).toLocaleLowerCase() === value)
    if (!term) continue
    if (start > cursor) parts.push({ matched: false, text: snippet.slice(cursor, start) })
    parts.push({ matched: true, text: snippet.slice(start, start + term.length) })
    cursor = start + term.length
    start = cursor - 1
  }
  if (cursor < snippet.length) parts.push({ matched: false, text: snippet.slice(cursor) })
  return parts
}

export function mobileQuickOpenResults(
  notes: MobileNote[],
  query: string,
  limit = mobileQuickOpenResultLimit,
): MobileNote[] {
  const normalizedQuery = normalizedMobileSearchQuery(query)
  const activeNotes = notes.filter((note) => !note.archived)
  if (!normalizedQuery) return activeNotes.slice(0, limit)

  return activeNotes
    .map((note, index) => ({
      index,
      match: mobileQuickOpenRankNote(note, normalizedQuery),
      note,
    }))
    .filter(({ match }) => match.match)
    .sort(
      (left, right) =>
        left.match.rank - right.match.rank || right.match.score - left.match.score || left.index - right.index,
    )
    .map(({ note }) => note)
    .slice(0, limit)
}

export function mobileQuickOpenMoveIndex(
  currentIndex: number,
  resultCount: number,
  direction: MobileQuickOpenDirection,
): number {
  if (resultCount <= 0) return 0
  if (direction === 'next') return Math.min(currentIndex + 1, resultCount - 1)

  return Math.max(currentIndex - 1, 0)
}

export function mobileQuickOpenSelectedNote(results: MobileNote[], selectedIndex: number): MobileNote | null {
  return results.at(selectedIndex) ?? null
}

function mobileQuickOpenRankNote(note: MobileNote, normalizedQuery: string): MobileNoteSearchMatch {
  const identityMatch = mobileNoteIdentitySearchMatch(note, normalizedQuery)
  if (identityMatch.match) return identityMatch

  const fullText = mobileQuickOpenSearchText(note)
  const textIndex = fullText.indexOf(normalizedQuery)
  if (textIndex === -1) return noQuickOpenMatch

  return {
    match: true,
    rank: 6,
    score: -textIndex,
  }
}
