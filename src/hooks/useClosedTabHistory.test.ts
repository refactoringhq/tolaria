import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClosedTabHistory } from './useClosedTabHistory'
import type { VaultEntry } from '../types'

const stubEntry = (path: string): VaultEntry => ({
  path, filename: path.split('/').pop() ?? '', title: path.split('/').pop()?.replace(/\.md$/, '') ?? '',
  isA: 'Note', aliases: [], belongsTo: [], relatedTo: [], status: 'Active', owner: null, cadence: null,
  archived: false, trashed: false, trashedAt: null, modifiedAt: 0, createdAt: 0, fileSize: 0,
  snippet: '', wordCount: 0, relationships: {}, icon: null, color: null, order: null, template: null, sort: null, outgoingLinks: [],
})

describe('useClosedTabHistory', () => {
  it('starts with empty history', () => {
    const { result } = renderHook(() => useClosedTabHistory())
    expect(result.current.canReopen).toBe(false)
  })

  it('records a closed tab and allows reopening', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => { result.current.push('/vault/a.md', 0, stubEntry('/vault/a.md')) })

    expect(result.current.canReopen).toBe(true)
    const entry = result.current.pop()
    expect(entry?.path).toBe('/vault/a.md')
    expect(entry?.index).toBe(0)
    expect(result.current.canReopen).toBe(false)
  })

  it('pops in LIFO order', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0, stubEntry('/vault/a.md'))
      result.current.push('/vault/b.md', 1, stubEntry('/vault/b.md'))
      result.current.push('/vault/c.md', 2, stubEntry('/vault/c.md'))
    })

    expect(result.current.pop()?.path).toBe('/vault/c.md')
    expect(result.current.pop()?.path).toBe('/vault/b.md')
    expect(result.current.pop()?.path).toBe('/vault/a.md')
    expect(result.current.pop()).toBeNull()
  })

  it('returns null when popping empty history', () => {
    const { result } = renderHook(() => useClosedTabHistory())
    expect(result.current.pop()).toBeNull()
  })

  it('caps history at 20 entries', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.push(`/vault/${i}.md`, i, stubEntry(`/vault/${i}.md`))
      }
    })

    // Should only have last 20 entries (5-24)
    const first = result.current.pop()
    expect(first?.path).toBe('/vault/24.md')

    // Pop remaining 19
    for (let i = 0; i < 19; i++) {
      result.current.pop()
    }
    expect(result.current.pop()).toBeNull()
  })

  it('deduplicates: closing same path twice keeps only latest entry', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0, stubEntry('/vault/a.md'))
      result.current.push('/vault/b.md', 1, stubEntry('/vault/b.md'))
      result.current.push('/vault/a.md', 2, stubEntry('/vault/a.md')) // close a.md again at different index
    })

    // a.md should only appear once (the latest), at the top
    expect(result.current.pop()?.path).toBe('/vault/a.md')
    expect(result.current.pop()?.path).toBe('/vault/b.md')
    expect(result.current.pop()).toBeNull()
  })

  it('clear resets the history', () => {
    const { result } = renderHook(() => useClosedTabHistory())

    act(() => {
      result.current.push('/vault/a.md', 0, stubEntry('/vault/a.md'))
      result.current.push('/vault/b.md', 1, stubEntry('/vault/b.md'))
    })

    act(() => { result.current.clear() })

    expect(result.current.canReopen).toBe(false)
    expect(result.current.pop()).toBeNull()
  })
})
