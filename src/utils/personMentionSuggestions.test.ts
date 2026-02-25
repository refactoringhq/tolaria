import { describe, it, expect } from 'vitest'
import { filterPersonMentions, PERSON_MENTION_MIN_QUERY } from './personMentionSuggestions'
import type { WikilinkBaseItem } from './wikilinkSuggestions'

const items: WikilinkBaseItem[] = [
  { title: 'Matteo Cellini', aliases: ['Matteo'], group: 'Person', entryTitle: 'Matteo Cellini', path: '/person/matteo.md' },
  { title: 'Maria Bianchi', aliases: ['Maria'], group: 'Person', entryTitle: 'Maria Bianchi', path: '/person/maria.md' },
  { title: 'Build Laputa App', aliases: ['Laputa'], group: 'Project', entryTitle: 'Build Laputa App', path: '/project/laputa.md' },
  { title: 'Grow Newsletter', aliases: [], group: 'Responsibility', entryTitle: 'Grow Newsletter', path: '/resp/newsletter.md' },
  { title: 'Elena Russo', aliases: ['Elena'], group: 'Person', entryTitle: 'Elena Russo', path: '/person/elena.md' },
]

describe('filterPersonMentions', () => {
  it('returns only Person entries matching query on title', () => {
    const result = filterPersonMentions(items, 'mat')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Matteo Cellini')
  })

  it('matches on aliases', () => {
    const result = filterPersonMentions(items, 'Elena')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Elena Russo')
  })

  it('excludes non-Person entries even if they match the query', () => {
    const result = filterPersonMentions(items, 'Lap')
    expect(result).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    const result = filterPersonMentions(items, 'MARIA')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Maria Bianchi')
  })

  it('returns multiple matches', () => {
    const result = filterPersonMentions(items, 'ma')
    expect(result).toHaveLength(2)
    const titles = result.map(r => r.title)
    expect(titles).toContain('Matteo Cellini')
    expect(titles).toContain('Maria Bianchi')
  })

  it('returns empty for query shorter than minimum', () => {
    const result = filterPersonMentions(items, '')
    expect(result).toHaveLength(0)
  })

  it('works with single-character query (min query is 1)', () => {
    expect(PERSON_MENTION_MIN_QUERY).toBe(1)
    const result = filterPersonMentions(items, 'e')
    expect(result).toHaveLength(2) // Matteo (alias) + Elena
  })

  it('returns empty when no persons match', () => {
    const result = filterPersonMentions(items, 'zzz')
    expect(result).toHaveLength(0)
  })
})
