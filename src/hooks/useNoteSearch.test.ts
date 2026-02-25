import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNoteSearch } from './useNoteSearch'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  relationships: {},
  icon: null,
  color: null,
  order: null,
  ...overrides,
})

const entries: VaultEntry[] = [
  makeEntry({ path: '/vault/a.md', title: 'Alpha Project', isA: 'Project', modifiedAt: 1700000003 }),
  makeEntry({ path: '/vault/b.md', title: 'Beta Notes', isA: 'Note', modifiedAt: 1700000002 }),
  makeEntry({ path: '/vault/c.md', title: 'Gamma Experiment', isA: 'Experiment', modifiedAt: 1700000001 }),
]

describe('useNoteSearch', () => {
  it('returns entries sorted by modifiedAt when query is empty', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    expect(result.current.results.map((r) => r.title)).toEqual([
      'Alpha Project',
      'Beta Notes',
      'Gamma Experiment',
    ])
  })

  it('filters entries by fuzzy match', () => {
    const { result } = renderHook(() => useNoteSearch(entries, 'alpha'))
    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0].title).toBe('Alpha Project')
  })

  it('returns empty results when query has no matches', () => {
    const { result } = renderHook(() => useNoteSearch(entries, 'zzzzzzz'))
    expect(result.current.results).toHaveLength(0)
  })

  it('respects maxResults', () => {
    const { result } = renderHook(() => useNoteSearch(entries, '', 2))
    expect(result.current.results).toHaveLength(2)
  })

  it('includes noteType for non-Note entries', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    const project = result.current.results.find((r) => r.title === 'Alpha Project')
    expect(project?.noteType).toBe('Project')
    expect(project?.typeColor).toBeTruthy()
  })

  it('excludes noteType for Note entries', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    const note = result.current.results.find((r) => r.title === 'Beta Notes')
    expect(note?.noteType).toBeUndefined()
    expect(note?.typeColor).toBeUndefined()
  })

  it('includes original VaultEntry in results', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    expect(result.current.results[0].entry).toBe(entries[0])
  })

  it('starts with selectedIndex 0', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    expect(result.current.selectedIndex).toBe(0)
  })

  it('resets selectedIndex when query changes', () => {
    let query = ''
    const { result, rerender } = renderHook(() => useNoteSearch(entries, query))

    act(() => {
      result.current.setSelectedIndex(2)
    })
    expect(result.current.selectedIndex).toBe(2)

    query = 'alpha'
    rerender()
    expect(result.current.selectedIndex).toBe(0)
  })

  it('handleKeyDown moves selection down on ArrowDown', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))

    act(() => {
      result.current.handleKeyDown(
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
      )
    })
    expect(result.current.selectedIndex).toBe(1)
  })

  it('handleKeyDown moves selection up on ArrowUp', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))

    act(() => {
      result.current.setSelectedIndex(2)
    })
    act(() => {
      result.current.handleKeyDown(
        new KeyboardEvent('keydown', { key: 'ArrowUp' }),
      )
    })
    expect(result.current.selectedIndex).toBe(1)
  })

  it('handleKeyDown clamps selection at boundaries', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))

    // Can't go below 0
    act(() => {
      result.current.handleKeyDown(
        new KeyboardEvent('keydown', { key: 'ArrowUp' }),
      )
    })
    expect(result.current.selectedIndex).toBe(0)

    // Can't go above last index
    act(() => {
      result.current.setSelectedIndex(2)
    })
    act(() => {
      result.current.handleKeyDown(
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
      )
    })
    expect(result.current.selectedIndex).toBe(2)
  })

  it('selectedEntry reflects current selection', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    expect(result.current.selectedEntry).toBe(entries[0])

    act(() => {
      result.current.setSelectedIndex(1)
    })
    expect(result.current.selectedEntry).toBe(entries[1])
  })

  it('selectedEntry is null when no results', () => {
    const { result } = renderHook(() => useNoteSearch(entries, 'zzzzzzz'))
    expect(result.current.selectedEntry).toBeNull()
  })

  it('does not prevent default for non-arrow keys', () => {
    const { result } = renderHook(() => useNoteSearch(entries, ''))
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    act(() => {
      result.current.handleKeyDown(event)
    })
    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  it('resolves custom type color from Type entries', () => {
    const withTypes: VaultEntry[] = [
      makeEntry({ path: '/vault/t/recipe.md', title: 'Recipe', isA: 'Type', color: 'orange', icon: 'cooking-pot' }),
      makeEntry({ path: '/vault/pasta.md', title: 'Pasta', isA: 'Recipe', modifiedAt: 1700000010 }),
      makeEntry({ path: '/vault/proj.md', title: 'My Project', isA: 'Project', modifiedAt: 1700000009 }),
    ]
    const { result } = renderHook(() => useNoteSearch(withTypes, ''))
    const pasta = result.current.results.find(r => r.title === 'Pasta')
    expect(pasta?.noteType).toBe('Recipe')
    expect(pasta?.typeColor).toBe('var(--accent-orange)')
    expect(pasta?.TypeIcon).toBeDefined()
    // Built-in type still works
    const project = result.current.results.find(r => r.title === 'My Project')
    expect(project?.typeColor).toBe('var(--accent-red)')
    expect(project?.TypeIcon).toBeDefined()
  })
})
