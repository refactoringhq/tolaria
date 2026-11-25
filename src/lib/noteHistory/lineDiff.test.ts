import { describe, expect, it } from 'vitest'
import { type DiffRow, diffRows, hasChanges, isComparable, lineDiff, MAX_COMPARED_CHARS, MAX_COMPARED_LINES } from './lineDiff'

const same = (text: string): DiffRow => ({ kind: 'same', text })
const removed = (text: string): DiffRow => ({ kind: 'removed', text })
const added = (text: string): DiffRow => ({ kind: 'added', text })

describe('lineDiff', () => {
  it('marks the lines only in the first text removed and those only in the second added', () => {
    expect(lineDiff({ from: '# A\n\nold line\nkept\n', to: '# A\n\nnew line\nkept\nextra\n' })).toEqual([
      same('# A'),
      same(''),
      removed('old line'),
      added('new line'),
      same('kept'),
      added('extra'),
    ])
  })

  it('finds the lines both texts share in the middle', () => {
    expect(lineDiff({ from: 'a\nb\nc\nd', to: 'x\nb\nd\ny' })).toEqual([
      removed('a'),
      added('x'),
      same('b'),
      removed('c'),
      same('d'),
      added('y'),
    ])
  })

  it('reads Windows line endings as line breaks', () => {
    expect(lineDiff({ from: 'a\r\nb\r\n', to: 'a\nb\n' })).toEqual([same('a'), same('b')])
  })

  it('treats an empty text as no lines', () => {
    expect(lineDiff({ from: '', to: 'a\n' })).toEqual([added('a')])
    expect(lineDiff({ from: '', to: '' })).toEqual([])
  })

  it('replaces the whole middle when the texts are too far apart to compare line by line', () => {
    const from = Array.from({ length: 2100 }, (_, index) => `old ${index}`).join('\n')
    const to = Array.from({ length: 2100 }, (_, index) => `new ${index}`).join('\n')

    const lines = lineDiff({ from, to })

    expect(lines).toHaveLength(4200)
    expect(lines[0]).toEqual(removed('old 0'))
    expect(lines[2100]).toEqual(added('new 0'))
  })
})

describe('isComparable', () => {
  it('compares versions up to the size budget only', () => {
    const atBudget = 'a'.repeat(MAX_COMPARED_CHARS)

    expect(isComparable({ from: atBudget, to: 'b' })).toBe(true)
    expect(isComparable({ from: 'b', to: `${atBudget}a` })).toBe(false)
    expect(isComparable({ from: `${atBudget}a`, to: 'b' })).toBe(false)
  })

  it('compares versions up to the line budget only', () => {
    const lines = (count: number) => 'x\n'.repeat(count)

    expect(isComparable({ from: lines(MAX_COMPARED_LINES), to: 'b' })).toBe(true)
    expect(isComparable({ from: 'b', to: lines(MAX_COMPARED_LINES + 1) })).toBe(false)
  })
})

describe('hasChanges', () => {
  it('is false when every line is the same', () => {
    expect(hasChanges(lineDiff({ from: 'a\nb', to: 'a\nb' }))).toBe(false)
    expect(hasChanges(lineDiff({ from: 'a', to: 'b' }))).toBe(true)
  })
})

interface FoldCase {
  name: string
  from: string
  to: string
  context: number
  rows: DiffRow[]
}

const FOLD_CASES: FoldCase[] = [
  {
    name: 'folds a long run of unchanged lines, keeping some context before a change',
    from: '1\n2\n3\n4\n5\n6\n7\n8\nold',
    to: '1\n2\n3\n4\n5\n6\n7\n8\nnew',
    context: 2,
    rows: [{ kind: 'skipped', count: 6 }, same('7'), same('8'), removed('old'), added('new')],
  },
  {
    name: 'keeps context on both sides of an unchanged run between changes',
    from: 'a\n1\n2\n3\n4\n5\n6\nb',
    to: 'A\n1\n2\n3\n4\n5\n6\nB',
    context: 1,
    rows: [removed('a'), added('A'), same('1'), { kind: 'skipped', count: 4 }, same('6'), removed('b'), added('B')],
  },
  {
    name: 'does not fold fewer than three unchanged lines',
    from: '1\n2\n3\nold\n4\n5',
    to: '1\n2\n3\nnew\n4\n5',
    context: 1,
    rows: [same('1'), same('2'), same('3'), removed('old'), added('new'), same('4'), same('5')],
  },
  {
    name: 'leaves a short unchanged run between changes as it is',
    from: 'a\n1\n2\nb',
    to: 'A\n1\n2\nB',
    context: 1,
    rows: [removed('a'), added('A'), same('1'), same('2'), removed('b'), added('B')],
  },
]

describe('diffRows', () => {
  it.each(FOLD_CASES)('$name', ({ from, to, context, rows }) => {
    expect(diffRows(lineDiff({ from, to }), context)).toEqual(rows)
  })
})
