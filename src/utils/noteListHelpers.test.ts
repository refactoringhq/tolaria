import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatSubtitle, formatSearchSubtitle, relativeDate, buildRelationshipGroups } from './noteListHelpers'
import type { VaultEntry } from '../types'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/note/test.md', filename: 'test.md', title: 'Test',
    isA: 'Note', aliases: [], belongsTo: [], relatedTo: [],
    status: null, owner: null, cadence: null, archived: false,
    trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, template: null, outgoingLinks: [],
    ...overrides,
  }
}

describe('formatSubtitle', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows date and word count when both available', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 342 })
    const result = formatSubtitle(entry)
    expect(result).toContain('342 words')
    expect(result).toContain('\u00b7')
  })

  it('shows "Empty" when word count is 0', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 0 })
    const result = formatSubtitle(entry)
    expect(result).toContain('Empty')
    expect(result).not.toContain('words')
  })

  it('shows only word count when no date available', () => {
    const entry = makeEntry({ wordCount: 100 })
    expect(formatSubtitle(entry)).toBe('100 words')
  })

  it('shows only "Empty" when no date and no content', () => {
    const entry = makeEntry()
    expect(formatSubtitle(entry)).toBe('Empty')
  })

  it('falls back to createdAt when modifiedAt is null', () => {
    const entry = makeEntry({ createdAt: 1700000000, wordCount: 50 })
    const result = formatSubtitle(entry)
    expect(result).toContain('50 words')
    expect(result).toContain('\u00b7')
  })

  it('includes link count when outgoingLinks is non-empty', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 200, outgoingLinks: ['a', 'b', 'c'] })
    const result = formatSubtitle(entry)
    expect(result).toContain('3 links')
  })

  it('uses singular "link" when exactly one', () => {
    const entry = makeEntry({ wordCount: 100, outgoingLinks: ['one'] })
    expect(formatSubtitle(entry)).toContain('1 link')
    expect(formatSubtitle(entry)).not.toContain('1 links')
  })

  it('omits link count when outgoingLinks is empty', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 50, outgoingLinks: [] })
    expect(formatSubtitle(entry)).not.toContain('link')
  })

  it('formats word count with locale separators for large numbers', () => {
    const entry = makeEntry({ wordCount: 1240 })
    const result = formatSubtitle(entry)
    expect(result).toMatch(/1,?240 words/)
  })
})

describe('formatSearchSubtitle', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows modified date, created date, word count, and links', () => {
    const now = Math.floor(Date.now() / 1000)
    const entry = makeEntry({
      modifiedAt: now - 3600,
      createdAt: now - 86400 * 30,
      wordCount: 520,
      outgoingLinks: ['a', 'b', 'c', 'd', 'e'],
    })
    const result = formatSearchSubtitle(entry)
    expect(result).toContain('1h ago')
    expect(result).toContain('Created')
    expect(result).toContain('520 words')
    expect(result).toContain('5 links')
  })

  it('omits created date when same as modified', () => {
    const now = Math.floor(Date.now() / 1000)
    const entry = makeEntry({ modifiedAt: now, createdAt: now, wordCount: 100 })
    const result = formatSearchSubtitle(entry)
    expect(result).not.toContain('Created')
  })

  it('omits created date when createdAt is null', () => {
    const now = Math.floor(Date.now() / 1000)
    const entry = makeEntry({ modifiedAt: now, createdAt: null, wordCount: 100 })
    const result = formatSearchSubtitle(entry)
    expect(result).not.toContain('Created')
  })

  it('shows "Empty" for zero word count', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 0 })
    expect(formatSearchSubtitle(entry)).toContain('Empty')
  })

  it('omits link count when no outgoing links', () => {
    const entry = makeEntry({ modifiedAt: 1700000000, wordCount: 50, outgoingLinks: [] })
    expect(formatSearchSubtitle(entry)).not.toContain('link')
  })

  it('falls back to createdAt when modifiedAt is null', () => {
    const entry = makeEntry({ createdAt: 1700000000, wordCount: 200, outgoingLinks: ['a'] })
    const result = formatSearchSubtitle(entry)
    expect(result).toContain('200 words')
    expect(result).toContain('1 link')
    expect(result).not.toContain('Created')
  })
})

describe('relativeDate', () => {
  it('returns empty string for null', () => {
    expect(relativeDate(null)).toBe('')
  })

  it('returns "just now" for recent timestamps', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(relativeDate(now)).toBe('just now')
  })

  it('returns minutes ago for timestamps within an hour', () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300
    expect(relativeDate(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago for timestamps within a day', () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200
    expect(relativeDate(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago for timestamps within a week', () => {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 86400 * 3
    expect(relativeDate(threeDaysAgo)).toBe('3d ago')
  })

  it('returns formatted date for older timestamps', () => {
    // Use a fixed timestamp: Nov 14, 2023
    expect(relativeDate(1700000000)).toMatch(/Nov 14/)
  })
})

// --- buildRelationshipGroups tests ---

function makeVault(overrides: Partial<VaultEntry>[]): VaultEntry[] {
  return overrides.map((o, i) => makeEntry({
    path: `/Laputa/note/entry-${i}.md`,
    filename: `entry-${i}.md`,
    title: `Entry ${i}`,
    modifiedAt: 1700000000 - i * 100,
    ...o,
  }))
}

describe('buildRelationshipGroups', () => {
  it('shows direct relationship properties from entity.relationships', () => {
    const building = makeEntry({ path: '/Laputa/responsibility/building.md', filename: 'building.md', title: 'Building' })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: { 'Belongs to': ['[[responsibility/building]]'] },
    })
    const groups = buildRelationshipGroups(entity, [entity, building], {})
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Belongs to')
    expect(groups.find((g) => g.label === 'Belongs to')!.entries[0].title).toBe('Building')
  })

  it('shows all direct relationships even when entries also appear as Children', () => {
    // The entity has "Notes" pointing at note1 and note2.
    // Those notes also have belongsTo pointing back at the entity.
    // Previously, Children consumed them via the seen set, suppressing "Notes".
    const note1 = makeEntry({ path: '/Laputa/note/note1.md', filename: 'note1.md', title: 'Note 1', belongsTo: ['[[project/alpha]]'], modifiedAt: 1700000000 })
    const note2 = makeEntry({ path: '/Laputa/note/note2.md', filename: 'note2.md', title: 'Note 2', belongsTo: ['[[project/alpha]]'], modifiedAt: 1700000000 })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: { Notes: ['[[note/note1]]', '[[note/note2]]'] },
    })
    const groups = buildRelationshipGroups(entity, [entity, note1, note2], {})
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Notes')
    expect(groups.find((g) => g.label === 'Notes')!.entries).toHaveLength(2)
  })

  it('shows all 5+ direct relationship properties', () => {
    const entries = makeVault([
      { path: '/Laputa/area/eng.md', filename: 'eng.md', title: 'Engineering' },
      { path: '/Laputa/person/alice.md', filename: 'alice.md', title: 'Alice' },
      { path: '/Laputa/note/n1.md', filename: 'n1.md', title: 'Note 1' },
      { path: '/Laputa/note/n2.md', filename: 'n2.md', title: 'Note 2' },
      { path: '/Laputa/topic/rust.md', filename: 'rust.md', title: 'Rust' },
      { path: '/Laputa/project/sibling.md', filename: 'sibling.md', title: 'Sibling' },
    ])
    const entity = makeEntry({
      path: '/Laputa/project/big.md', filename: 'big.md', title: 'Big Project',
      relationships: {
        'Belongs to': ['[[area/eng]]'],
        Notes: ['[[note/n1]]', '[[note/n2]]'],
        Owner: ['[[person/alice]]'],
        'Related to': ['[[project/sibling]]'],
        Topics: ['[[topic/rust]]'],
      },
    })
    const groups = buildRelationshipGroups(entity, [entity, ...entries], {})
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Belongs to')
    expect(labels).toContain('Notes')
    expect(labels).toContain('Owner')
    expect(labels).toContain('Related to')
    expect(labels).toContain('Topics')
  })

  it('shows Children group for reverse belongsTo entries not covered by direct rels', () => {
    const child = makeEntry({ path: '/Laputa/note/child.md', filename: 'child.md', title: 'Child', belongsTo: ['[[project/alpha]]'], modifiedAt: 1700000000 })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: {},
    })
    const groups = buildRelationshipGroups(entity, [entity, child], {})
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Children')
    expect(groups.find((g) => g.label === 'Children')!.entries[0].title).toBe('Child')
  })

  it('excludes Type key from relationship groups', () => {
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: { Type: ['[[type/project]]'] },
    })
    const groups = buildRelationshipGroups(entity, [entity], {})
    const labels = groups.map((g) => g.label)
    expect(labels).not.toContain('Type')
  })

  it('returns empty groups for entity with no relationships', () => {
    const entity = makeEntry({ path: '/Laputa/note/solo.md', filename: 'solo.md', title: 'Solo', relationships: {} })
    const groups = buildRelationshipGroups(entity, [entity], {})
    expect(groups).toHaveLength(0)
  })

  it('shows single-item and multi-item relationship properties', () => {
    const alice = makeEntry({ path: '/Laputa/person/alice.md', filename: 'alice.md', title: 'Alice' })
    const n1 = makeEntry({ path: '/Laputa/note/n1.md', filename: 'n1.md', title: 'Note 1' })
    const n2 = makeEntry({ path: '/Laputa/note/n2.md', filename: 'n2.md', title: 'Note 2' })
    const entity = makeEntry({
      path: '/Laputa/project/x.md', filename: 'x.md', title: 'X',
      relationships: {
        Owner: ['[[person/alice]]'],
        Notes: ['[[note/n1]]', '[[note/n2]]'],
      },
    })
    const groups = buildRelationshipGroups(entity, [entity, alice, n1, n2], {})
    expect(groups.find((g) => g.label === 'Owner')!.entries).toHaveLength(1)
    expect(groups.find((g) => g.label === 'Notes')!.entries).toHaveLength(2)
  })

  it('shows Instances group for Type entities', () => {
    const instance1 = makeEntry({ path: '/Laputa/project/a.md', filename: 'a.md', title: 'Project A', isA: 'Project', modifiedAt: 1700000000 })
    const instance2 = makeEntry({ path: '/Laputa/project/b.md', filename: 'b.md', title: 'Project B', isA: 'Project', modifiedAt: 1700000000 })
    const typeEntity = makeEntry({
      path: '/Laputa/type/project.md', filename: 'project.md', title: 'Project',
      isA: 'Type', relationships: {},
    })
    const groups = buildRelationshipGroups(typeEntity, [typeEntity, instance1, instance2], {})
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Instances')
    expect(groups.find((g) => g.label === 'Instances')!.entries).toHaveLength(2)
  })

  it('direct relationships are sorted alphabetically', () => {
    const a = makeEntry({ path: '/Laputa/note/a.md', filename: 'a.md', title: 'A' })
    const b = makeEntry({ path: '/Laputa/note/b.md', filename: 'b.md', title: 'B' })
    const c = makeEntry({ path: '/Laputa/note/c.md', filename: 'c.md', title: 'C' })
    const entity = makeEntry({
      path: '/Laputa/project/x.md', filename: 'x.md', title: 'X',
      relationships: {
        Zebra: ['[[note/c]]'],
        Alpha: ['[[note/a]]'],
        Middle: ['[[note/b]]'],
      },
    })
    const groups = buildRelationshipGroups(entity, [entity, a, b, c], {})
    const directLabels = groups.map((g) => g.label)
    expect(directLabels.indexOf('Alpha')).toBeLessThan(directLabels.indexOf('Middle'))
    expect(directLabels.indexOf('Middle')).toBeLessThan(directLabels.indexOf('Zebra'))
  })

  it('Referenced By shows entries whose relatedTo matches the entity', () => {
    const referer = makeEntry({
      path: '/Laputa/project/ref.md', filename: 'ref.md', title: 'Referer',
      relatedTo: ['[[project/alpha]]'], modifiedAt: 1700000000,
    })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: {},
    })
    const groups = buildRelationshipGroups(entity, [entity, referer], {})
    expect(groups.find((g) => g.label === 'Referenced By')!.entries[0].title).toBe('Referer')
  })

  it('Backlinks shows entries that mention the entity via wikilinks in content', () => {
    const linker = makeEntry({
      path: '/Laputa/note/linker.md', filename: 'linker.md', title: 'Linker', modifiedAt: 1700000000,
    })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: {},
    })
    const allContent = { '/Laputa/note/linker.md': 'See [[Alpha]] for details.' }
    const groups = buildRelationshipGroups(entity, [entity, linker], allContent)
    expect(groups.find((g) => g.label === 'Backlinks')!.entries[0].title).toBe('Linker')
  })
})
