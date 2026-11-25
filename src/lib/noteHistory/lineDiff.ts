/**
 * A line-by-line comparison of two versions of a note, for the history drawer (TOL-421).
 * The longest common subsequence of the lines that differ, after the shared first and last
 * lines are set aside; texts too far apart for that are shown as one replaced block.
 */

export type DiffLineKind = 'same' | 'added' | 'removed'

export interface DiffLine {
  kind: DiffLineKind
  text: string
}

/** A run of unchanged lines folded away. */
export interface SkippedLines {
  kind: 'skipped'
  count: number
}

export type DiffRow = DiffLine | SkippedLines

/** Longest version compared, in characters: larger notes are not diffed or rendered line by line. */
export const MAX_COMPARED_CHARS = 400_000
/** Most lines a compared version may have, so the rows rendered stay bounded too. */
export const MAX_COMPARED_LINES = 10_000
/** Largest comparison table, in cells: about 2,000 differing lines on each side. */
const MAX_TABLE_CELLS = 4_000_000
const DEFAULT_CONTEXT_LINES = 3

/** Two versions of a note: what it is now (`from`) and what it would become (`to`). */
export interface NoteVersions {
  from: string
  to: string
}

/** The lines of the two versions. */
interface Sides {
  from: readonly string[]
  to: readonly string[]
}

function lineCountWithin(text: string, limit: number): boolean {
  let lines = 1
  for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) {
    lines += 1
    if (lines > limit + 1) return false
  }
  return true
}

function isSmallEnough(text: string): boolean {
  return text.length <= MAX_COMPARED_CHARS && lineCountWithin(text, MAX_COMPARED_LINES)
}

/** True when both versions are small enough to compare and show line by line. */
export function isComparable({ from, to }: NoteVersions): boolean {
  return isSmallEnough(from) && isSmallEnough(to)
}

function linesOf(text: string): string[] {
  if (text === '') return []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

const same = (text: string): DiffLine => ({ kind: 'same', text })
const removed = (text: string): DiffLine => ({ kind: 'removed', text })
const added = (text: string): DiffLine => ({ kind: 'added', text })

function sharedPrefixLength({ from, to }: Sides): number {
  let length = 0
  while (length < from.length && length < to.length && from[length] === to[length]) length += 1
  return length
}

function sharedSuffixLength({ from, to }: Sides, prefix: number): number {
  let length = 0
  const fits = () => from.length - length > prefix && to.length - length > prefix
  while (fits() && from[from.length - 1 - length] === to[to.length - 1 - length]) length += 1
  return length
}

/** `table[i][j]`: length of the longest common subsequence of `from[i..]` and `to[j..]`. */
function commonSubsequenceTable({ from, to }: Sides): Uint32Array[] {
  const table = Array.from({ length: from.length + 1 }, () => new Uint32Array(to.length + 1))
  for (let i = from.length - 1; i >= 0; i -= 1) {
    for (let j = to.length - 1; j >= 0; j -= 1) {
      table[i][j] = from[i] === to[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table
}

function middleDiff(sides: Sides): DiffLine[] {
  const { from, to } = sides
  if ((from.length + 1) * (to.length + 1) > MAX_TABLE_CELLS) return [...from.map(removed), ...to.map(added)]
  const table = commonSubsequenceTable(sides)
  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < from.length && j < to.length) {
    if (from[i] === to[j]) {
      result.push(same(from[i]))
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push(removed(from[i]))
      i += 1
    } else {
      result.push(added(to[j]))
      j += 1
    }
  }
  return [...result, ...from.slice(i).map(removed), ...to.slice(j).map(added)]
}

/** The lines of both versions in order, each marked as in both, only removed, or only added. */
export function lineDiff(versions: NoteVersions): DiffLine[] {
  const sides: Sides = { from: linesOf(versions.from), to: linesOf(versions.to) }
  const { from, to } = sides
  const prefix = sharedPrefixLength(sides)
  const suffix = sharedSuffixLength(sides, prefix)
  const middle = { from: from.slice(prefix, from.length - suffix), to: to.slice(prefix, to.length - suffix) }
  return [...from.slice(0, prefix).map(same), ...middleDiff(middle), ...from.slice(from.length - suffix).map(same)]
}

export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((line) => line.kind !== 'same')
}

/** Which unchanged lines stay visible: those within `context` lines of a change. */
function visibleSame(diff: DiffLine[], context: number): boolean[] {
  const visible = diff.map((line) => line.kind !== 'same')
  diff.forEach((line, index) => {
    if (line.kind === 'same') return
    const start = Math.max(0, index - context)
    for (let near = start; near <= Math.min(diff.length - 1, index + context); near += 1) visible[near] = true
  })
  return visible
}

/** Hidden runs shorter than this stay visible: folding them saves no space. */
const MIN_FOLDED_LINES = 3

function foldedRun(hidden: DiffLine[]): DiffRow[] {
  return hidden.length >= MIN_FOLDED_LINES ? [{ kind: 'skipped', count: hidden.length }] : hidden
}

/** The diff with each long run of unchanged lines folded into one skipped row. */
export function diffRows(diff: DiffLine[], context = DEFAULT_CONTEXT_LINES): DiffRow[] {
  const visible = visibleSame(diff, context)
  const rows: DiffRow[] = []
  let hidden: DiffLine[] = []
  diff.forEach((line, index) => {
    if (!visible[index]) {
      hidden.push(line)
      return
    }
    rows.push(...foldedRun(hidden), line)
    hidden = []
  })
  return [...rows, ...foldedRun(hidden)]
}
