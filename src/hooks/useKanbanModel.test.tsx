import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { groupByStatus, useKanbanModel } from './useKanbanModel'

const runFrontmatterAndApply = vi.hoisted(() => vi.fn().mockResolvedValue('content'))
vi.mock('./frontmatterOps', () => ({
  runFrontmatterAndApply: runFrontmatterAndApply,
}))

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: 'notes/foo.md',
    filename: 'foo.md',
    title: 'Foo',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    ...overrides,
  }
}

describe('groupByStatus', () => {
  it('always emits the five canonical columns even when empty', () => {
    const columns = groupByStatus([])
    expect(columns.map((column) => column.status.key)).toEqual([
      'backlog',
      'doing',
      'review',
      'done',
      'blocked',
    ])
    for (const column of columns) {
      expect(column.cards).toEqual([])
    }
  })

  it('places notes in their declared canonical bucket', () => {
    const columns = groupByStatus([
      makeEntry({ path: 'a.md', status: 'doing' }),
      makeEntry({ path: 'b.md', status: 'done' }),
      makeEntry({ path: 'c.md', status: 'doing' }),
    ])
    const doing = columns.find((column) => column.status.key === 'doing')
    const done = columns.find((column) => column.status.key === 'done')
    expect(doing?.cards.map((card) => card.path)).toEqual(['a.md', 'c.md'])
    expect(done?.cards.map((card) => card.path)).toEqual(['b.md'])
  })

  it('routes notes with null or empty status to backlog', () => {
    const columns = groupByStatus([
      makeEntry({ path: 'a.md', status: null }),
      makeEntry({ path: 'b.md', status: '' }),
      makeEntry({ path: 'c.md', status: '   ' }),
    ])
    const backlog = columns.find((column) => column.status.key === 'backlog')
    expect(backlog?.cards.map((card) => card.path)).toEqual(['a.md', 'b.md', 'c.md'])
  })

  it('creates extra columns for non-canonical statuses, alphabetically after canonical', () => {
    const columns = groupByStatus([
      makeEntry({ path: 'a.md', status: 'wip' }),
      makeEntry({ path: 'b.md', status: 'archived' }),
    ])
    const keys = columns.map((column) => column.status.key)
    expect(keys.slice(0, 5)).toEqual(['backlog', 'doing', 'review', 'done', 'blocked'])
    expect(keys.slice(5)).toEqual(['archived', 'wip'])
    const wip = columns.find((column) => column.status.key === 'wip')
    expect(wip?.status.canonical).toBe(false)
  })

  it('sorts cards inside a column by modifiedAt descending', () => {
    const columns = groupByStatus([
      makeEntry({ path: 'older.md', status: 'doing', modifiedAt: 100 }),
      makeEntry({ path: 'newer.md', status: 'doing', modifiedAt: 200 }),
    ])
    const doing = columns.find((column) => column.status.key === 'doing')
    expect(doing?.cards.map((card) => card.path)).toEqual(['newer.md', 'older.md'])
  })
})

describe('useKanbanModel', () => {
  beforeEach(() => {
    runFrontmatterAndApply.mockClear()
  })

  it('exposes a memoised columns list', () => {
    const entries = [makeEntry({ path: 'a.md', status: 'doing' })]
    const { result } = renderHook(() => useKanbanModel(entries, makeDeps()))
    expect(result.current.columns.find((column) => column.status.key === 'doing')?.cards).toHaveLength(1)
  })

  it('writes the new status when a card is dropped on a different column', async () => {
    const entries = [makeEntry({ path: 'a.md', status: 'doing' })]
    const deps = makeDeps()
    const { result } = renderHook(() => useKanbanModel(entries, deps))
    await act(async () => {
      await result.current.handleDragEnd({ active: { id: 'a.md' }, over: { id: 'done' } } as never)
    })
    expect(runFrontmatterAndApply).toHaveBeenCalledTimes(1)
    expect(runFrontmatterAndApply.mock.calls[0]?.slice(0, 4)).toEqual([
      'update',
      'a.md',
      'status',
      'done',
    ])
  })

  it('skips the write when dropped on the same column', async () => {
    const entries = [makeEntry({ path: 'a.md', status: 'doing' })]
    const { result } = renderHook(() => useKanbanModel(entries, makeDeps()))
    await act(async () => {
      await result.current.handleDragEnd({ active: { id: 'a.md' }, over: { id: 'doing' } } as never)
    })
    expect(runFrontmatterAndApply).not.toHaveBeenCalled()
  })

  it('skips the write when dropped outside any column', async () => {
    const entries = [makeEntry({ path: 'a.md', status: 'doing' })]
    const { result } = renderHook(() => useKanbanModel(entries, makeDeps()))
    await act(async () => {
      await result.current.handleDragEnd({ active: { id: 'a.md' }, over: null } as never)
    })
    expect(runFrontmatterAndApply).not.toHaveBeenCalled()
  })

  it('skips the write when the dragged note is unknown', async () => {
    const { result } = renderHook(() => useKanbanModel([], makeDeps()))
    await act(async () => {
      await result.current.handleDragEnd({ active: { id: 'ghost.md' }, over: { id: 'done' } } as never)
    })
    expect(runFrontmatterAndApply).not.toHaveBeenCalled()
  })
})

function makeDeps() {
  return {
    updateTab: vi.fn(),
    updateEntry: vi.fn(),
    setToastMessage: vi.fn(),
    getEntry: vi.fn(),
  }
}
