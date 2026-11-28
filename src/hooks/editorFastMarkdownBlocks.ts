import { advanceMarkdownFence, readMarkdownFence } from '../utils/markdownFences'
import { isTableBodyLine, isTableStart, splitTableRow } from '../utils/markdownTables'
import {
  type FastMarkdownInlineItem as InlineItem,
  parseFastMarkdownInline as parseInline,
  fastMarkdownTextItem as textItem,
} from './editorFastMarkdownInline'

export interface FastMarkdownParseMetrics {
  blockCount: number
  durationMs: number
  fallbackReason: string | null
  sourceBytes: number
}

export interface FastMarkdownParseResult {
  blocks: unknown[]
  metrics: FastMarkdownParseMetrics
  supported: boolean
}

interface BlockLike {
  type: string
  content?: InlineItem[] | TableContentLike
  props?: Record<string, string | number | boolean>
  children: BlockLike[]
}

interface TableContentLike {
  type: 'tableContent'
  rows: Array<{ cells: Array<{ content: InlineItem[]; type: 'tableCell' }> }>
  headerRows?: number
}

type LineIndex = number
type MarkdownLine = string
type MarkdownSourceText = string

interface ParserState {
  fallbackReason: string | null
  lines: MarkdownLine[]
}

interface ListLine {
  checked?: boolean
  depth: number
  marker: string
  orderedStart?: number
  text: string
  type: 'bulletListItem' | 'checkListItem' | 'numberedListItem'
}

interface ParsedBlockStep {
  blocks: BlockLike[]
  next: LineIndex
}

interface BlockStepInput {
  block: BlockLike
  next: LineIndex
}

interface FastMarkdownSource {
  markdown: MarkdownSourceText
}

interface ParseResultInput {
  blocks: BlockLike[]
  source: FastMarkdownSource
  startedAt: number
  state: ParserState
}

interface SingleLineParseInput {
  index: LineIndex
  line: MarkdownLine
}

const HEADING_PREFIX_RE = /^(#{1,6})([ \t]+)/u
const WHITESPACE_RE = /\s/u
const LINE_TERMINATOR_RE = /[\n\r\u2028\u2029]/u
const ORDERED_LIST_RE = /^([ \t]*)(\d+)[.)][ \t]+(.+)$/u
const UNORDERED_LIST_RE = /^([ \t]*)([-*+])[ \t]+(.+)$/u
const CHECK_LIST_PREFIX_RE = /^([ \t]*)([-*+])[ \t]+\[([ xX])\]/u
const THEMATIC_BREAK_RE = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/u
const MARKDOWN_IMAGE_RE = /(^|[^\\])!\[[^\]]*\]\(/u
const STANDALONE_IMAGE_RE = /^[ \t]{0,3}!\[((?:\\.|[^\]\\])*)\]\((<[^>\r\n]+>|[^\s()\r\n]+)\)[ \t]*$/u
const REFERENCE_LINK_RE = /^[ \t]{0,3}\[[^\]]+\]:[ \t]+/u
const UNSUPPORTED_BLOCK_RE = /^[ \t]{0,3}(?:#{7,}|:::+|\[\^.+\]:)/u

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

function now(): number {
  return globalThis.performance.now()
}

function sourceBytes(source: FastMarkdownSource): number {
  return textEncoder ? textEncoder.encode(source.markdown).byteLength : source.markdown.length
}

function startsHtmlBlock(line: MarkdownLine): boolean {
  const candidate = line.trimStart()
  if (line.length - candidate.length > 3 || candidate.charAt(0) !== '<') return false
  const nameStart = candidate.charAt(1) === '/' ? 2 : 1
  return /[A-Za-z]/u.test(candidate.charAt(nameStart)) && candidate.indexOf('>', nameStart + 1) !== -1
}

function paragraphBlock(content: InlineItem[]): BlockLike {
  return { type: 'paragraph', content, children: [] }
}

function imageBlock(line: MarkdownLine): BlockLike | null {
  const match = STANDALONE_IMAGE_RE.exec(line)
  if (!match) return null
  const target = match[2]
  return {
    type: 'image',
    props: {
      name: match[1].replace(/\\([\]\\])/gu, '$1'),
      url: target.startsWith('<') ? target.slice(1, -1) : target,
    },
    children: [],
  }
}

function unsupportedLine(line: MarkdownLine): string | null {
  if (startsHtmlBlock(line)) return 'html-block'
  if (MARKDOWN_IMAGE_RE.test(line) && !imageBlock(line)) return 'markdown-image'
  if (REFERENCE_LINK_RE.test(line)) return 'reference-link'
  if (UNSUPPORTED_BLOCK_RE.test(line)) return 'unsupported-block-marker'
  return null
}

function trimmedEnd(text: string, end: number, isTrimmed: (char: string) => boolean): number {
  let next = end
  while (next > 0 && isTrimmed(text.charAt(next - 1))) next--
  return next
}

// Same result as /^(#{1,6})[ \t]+(.+?)\s*#*\s*$/u, in linear time. That regex backtracks
// cubically on a heading followed by a long run of spaces: 3,000 spaces took seconds.
function headingParts(line: MarkdownLine): [string, string] | null {
  const prefix = HEADING_PREFIX_RE.exec(line)
  if (!prefix) return null
  const rest = line.slice(prefix[0].length)
  const isWhitespace = (char: string) => WHITESPACE_RE.test(char)
  let end = trimmedEnd(rest, rest.length, isWhitespace)
  end = trimmedEnd(rest, end, char => char === '#')
  end = trimmedEnd(rest, end, isWhitespace)
  if (end === 0) {
    if (rest !== '' && !LINE_TERMINATOR_RE.test(rest.charAt(0))) return [prefix[1], rest.charAt(0)]
    return prefix[2].length > 1 ? [prefix[1], prefix[2].slice(-1)] : null
  }
  const text = rest.slice(0, end)
  return LINE_TERMINATOR_RE.test(text) ? null : [prefix[1], text]
}

function headingBlock(line: MarkdownLine): BlockLike | null {
  const match = headingParts(line)
  if (!match) return null
  return {
    type: 'heading',
    props: {
      level: match[0].length,
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: parseInline(match[1]),
    children: [],
  }
}

function quoteBlock(line: MarkdownLine): BlockLike | null {
  const match = /^[ \t]{0,3}>[ \t]?(.*)$/u.exec(line)
  if (!match) return null
  return {
    type: 'quote',
    content: parseInline(match[1]),
    children: [],
  }
}

function listLine(line: MarkdownLine): ListLine | null {
  const check = CHECK_LIST_PREFIX_RE.exec(line)
  if (check) {
    return {
      checked: check[3].toLowerCase() === 'x',
      depth: listDepth(check[1]),
      marker: check[2],
      text: line.slice(check[0].length).trimStart(),
      type: 'checkListItem',
    }
  }

  const ordered = ORDERED_LIST_RE.exec(line)
  if (ordered) {
    return {
      depth: listDepth(ordered[1]),
      marker: ordered[2],
      orderedStart: Number(ordered[2]),
      text: ordered[3],
      type: 'numberedListItem',
    }
  }

  const unordered = UNORDERED_LIST_RE.exec(line)
  if (!unordered) return null
  return {
    depth: listDepth(unordered[1]),
    marker: unordered[2],
    text: unordered[3],
    type: 'bulletListItem',
  }
}

function listDepth(indent: MarkdownLine): number {
  return Math.floor(indent.replace(/\t/gu, '  ').length / 2)
}

function listBlock(item: ListLine): BlockLike {
  return {
    type: item.type,
    props: {
      ...(item.type === 'checkListItem' ? { checked: item.checked === true } : {}),
      ...(item.type === 'numberedListItem' && item.orderedStart && item.orderedStart !== 1
        ? { start: item.orderedStart }
        : {}),
    },
    content: parseInline(item.text),
    children: [],
  }
}

function appendListBlock(state: ParserState, root: BlockLike[], stack: BlockLike[], item: ListLine): boolean {
  if (item.depth > stack.length) {
    state.fallbackReason = 'list-depth-gap'
    return false
  }

  const block = listBlock(item)
  if (item.depth === 0) {
    root.push(block)
  } else if (!appendNestedListBlock(state, stack, item.depth, block)) {
    return false
  }
  stack.splice(item.depth, 1, block)
  stack.length = item.depth + 1
  return true
}

function appendNestedListBlock(state: ParserState, stack: BlockLike[], depth: number, block: BlockLike): boolean {
  const parent = stack.at(depth - 1)
  if (!parent) {
    state.fallbackReason = 'list-parent-missing'
    return false
  }
  parent.children.push(block)
  return true
}

function parseList(state: ParserState, start: LineIndex): { blocks: BlockLike[]; next: LineIndex } | null {
  const firstLine = state.lines.at(start)
  if (firstLine === undefined || !listLine(firstLine)) return null

  const root: BlockLike[] = []
  const stack: BlockLike[] = []
  let index = start

  while (index < state.lines.length) {
    const item = listLine(markdownLine(state.lines, index))
    if (!item) break
    if (!appendListBlock(state, root, stack, item)) return null
    index += 1
  }

  return { blocks: root, next: index }
}

function parseFence(state: ParserState, start: LineIndex): { block: BlockLike; next: LineIndex } | null {
  const line = markdownLine(state.lines, start)
  const opening = readMarkdownFence(line)
  if (!opening) return null
  const language = line.trimStart().slice(opening.length).trim().split(/\s+/u)[0] ?? ''
  let end = start + 1

  while (end < state.lines.length) {
    if (advanceMarkdownFence(markdownLine(state.lines, end), opening) === null) {
      return {
        block: {
          type: 'codeBlock',
          props: { language: language || 'text' },
          content: [textItem(state.lines.slice(start + 1, end).join('\n'))],
          children: [],
        },
        next: end + 1,
      }
    }
    end += 1
  }

  state.fallbackReason = 'unclosed-code-fence'
  return null
}

function parseTable(state: ParserState, start: LineIndex): { block: BlockLike; next: LineIndex } | null {
  if (
    !isTableStart({
      line: markdownLine(state.lines, start),
      nextLine: markdownLine(state.lines, start + 1),
    })
  )
    return null
  const rows: string[][] = [splitTableRow(markdownLine(state.lines, start))]
  let index = start + 2
  while (index < state.lines.length && isTableBodyLine(markdownLine(state.lines, index))) {
    rows.push(splitTableRow(markdownLine(state.lines, index)))
    index += 1
  }

  const width = Math.max(...rows.map(row => row.length), 0)

  return {
    block: {
      type: 'table',
      content: {
        type: 'tableContent',
        headerRows: 1,
        rows: rows.map(row => ({
          cells: Array.from({ length: width }, (_, cellIndex) => ({
            type: 'tableCell' as const,
            content: parseInline(row.at(cellIndex) ?? ''),
          })),
        })),
      },
      children: [],
    },
    next: index,
  }
}

function parseParagraph(state: ParserState, start: LineIndex): { block: BlockLike; next: LineIndex } {
  const lines: string[] = []
  let index = start
  while (index < state.lines.length) {
    const line = markdownLine(state.lines, index)
    if (!line.trim()) break
    if (index !== start && startsBlock(state.lines, index)) break
    lines.push(line.trim())
    index += 1
  }

  return {
    block: paragraphBlock(parseInline(lines.join('\n'))),
    next: index,
  }
}

function markdownLine(lines: MarkdownLine[], index: LineIndex): MarkdownLine {
  return lines.at(index) ?? ''
}

function startsBlock(lines: MarkdownLine[], index: LineIndex): boolean {
  const line = markdownLine(lines, index)
  return Boolean(
    imageBlock(line) ||
      headingBlock(line) ||
      quoteBlock(line) ||
      listLine(line) ||
      readMarkdownFence(line) !== null ||
      THEMATIC_BREAK_RE.test(line) ||
      isTableStart({ line, nextLine: markdownLine(lines, index + 1) })
  )
}

function blockStep({ block, next }: BlockStepInput): ParsedBlockStep {
  return { blocks: [block], next }
}

function parseMultilineBlock(state: ParserState, index: LineIndex): ParsedBlockStep | null {
  const fence = parseFence(state, index)
  if (fence || state.fallbackReason) return fence ? blockStep({ block: fence.block, next: fence.next }) : null

  const table = parseTable(state, index)
  if (table || state.fallbackReason) return table ? blockStep({ block: table.block, next: table.next }) : null

  const list = parseList(state, index)
  return list ? { blocks: list.blocks, next: list.next } : null
}

function parseSingleLineBlock({ index, line }: SingleLineParseInput): ParsedBlockStep | null {
  const image = imageBlock(line)
  if (image) return blockStep({ block: image, next: index + 1 })

  const heading = headingBlock(line)
  if (heading) return blockStep({ block: heading, next: index + 1 })

  const quote = quoteBlock(line)
  if (quote) return blockStep({ block: quote, next: index + 1 })

  return THEMATIC_BREAK_RE.test(line) ? blockStep({ block: { type: 'divider', children: [] }, next: index + 1 }) : null
}

function parseNextBlock(state: ParserState, index: LineIndex): ParsedBlockStep | null {
  const multiline = parseMultilineBlock(state, index)
  if (multiline || state.fallbackReason) return multiline

  const line = markdownLine(state.lines, index)
  const singleLine = parseSingleLineBlock({ index, line })
  if (singleLine) return singleLine

  const paragraph = parseParagraph(state, index)
  return blockStep({ block: paragraph.block, next: paragraph.next })
}

function createParseResult({ blocks, source, startedAt, state }: ParseResultInput): FastMarkdownParseResult {
  return {
    blocks,
    supported: state.fallbackReason === null,
    metrics: {
      blockCount: blocks.length,
      durationMs: now() - startedAt,
      fallbackReason: state.fallbackReason,
      sourceBytes: sourceBytes(source),
    },
  }
}

function parseBlocks(source: FastMarkdownSource): FastMarkdownParseResult {
  const startedAt = now()
  const state: ParserState = {
    fallbackReason: null,
    lines: source.markdown.split(/\r?\n/u),
  }
  const blocks: BlockLike[] = []
  let index = 0

  while (index < state.lines.length) {
    const line = markdownLine(state.lines, index)
    const unsupported = unsupportedLine(line)
    if (unsupported) {
      state.fallbackReason = unsupported
      break
    }
    if (!line.trim()) {
      index += 1
      continue
    }

    const parsed = parseNextBlock(state, index)
    if (state.fallbackReason) break
    if (!parsed) break
    blocks.push(...parsed.blocks)
    index = parsed.next
  }

  return createParseResult({ blocks, source, startedAt, state })
}

export function tryParseFastMarkdownBlocks(markdown: MarkdownSourceText): FastMarkdownParseResult {
  return parseBlocks({ markdown })
}

function canUseFastMarkdownWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof URL !== 'undefined' && !('__vitest_worker__' in globalThis)
}

function parseFastMarkdownInWorker(source: FastMarkdownSource): Promise<FastMarkdownParseResult> {
  return new Promise(resolve => {
    let settled = false
    const worker = new Worker(new URL('./editorFastMarkdownBlocks.worker.ts', import.meta.url), { type: 'module' })
    const settle = (result: FastMarkdownParseResult) => {
      if (settled) return
      settled = true
      worker.terminate()
      resolve(result)
    }

    worker.onmessage = (event: MessageEvent<FastMarkdownParseResult>) => {
      settle(event.data)
    }
    worker.onerror = () => {
      settle(tryParseFastMarkdownBlocks(source.markdown))
    }
    worker.postMessage(source.markdown)
  })
}

export async function tryParseFastMarkdownBlocksOffThread(
  markdown: MarkdownSourceText
): Promise<FastMarkdownParseResult> {
  if (!canUseFastMarkdownWorker()) return tryParseFastMarkdownBlocks(markdown)
  try {
    return await parseFastMarkdownInWorker({ markdown })
  } catch {
    return tryParseFastMarkdownBlocks(markdown)
  }
}
