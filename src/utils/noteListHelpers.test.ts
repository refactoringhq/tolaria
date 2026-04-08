import { describe, expect, it } from 'vitest'
import { countAllByFilter, countByFilter, filterEntries } from './noteListHelpers'
import { allSelection, makeEntry, mockEntries } from '../test-utils/noteListTestUtils'

describe('filterEntries', () => {
  it('returns empty for entity selections because entity view uses grouped relationships', () => {
    const result = filterEntries(mockEntries, { kind: 'entity', entry: mockEntries[4] })
    expect(result).toHaveLength(0)
  })

  it('filters section groups by open sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'open')
    expect(result.map((entry) => entry.title)).toEqual(['Active'])
  })

  it('filters section groups by archived sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'archived')
    expect(result.map((entry) => entry.title)).toEqual(['Archived'])
  })

  it('defaults section groups to active notes when no sub-filter is provided', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' })
    expect(result.map((entry) => entry.title)).toEqual(['Active'])
  })

  it('filters all notes by open sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, allSelection, 'open')
    expect(result.map((entry) => entry.title)).toEqual(['Active', 'Other'])
  })

  it('filters all notes by archived sub-filter', () => {
    const entries = [
      makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
      makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
    ]

    const result = filterEntries(entries, allSelection, 'archived')
    expect(result.map((entry) => entry.title)).toEqual(['Archived'])
  })
})

describe('countByFilter', () => {
  it('counts open and archived entries for a type', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Project', archived: true }),
      makeEntry({ path: '/3.md', isA: 'Project' }),
      makeEntry({ path: '/4.md', isA: 'Note' }),
    ]

    expect(countByFilter(entries, 'Project')).toEqual({ open: 2, archived: 1 })
  })

  it('returns zeros when a type has no matching entries', () => {
    expect(countByFilter([], 'Project')).toEqual({ open: 0, archived: 0 })
  })
})

describe('countAllByFilter', () => {
  it('counts all entries by archive status', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Note' }),
      makeEntry({ path: '/3.md', isA: 'Project', archived: true }),
    ]

    expect(countAllByFilter(entries)).toEqual({ open: 2, archived: 1 })
  })

  it('excludes non-markdown files from counts', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Note', fileKind: 'markdown' }),
      makeEntry({ path: '/2.yml', isA: undefined, fileKind: 'text' }),
      makeEntry({ path: '/3.png', isA: undefined, fileKind: 'binary' }),
    ]

    expect(countAllByFilter(entries)).toEqual({ open: 1, archived: 0 })
  })
})
