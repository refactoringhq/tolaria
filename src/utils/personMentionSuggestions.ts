import type { WikilinkBaseItem } from './wikilinkSuggestions'

/** Person mentions need only 1 character to start suggesting (smaller candidate set). */
export const PERSON_MENTION_MIN_QUERY = 1

/**
 * Pre-filter person mention candidates: only items whose group is 'Person',
 * matched by case-insensitive substring on title or aliases.
 */
export function filterPersonMentions<T extends WikilinkBaseItem>(
  items: T[],
  query: string,
): T[] {
  if (query.length < PERSON_MENTION_MIN_QUERY) return []
  const lowerQuery = query.toLowerCase()
  return items.filter(item =>
    item.group === 'Person' && (
      item.title.toLowerCase().includes(lowerQuery) ||
      item.aliases.some(a => a.toLowerCase().includes(lowerQuery))
    )
  )
}
