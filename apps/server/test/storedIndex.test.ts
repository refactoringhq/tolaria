import { afterEach, describe, expect, it, vi } from 'vitest'
import { putByPath, removeByPath, sortByPath } from '../src/pathOrder.ts'
import { DeferredWrite, type IndexFormat, parseStoredIndex } from '../src/storedIndex.ts'

const FORMAT: IndexFormat = { key: 'test-index.json', version: 2, name: 'test index', items: 'things' }

function stored(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value))
}

describe('parseStoredIndex', () => {
  it('reads the head and the items of a stored index', () => {
    expect(parseStoredIndex(FORMAT, stored({ version: 2, head: 'abc', things: [1] }))).toEqual({ head: 'abc', items: [1] })
    expect(parseStoredIndex(FORMAT, null)).toBeNull()
  })

  it.each([
    [Buffer.from('{oops'), 'test index is malformed: not valid JSON'],
    [stored([1, 2]), 'test index is malformed: not an index object'],
    [stored({ version: 1, head: 'abc', things: [] }), 'unsupported test index version: 1'],
    [stored({ version: 2, head: '', things: [] }), 'test index is malformed: no head commit'],
    [stored({ version: 2, head: 'abc' }), 'test index is malformed: no list of things'],
  ])('refuses a stored index it cannot trust', (bytes, message) => {
    expect(() => parseStoredIndex(FORMAT, bytes)).toThrow(message)
  })
})

describe('DeferredWrite', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes once some time after the first change, however many changes follow', async () => {
    vi.useFakeTimers()
    const write = vi.fn(async () => {})
    const deferred = new DeferredWrite({ write, delayMs: 1000, log: () => {} })
    deferred.schedule()
    deferred.schedule()
    await vi.advanceTimersByTimeAsync(999)
    expect(write).not.toHaveBeenCalled()
    deferred.schedule()
    await vi.advanceTimersByTimeAsync(1)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('writes at once on flush, and not again when the timer would have fired', async () => {
    vi.useFakeTimers()
    const write = vi.fn(async () => {})
    const deferred = new DeferredWrite({ write, delayMs: 1000, log: () => {} })
    deferred.schedule()
    await deferred.flush()
    await vi.advanceTimersByTimeAsync(2000)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('logs a failed write instead of throwing it at nobody', async () => {
    vi.useFakeTimers()
    const lines: string[] = []
    const deferred = new DeferredWrite({ write: async () => Promise.reject(new Error('disk full')), delayMs: 10, log: (line) => lines.push(line) })
    deferred.schedule()
    await vi.advanceTimersByTimeAsync(10)
    expect(lines).toEqual(['index not saved: disk full'])
  })
})

describe('path order', () => {
  const paths = ['b.md', 'A.md', 'a/c.md', 'Ä.md', 'z.md', 'a.md', '10.md', '9.md']

  it('keeps a list in the order a full localeCompare sort gives, one item at a time', () => {
    const items: { path: string }[] = []
    for (const path of paths) putByPath(items, { path })
    expect(items.map((item) => item.path)).toEqual([...paths].sort((a, b) => a.localeCompare(b)))
    expect(sortByPath(paths.map((path) => ({ path }))).map((item) => item.path)).toEqual(items.map((item) => item.path))
  })

  it('replaces the item at a path and removes items by path', () => {
    const items = sortByPath(paths.map((path) => ({ path, version: 1 })))
    putByPath(items, { path: 'z.md', version: 2 })
    expect(items.filter((item) => item.path === 'z.md')).toEqual([{ path: 'z.md', version: 2 }])
    expect(removeByPath(items, 'z.md')).toBe(true)
    expect(removeByPath(items, 'z.md')).toBe(false)
    expect(items).toHaveLength(paths.length - 1)
  })
})
