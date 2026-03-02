import { describe, it, expect, vi } from 'vitest'
import { attachClickHandlers, enrichSuggestionItems } from './suggestionEnrichment'
import type { VaultEntry } from '../types'

vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: <T extends { title: string; aliases: string[] }>(items: T[], query: string) =>
    items.filter(i => i.title.toLowerCase().includes(query.toLowerCase()) || i.aliases.some(a => a.toLowerCase().includes(query.toLowerCase()))),
}))

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/test.md', filename: 'test.md', title: 'Test', isA: null,
    aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
    archived: false, trashed: false, trashedAt: null, modifiedAt: null, createdAt: null,
    fileSize: 0, snippet: '', wordCount: 0, relationships: {}, icon: null, color: null,
    order: null, template: null, outgoingLinks: [],
    ...overrides,
  }
}

describe('attachClickHandlers', () => {
  it('adds onItemClick to each candidate', () => {
    const insertWikilink = vi.fn()
    const candidates = [
      { title: 'Note A', aliases: [], group: 'Note', entryTitle: 'Note A', path: '/a.md' },
      { title: 'Note B', aliases: [], group: 'Project', entryTitle: 'Note B', path: '/b.md' },
    ]

    const result = attachClickHandlers(candidates, insertWikilink)

    expect(result).toHaveLength(2)
    result[0].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('Note A')
    result[1].onItemClick()
    expect(insertWikilink).toHaveBeenCalledWith('Note B')
  })

  it('preserves all original properties', () => {
    const result = attachClickHandlers(
      [{ title: 'X', aliases: ['y'], group: 'Topic', entryTitle: 'X', path: '/x.md' }],
      vi.fn(),
    )
    expect(result[0]).toMatchObject({ title: 'X', aliases: ['y'], group: 'Topic', path: '/x.md' })
  })
})

describe('enrichSuggestionItems', () => {
  const typeEntryMap: Record<string, VaultEntry> = {
    Project: makeEntry({ isA: 'Type', title: 'Project', color: 'blue', icon: 'wrench' }),
  }

  function makeItem(title: string, group: string, path: string) {
    return { title, aliases: [] as string[], group, entryTitle: title, path, onItemClick: vi.fn() }
  }

  it('filters items by query', () => {
    const items = [makeItem('Alpha', 'Note', '/a.md'), makeItem('Beta', 'Note', '/b.md')]
    const result = enrichSuggestionItems(items, 'alp', {})
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Alpha')
  })

  it('adds type metadata for non-Note groups', () => {
    const items = [makeItem('My Project', 'Project', '/p.md')]
    const result = enrichSuggestionItems(items, '', typeEntryMap)
    expect(result[0].noteType).toBe('Project')
    expect(result[0].typeColor).toBeDefined()
    expect(result[0].typeLightColor).toBeDefined()
    expect(result[0].TypeIcon).toBeDefined()
  })

  it('omits type metadata for Note group', () => {
    const items = [makeItem('Plain Note', 'Note', '/n.md')]
    const result = enrichSuggestionItems(items, '', {})
    expect(result[0].noteType).toBeUndefined()
    expect(result[0].typeColor).toBeUndefined()
  })

  it('deduplicates items with the same path', () => {
    const items = [
      makeItem('Note', 'Note', '/n.md'),
      makeItem('Note Alias', 'Note', '/n.md'),
    ]
    const result = enrichSuggestionItems(items, '', {})
    expect(result).toHaveLength(1)
  })

  it('limits results to 20', () => {
    const items = Array.from({ length: 30 }, (_, i) => makeItem(`Note ${i}`, 'Note', `/n${i}.md`))
    const result = enrichSuggestionItems(items, '', {})
    expect(result.length).toBeLessThanOrEqual(20)
  })
})
