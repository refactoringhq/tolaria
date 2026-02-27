import { describe, it, expect } from 'vitest'
import { dedupByPath } from './useUnifiedSearch'
import type { SearchResult } from '../types'

function result(path: string, score: number, title = 'Note'): SearchResult {
  return { path, score, title, snippet: '', noteType: null }
}

describe('dedupByPath', () => {
  it('keeps higher-scored entry when path appears twice', () => {
    const input = [
      result('/vault/a.md', 0.7),
      result('/vault/b.md', 0.6),
      result('/vault/a.md', 0.9),
    ]
    const out = dedupByPath(input)
    expect(out).toHaveLength(2)
    expect(out[0].path).toBe('/vault/a.md')
    expect(out[0].score).toBe(0.9)
    expect(out[1].path).toBe('/vault/b.md')
  })

  it('preserves order of first occurrence', () => {
    const input = [
      result('/vault/c.md', 0.5),
      result('/vault/a.md', 0.8),
      result('/vault/c.md', 0.9),
    ]
    const out = dedupByPath(input)
    expect(out.map(r => r.path)).toEqual(['/vault/c.md', '/vault/a.md'])
  })

  it('returns same array when no duplicates', () => {
    const input = [
      result('/vault/a.md', 0.9),
      result('/vault/b.md', 0.8),
      result('/vault/c.md', 0.7),
    ]
    const out = dedupByPath(input)
    expect(out).toHaveLength(3)
  })

  it('handles empty array', () => {
    expect(dedupByPath([])).toEqual([])
  })

  it('handles triple duplicate — keeps best score', () => {
    const input = [
      result('/vault/a.md', 0.3),
      result('/vault/a.md', 0.9),
      result('/vault/a.md', 0.5),
    ]
    const out = dedupByPath(input)
    expect(out).toHaveLength(1)
    expect(out[0].score).toBe(0.9)
  })
})
