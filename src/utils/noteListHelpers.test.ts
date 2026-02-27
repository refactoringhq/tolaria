import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatSubtitle, formatSearchSubtitle, relativeDate } from './noteListHelpers'
import type { VaultEntry } from '../types'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/note/test.md', filename: 'test.md', title: 'Test',
    isA: 'Note', aliases: [], belongsTo: [], relatedTo: [],
    status: null, owner: null, cadence: null, archived: false,
    trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, outgoingLinks: [],
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
