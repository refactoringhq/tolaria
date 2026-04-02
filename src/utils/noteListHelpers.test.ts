import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatSubtitle, formatSearchSubtitle, relativeDate, buildRelationshipGroups, getSortComparator, extractSortableProperties, getSortOptionLabel, getDefaultDirection, parseSortConfig, serializeSortConfig, buildValidLinkTargets, isInboxEntry, filterInboxEntries, filterEntries } from './noteListHelpers'
import type { VaultEntry } from '../types'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/note/test.md', filename: 'test.md', title: 'Test',
    isA: 'Note', aliases: [], belongsTo: [], relatedTo: [],
    status: null, archived: false,
    trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, template: null, sort: null, outgoingLinks: [],
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
    const groups = buildRelationshipGroups(entity, [entity, building])
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
    const groups = buildRelationshipGroups(entity, [entity, note1, note2])
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
    const groups = buildRelationshipGroups(entity, [entity, ...entries])
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
    const groups = buildRelationshipGroups(entity, [entity, child])
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Children')
    expect(groups.find((g) => g.label === 'Children')!.entries[0].title).toBe('Child')
  })

  it('excludes Type key from relationship groups', () => {
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: { Type: ['[[project]]'] },
    })
    const groups = buildRelationshipGroups(entity, [entity])
    const labels = groups.map((g) => g.label)
    expect(labels).not.toContain('Type')
  })

  it('returns empty groups for entity with no relationships', () => {
    const entity = makeEntry({ path: '/Laputa/note/solo.md', filename: 'solo.md', title: 'Solo', relationships: {} })
    const groups = buildRelationshipGroups(entity, [entity])
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
    const groups = buildRelationshipGroups(entity, [entity, alice, n1, n2])
    expect(groups.find((g) => g.label === 'Owner')!.entries).toHaveLength(1)
    expect(groups.find((g) => g.label === 'Notes')!.entries).toHaveLength(2)
  })

  it('shows Instances group for Type entities', () => {
    const instance1 = makeEntry({ path: '/Laputa/project/a.md', filename: 'a.md', title: 'Project A', isA: 'Project', modifiedAt: 1700000000 })
    const instance2 = makeEntry({ path: '/Laputa/project/b.md', filename: 'b.md', title: 'Project B', isA: 'Project', modifiedAt: 1700000000 })
    const typeEntity = makeEntry({
      path: '/Laputa/project.md', filename: 'project.md', title: 'Project',
      isA: 'Type', relationships: {},
    })
    const groups = buildRelationshipGroups(typeEntity, [typeEntity, instance1, instance2])
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
    const groups = buildRelationshipGroups(entity, [entity, a, b, c])
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
    const groups = buildRelationshipGroups(entity, [entity, referer])
    expect(groups.find((g) => g.label === 'Referenced By')!.entries[0].title).toBe('Referer')
  })

  it('Backlinks shows entries that mention the entity via outgoingLinks', () => {
    const linker = makeEntry({
      path: '/Laputa/note/linker.md', filename: 'linker.md', title: 'Linker', modifiedAt: 1700000000,
      outgoingLinks: ['Alpha'],
    })
    const entity = makeEntry({
      path: '/Laputa/project/alpha.md', filename: 'alpha.md', title: 'Alpha',
      relationships: {},
    })
    const groups = buildRelationshipGroups(entity, [entity, linker])
    expect(groups.find((g) => g.label === 'Backlinks')!.entries[0].title).toBe('Linker')
  })

  it('resolves all entries in a large Notes relationship (regression: No Code)', () => {
    // Simulates the No Code topic note with 32 Notes, 2 Referred by Data, 1 Belongs to
    const noteRefs = [
      '8020', 'airdev-build-hub', 'airdev-leader', 'budibase', 'bullet-launch',
      'canvas', 'chameleon', 'felt', 'flutterflow', 'framer-ai',
      'jumpstart', 'mailparser', 'make', 'michele-sampieri', 'n8n-a',
      'n8n-ai', 'nocodey', 'outseta', 'lemon-squeezy', 'retool',
      'rise-no-code', 'scene', 'scrapingbee', 'softr', 'superblocks',
      'superwall', 'tails', 'supabase', 'varun-anand', 'xano',
      'directus', 'framer-design',
    ]
    const noteEntries = noteRefs.map((slug, i) => makeEntry({
      path: `/Laputa/${slug}.md`, filename: `${slug}.md`, title: `Title ${slug}`,
      modifiedAt: 1700000000 - i * 100,
    }))
    const engineering = makeEntry({
      path: '/Laputa/engineering.md', filename: 'engineering.md', title: 'Engineering',
      modifiedAt: 1700000000,
    })
    const entity = makeEntry({
      path: '/Laputa/no-code.md', filename: 'no-code.md', title: 'No Code',
      isA: 'Topic',
      relationships: {
        'Belongs to': ['[[engineering|Engineering]]'],
        Notes: noteRefs.map((slug) => `[[${slug}|Title ${slug}]]`),
        'Referred by Data': ['[[michele-sampieri|Michele Sampieri]]', '[[varun-anand|Varun Anand]]'],
      },
    })
    const allEntries = [entity, engineering, ...noteEntries]
    const groups = buildRelationshipGroups(entity, allEntries)

    const belongsGroup = groups.find((g) => g.label === 'Belongs to')
    expect(belongsGroup).toBeDefined()
    expect(belongsGroup!.entries).toHaveLength(1)

    const notesGroup = groups.find((g) => g.label === 'Notes')
    expect(notesGroup).toBeDefined()
    expect(notesGroup!.entries).toHaveLength(32)

    // michele-sampieri and varun-anand already consumed by Notes → Referred by Data has 0 new
    const referredGroup = groups.find((g) => g.label === 'Referred by Data')
    expect(referredGroup).toBeUndefined()
  })

  it('resolves refs by title when filename differs from wikilink target', () => {
    // Wikilink [[Airdev]] but filename is airdev-tool.md, title is "Airdev"
    const airdev = makeEntry({
      path: '/vault/airdev-tool.md', filename: 'airdev-tool.md', title: 'Airdev',
    })
    const budibase = makeEntry({
      path: '/vault/budibase-app.md', filename: 'budibase-app.md', title: 'Budibase',
      aliases: ['Budi'],
    })
    const entity = makeEntry({
      path: '/vault/no-code.md', filename: 'no-code.md', title: 'No Code',
      relationships: { Notes: ['[[Airdev]]', '[[Budi]]'] },
    })
    const groups = buildRelationshipGroups(entity, [entity, airdev, budibase])
    const notesGroup = groups.find((g) => g.label === 'Notes')
    expect(notesGroup).toBeDefined()
    expect(notesGroup!.entries).toHaveLength(2)
    expect(notesGroup!.entries.map(e => e.title).sort()).toEqual(['Airdev', 'Budibase'])
  })

  it('resolves Children via title match when belongsTo target differs from filename', () => {
    // Child's belongsTo uses [[No Code]] but entity filename is no-code-topic.md
    const child = makeEntry({
      path: '/vault/tool.md', filename: 'tool.md', title: 'Tool',
      belongsTo: ['[[No Code]]'], modifiedAt: 1700000000,
    })
    const entity = makeEntry({
      path: '/vault/no-code-topic.md', filename: 'no-code-topic.md', title: 'No Code',
      relationships: {},
    })
    const groups = buildRelationshipGroups(entity, [entity, child])
    expect(groups.find((g) => g.label === 'Children')!.entries).toHaveLength(1)
  })
})

describe('getSortComparator — custom properties', () => {
  it('sorts by string property alphabetically', () => {
    const a = makeEntry({ title: 'A', properties: { Priority: 'High' } })
    const b = makeEntry({ title: 'B', properties: { Priority: 'Low' } })
    const c = makeEntry({ title: 'C', properties: { Priority: 'Medium' } })
    const sorted = [a, b, c].sort(getSortComparator('property:Priority'))
    expect(sorted.map((e) => e.title)).toEqual(['A', 'B', 'C'])
  })

  it('sorts by numeric property', () => {
    const a = makeEntry({ title: 'A', properties: { Rating: 3 } })
    const b = makeEntry({ title: 'B', properties: { Rating: 5 } })
    const c = makeEntry({ title: 'C', properties: { Rating: 1 } })
    const sorted = [a, b, c].sort(getSortComparator('property:Rating'))
    expect(sorted.map((e) => e.title)).toEqual(['C', 'A', 'B'])
  })

  it('sorts by date property chronologically', () => {
    const a = makeEntry({ title: 'A', properties: { 'Due date': '2026-06-15' } })
    const b = makeEntry({ title: 'B', properties: { 'Due date': '2026-01-01' } })
    const c = makeEntry({ title: 'C', properties: { 'Due date': '2026-03-10' } })
    const sorted = [a, b, c].sort(getSortComparator('property:Due date'))
    expect(sorted.map((e) => e.title)).toEqual(['B', 'C', 'A'])
  })

  it('pushes null values to end regardless of direction', () => {
    const a = makeEntry({ title: 'A', properties: { Priority: 'High' } })
    const b = makeEntry({ title: 'B', properties: {} })
    const c = makeEntry({ title: 'C', properties: { Priority: 'Low' } })
    const ascSorted = [a, b, c].sort(getSortComparator('property:Priority', 'asc'))
    expect(ascSorted.map((e) => e.title)).toEqual(['A', 'C', 'B'])
    const descSorted = [a, b, c].sort(getSortComparator('property:Priority', 'desc'))
    expect(descSorted.map((e) => e.title)).toEqual(['C', 'A', 'B'])
  })

  it('sorts descending when direction is desc', () => {
    const a = makeEntry({ title: 'A', properties: { Rating: 3 } })
    const b = makeEntry({ title: 'B', properties: { Rating: 5 } })
    const c = makeEntry({ title: 'C', properties: { Rating: 1 } })
    const sorted = [a, b, c].sort(getSortComparator('property:Rating', 'desc'))
    expect(sorted.map((e) => e.title)).toEqual(['B', 'A', 'C'])
  })

  it('handles entries with no properties field gracefully', () => {
    const a = makeEntry({ title: 'A', properties: { Priority: 'High' } })
    const b = makeEntry({ title: 'B', properties: {} })
    const sorted = [a, b].sort(getSortComparator('property:Priority'))
    expect(sorted.map((e) => e.title)).toEqual(['A', 'B'])
  })

  it('handles boolean property sorting', () => {
    const a = makeEntry({ title: 'A', properties: { Reviewed: true } })
    const b = makeEntry({ title: 'B', properties: { Reviewed: false } })
    const sorted = [a, b].sort(getSortComparator('property:Reviewed'))
    expect(sorted.map((e) => e.title)).toEqual(['B', 'A'])
  })
})

describe('extractSortableProperties', () => {
  it('returns union of all property keys across entries', () => {
    const entries = [
      makeEntry({ properties: { Priority: 'High', Rating: 5 } }),
      makeEntry({ properties: { Priority: 'Low', Company: 'Acme' } }),
    ]
    expect(extractSortableProperties(entries)).toEqual(['Company', 'Priority', 'Rating'])
  })

  it('returns empty array for entries without properties', () => {
    const entries = [makeEntry(), makeEntry()]
    expect(extractSortableProperties(entries)).toEqual([])
  })

  it('returns empty array for empty entry list', () => {
    expect(extractSortableProperties([])).toEqual([])
  })

  it('deduplicates property keys', () => {
    const entries = [
      makeEntry({ properties: { Priority: 'High' } }),
      makeEntry({ properties: { Priority: 'Low' } }),
    ]
    expect(extractSortableProperties(entries)).toEqual(['Priority'])
  })
})

describe('getSortOptionLabel', () => {
  it('returns label for built-in options', () => {
    expect(getSortOptionLabel('modified')).toBe('Modified')
    expect(getSortOptionLabel('title')).toBe('Title')
  })

  it('returns property key for custom properties', () => {
    expect(getSortOptionLabel('property:Priority')).toBe('Priority')
    expect(getSortOptionLabel('property:Due date')).toBe('Due date')
  })
})

describe('getDefaultDirection', () => {
  it('returns desc for time-based sorts', () => {
    expect(getDefaultDirection('modified')).toBe('desc')
    expect(getDefaultDirection('created')).toBe('desc')
  })

  it('returns asc for other sorts', () => {
    expect(getDefaultDirection('title')).toBe('asc')
    expect(getDefaultDirection('status')).toBe('asc')
    expect(getDefaultDirection('property:Priority')).toBe('asc')
  })
})

describe('serializeSortConfig', () => {
  it('serializes a built-in sort config', () => {
    expect(serializeSortConfig({ option: 'modified', direction: 'desc' })).toBe('modified:desc')
    expect(serializeSortConfig({ option: 'title', direction: 'asc' })).toBe('title:asc')
  })

  it('serializes a custom property sort config', () => {
    expect(serializeSortConfig({ option: 'property:Priority', direction: 'asc' })).toBe('property:Priority:asc')
  })
})

describe('parseSortConfig', () => {
  it('parses a built-in sort config', () => {
    expect(parseSortConfig('modified:desc')).toEqual({ option: 'modified', direction: 'desc' })
    expect(parseSortConfig('title:asc')).toEqual({ option: 'title', direction: 'asc' })
  })

  it('parses a custom property sort config with colon in option', () => {
    expect(parseSortConfig('property:Priority:asc')).toEqual({ option: 'property:Priority', direction: 'asc' })
  })

  it('returns null for null/undefined input', () => {
    expect(parseSortConfig(null)).toBeNull()
    expect(parseSortConfig(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSortConfig('')).toBeNull()
  })

  it('returns null for invalid direction', () => {
    expect(parseSortConfig('modified:up')).toBeNull()
  })

  it('returns null for string without colon', () => {
    expect(parseSortConfig('modified')).toBeNull()
  })

  it('roundtrips correctly', () => {
    const configs = [
      { option: 'modified' as const, direction: 'desc' as const },
      { option: 'title' as const, direction: 'asc' as const },
      { option: 'property:Due date' as const, direction: 'desc' as const },
    ]
    for (const config of configs) {
      expect(parseSortConfig(serializeSortConfig(config))).toEqual(config)
    }
  })
})

// --- Inbox ---

describe('buildValidLinkTargets', () => {
  it('builds a set of titles, filename stems, and path stems', () => {
    const entries = [
      makeEntry({ path: '/vault/project/my-project.md', filename: 'my-project.md', title: 'My Project', aliases: ['MP'] }),
      makeEntry({ path: '/vault/note/test.md', filename: 'test.md', title: 'Test Note' }),
    ]
    const targets = buildValidLinkTargets(entries)
    expect(targets.has('My Project')).toBe(true)
    expect(targets.has('Test Note')).toBe(true)
    expect(targets.has('my-project')).toBe(true)
    expect(targets.has('test')).toBe(true)
    expect(targets.has('MP')).toBe(true)
    // path stems (last 2 segments without .md)
    expect(targets.has('project/my-project')).toBe(true)
    expect(targets.has('note/test')).toBe(true)
  })
})

describe('isInboxEntry', () => {
  const allEntries = [
    makeEntry({ path: '/vault/topic/ai.md', filename: 'ai.md', title: 'AI', aliases: [] }),
    makeEntry({ path: '/vault/project/laputa.md', filename: 'laputa.md', title: 'Laputa' }),
  ]
  const validTargets = buildValidLinkTargets(allEntries)

  it('returns true for a note with no outgoing links and no relationships', () => {
    const note = makeEntry({ outgoingLinks: [], relationships: {}, belongsTo: [], relatedTo: [] })
    expect(isInboxEntry(note, validTargets)).toBe(true)
  })

  it('returns false for a trashed note', () => {
    const note = makeEntry({ trashed: true, outgoingLinks: [], relationships: {} })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns false for an archived note', () => {
    const note = makeEntry({ archived: true, outgoingLinks: [], relationships: {} })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns false for a note with valid outgoing links', () => {
    const note = makeEntry({ outgoingLinks: ['AI'] })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns true for a note with only broken outgoing links (non-existent targets)', () => {
    const note = makeEntry({ outgoingLinks: ['NonExistent Page', 'Another Missing'] })
    expect(isInboxEntry(note, validTargets)).toBe(true)
  })

  it('returns false for a note with valid frontmatter relationships', () => {
    const note = makeEntry({ outgoingLinks: [], relationships: { 'Related to': ['[[AI]]'] } })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns false for a note with belongsTo pointing to real note', () => {
    const note = makeEntry({ outgoingLinks: [], belongsTo: ['[[Laputa]]'] })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns false for a note with relatedTo pointing to real note', () => {
    const note = makeEntry({ outgoingLinks: [], relatedTo: ['[[AI]]'] })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })

  it('returns true for a note with only broken relationship refs', () => {
    const note = makeEntry({ outgoingLinks: [], relationships: { 'Relates': ['[[Ghost]]'] }, belongsTo: ['[[Missing]]'] })
    expect(isInboxEntry(note, validTargets)).toBe(true)
  })

  it('excludes Type entries from inbox', () => {
    const note = makeEntry({ isA: 'Type', outgoingLinks: [], relationships: {} })
    expect(isInboxEntry(note, validTargets)).toBe(false)
  })
})

describe('filterInboxEntries', () => {
  const now = Math.floor(Date.now() / 1000)
  const DAY = 86400

  const allEntries = [
    makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'A', createdAt: now - 2 * DAY, outgoingLinks: [] }),
    makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'B', createdAt: now - 15 * DAY, outgoingLinks: [] }),
    makeEntry({ path: '/vault/c.md', filename: 'c.md', title: 'C', createdAt: now - 60 * DAY, outgoingLinks: [] }),
    makeEntry({ path: '/vault/d.md', filename: 'd.md', title: 'D', createdAt: now - 120 * DAY, outgoingLinks: [] }),
    makeEntry({ path: '/vault/linked.md', filename: 'linked.md', title: 'Linked', createdAt: now - 1 * DAY, outgoingLinks: ['A'] }),
  ]

  it('filters by "week" period (last 7 days)', () => {
    const result = filterInboxEntries(allEntries, 'week')
    expect(result.map(e => e.title)).toEqual(['A'])
  })

  it('filters by "month" period (last 30 days)', () => {
    const result = filterInboxEntries(allEntries, 'month')
    expect(result.map(e => e.title)).toEqual(['A', 'B'])
  })

  it('filters by "quarter" period (last 90 days)', () => {
    const result = filterInboxEntries(allEntries, 'quarter')
    expect(result.map(e => e.title)).toEqual(['A', 'B', 'C'])
  })

  it('filters by "all" period', () => {
    const result = filterInboxEntries(allEntries, 'all')
    expect(result.map(e => e.title)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('sorts by createdAt descending', () => {
    const result = filterInboxEntries(allEntries, 'all')
    for (let i = 1; i < result.length; i++) {
      expect((result[i - 1].createdAt ?? 0)).toBeGreaterThanOrEqual((result[i].createdAt ?? 0))
    }
  })

  it('excludes linked notes', () => {
    const result = filterInboxEntries(allEntries, 'all')
    expect(result.find(e => e.title === 'Linked')).toBeUndefined()
  })

  it('returns empty array when all notes have valid outgoing links', () => {
    const linked = [
      makeEntry({ path: '/vault/x.md', title: 'X', outgoingLinks: ['Y'] }),
      makeEntry({ path: '/vault/y.md', title: 'Y', outgoingLinks: ['X'] }),
    ]
    const result = filterInboxEntries(linked, 'all')
    expect(result).toEqual([])
  })
})

describe('filterEntries — folder selection', () => {
  const entries = [
    makeEntry({ path: '/vault/projects/laputa/note1.md', title: 'Note 1' }),
    makeEntry({ path: '/vault/projects/laputa/note2.md', title: 'Note 2' }),
    makeEntry({ path: '/vault/projects/portfolio/site.md', title: 'Site' }),
    makeEntry({ path: '/vault/areas/health.md', title: 'Health' }),
    makeEntry({ path: '/vault/root-note.md', title: 'Root' }),
  ]

  it('filters entries by folder path', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'projects/laputa' })
    expect(result.map(e => e.title)).toEqual(['Note 1', 'Note 2'])
  })

  it('does not include notes from sibling folders', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'projects/laputa' })
    expect(result.find(e => e.title === 'Site')).toBeUndefined()
  })

  it('filters recursively — includes notes from subfolders', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'projects' })
    expect(result.map(e => e.title)).toEqual(['Note 1', 'Note 2', 'Site'])
  })

  it('filters direct children', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'areas' })
    expect(result.map(e => e.title)).toEqual(['Health'])
  })

  it('returns empty for root when entries are in subfolders', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'nonexistent' })
    expect(result).toEqual([])
  })

  it('excludes archived and trashed entries by default', () => {
    const withArchived = [
      ...entries,
      makeEntry({ path: '/vault/projects/laputa/archived.md', title: 'Archived', archived: true }),
    ]
    const result = filterEntries(withArchived, { kind: 'folder', path: 'projects/laputa' })
    expect(result.find(e => e.title === 'Archived')).toBeUndefined()
  })
})

describe('filterEntries — fileKind filtering', () => {
  const entries = [
    makeEntry({ path: '/vault/note.md', title: 'Note', fileKind: 'markdown' }),
    makeEntry({ path: '/vault/config.yml', title: 'config.yml', fileKind: 'text' }),
    makeEntry({ path: '/vault/photo.png', title: 'photo.png', fileKind: 'binary' }),
    makeEntry({ path: '/vault/projects/readme.md', title: 'README', fileKind: 'markdown' }),
    makeEntry({ path: '/vault/projects/data.json', title: 'data.json', fileKind: 'text' }),
    makeEntry({ path: '/vault/projects/image.jpg', title: 'image.jpg', fileKind: 'binary' }),
  ]

  it('all-notes filter only shows markdown files', () => {
    const result = filterEntries(entries, { kind: 'filter', filter: 'all' })
    expect(result.map(e => e.title)).toEqual(['Note', 'README'])
  })

  it('folder view shows all file kinds including binary', () => {
    const result = filterEntries(entries, { kind: 'folder', path: 'projects' })
    expect(result.map(e => e.title)).toEqual(['README', 'data.json', 'image.jpg'])
  })

  it('sectionGroup filter only shows markdown files', () => {
    const typed = entries.map(e => ({ ...e, isA: 'Note' }))
    const result = filterEntries(typed, { kind: 'sectionGroup', type: 'Note' })
    expect(result.map(e => e.title)).toEqual(['Note', 'README'])
  })

  it('entries without fileKind are treated as markdown', () => {
    const legacy = [
      makeEntry({ path: '/vault/old.md', title: 'Old' }),
    ]
    const result = filterEntries(legacy, { kind: 'filter', filter: 'all' })
    expect(result.map(e => e.title)).toEqual(['Old'])
  })
})
