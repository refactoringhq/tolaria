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
  if (lines.at(-1) === '') lines.pop()
  return lines
}

const same = (text: string): DiffLine => ({ kind: 'same', text })
const removed = (text: string): DiffLine => ({ kind: 'removed', text })
const added = (text: string): DiffLine => ({ kind: 'added', text })

function sharedPrefixLength({ from, to }: Sides): number {
  let length = 0
  while (length < from.length && length < to.length && from.at(length) === to.at(length)) length += 1
  return length
}

function sharedSuffixLength({ from, to }: Sides, prefix: number): number {
  let length = 0
  const fits = () => from.length - length > prefix && to.length - length > prefix
  while (fits() && from.at(-1 - length) === to.at(-1 - length)) length += 1
  return length
}

type Table = Uint32Array[]

/** A position in both versions: line `i` of `from` and line `j` of `to`. */
interface Cursor {
  i: number
  j: number
}

/** Length of the longest common subsequence of `from[i..]` and `to[j..]`. */
function lcsLength(table: Table, { i, j }: Cursor): number {
  return table.at(i)?.at(j) ?? 0
}

function commonSubsequenceTable({ from, to }: Sides): Table {
  const table = Array.from({ length: from.length + 1 }, () => new Uint32Array(to.length + 1))
  for (let i = from.length - 1; i >= 0; i -= 1) {
    const row = table.at(i)
    for (let j = to.length - 1; j >= 0; j -= 1) {
      const length = from.at(i) === to.at(j)
        ? lcsLength(table, { i: i + 1, j: j + 1 }) + 1
        : Math.max(lcsLength(table, { i: i + 1, j }), lcsLength(table, { i, j: j + 1 }))
      row?.fill(length, j, j + 1)
    }
  }
  return table
}

/** The diff line at `at`, moving `at` past it. */
function nextLine(sides: Sides, table: Table, at: Cursor): DiffLine {
  const fromLine = sides.from.at(at.i) ?? ''
  const toLine = sides.to.at(at.j) ?? ''
  if (fromLine === toLine) {
    at.i += 1
    at.j += 1
    return same(fromLine)
  }
  if (lcsLength(table, { i: at.i + 1, j: at.j }) >= lcsLength(table, { i: at.i, j: at.j + 1 })) {
    at.i += 1
    return removed(fromLine)
  }
  at.j += 1
  return added(toLine)
}

function middleDiff(sides: Sides): DiffLine[] {
  const { from, to } = sides
  if ((from.length + 1) * (to.length + 1) > MAX_TABLE_CELLS) return [...from.map(removed), ...to.map(added)]
  const table = commonSubsequenceTable(sides)
  const result: DiffLine[] = []
  const at: Cursor = { i: 0, j: 0 }
  while (at.i < from.length && at.j < to.length) result.push(nextLine(sides, table, at))
  return [...result, ...from.slice(at.i).map(removed), ...to.slice(at.j).map(added)]
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
    visible.fill(true, Math.max(0, index - context), index + context + 1)
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
    if (!visible.at(index)) {
      hidden.push(line)
      return
    }
    rows.push(...foldedRun(hidden), line)
    hidden = []
  })
  return [...rows, ...foldedRun(hidden)]
}
