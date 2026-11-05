import { isMobileMarkdownCodeFenceClose, readMobileMarkdownCodeFence } from './mobileMarkdownCodeFence'
import { parseMobileWikilink } from './mobileWikilinks'
import type {
  MobileEditorBlock,
  MobileEditorHeadingLevel,
  MobileEditorInline,
  MobileEditorListItem,
  MobileEditorOrderedListItem,
  MobileEditorTaskItem,
} from './mobileWorkspaceModel'

type MarkdownBody = string
type MarkdownLine = string
type MarkdownText = string
type WikilinkTarget = string
type NoteFilename = string
type NoteTitle = string
type SnippetText = string
type EditorBlockRead = {
  block: MobileEditorBlock
  nextIndex: number
}
type EditorBlockReader = (lines: MarkdownLine[], startIndex: number) => EditorBlockRead | null

const MAX_SNIPPET_LENGTH = 160
const MAX_EDITOR_BLOCKS = 10
const markdownSyntaxPattern = /(?:\[\[|\]\(|[*_`>#~]|\[[ xX]\]|^\s*(?:[-*>]|\d+[.)]))/u
const longTokenPattern = /\S{32,}/u
const editorBlockReaders: EditorBlockReader[] = [
  readCodeBlock,
  readDividerBlock,
  readTable,
  readHeadingBlock,
  readTasks,
  readOrderedList,
  readBulletList,
  readQuote,
]

export function deriveLocalVaultTitle({
  body,
  fallbackTitle,
  filename,
}: {
  body: MarkdownBody
  fallbackTitle: NoteTitle | null
  filename: NoteFilename
}) {
  return firstH1Title(body) ?? fallbackTitle ?? humanizeFilename(filename)
}

export function localVaultSnippet(body: MarkdownBody): SnippetText {
  let fallback = ''
  const primary = scanMarkdownLines(body, (line) => {
    if (isPrimarySnippetLine(line)) return line
    if (!fallback && isFallbackSnippetLine(line)) fallback = line
    return undefined
  })

  return truncateSnippet(stripMarkdown(primary ?? fallback))
}

export function localVaultOutgoingLinks(body: MarkdownBody): WikilinkTarget[] {
  const links: WikilinkTarget[] = []
  const wikilinkPattern = /\[\[([^\]]+)\]\]/g
  let fenceMarker: string | null = null

  scanMarkdownLines(body, (line) => {
    const nextFenceMarker = nextMarkdownFenceMarker(line, fenceMarker)
    const shouldSkip = fenceMarker !== null || nextFenceMarker !== fenceMarker
    fenceMarker = nextFenceMarker
    if (shouldSkip) return undefined

    wikilinkPattern.lastIndex = 0
    let match = wikilinkPattern.exec(line)
    while (match) {
      const parsed = parseMobileWikilink(match[0])
      if (parsed?.target) links.push(parsed.target)
      match = wikilinkPattern.exec(line)
    }
    return undefined
  })

  return [...new Set(links)].sort()
}

export function localVaultLinkCount(body: MarkdownBody): number {
  return localVaultOutgoingLinks(body).length
}

export function localVaultEditorBlocks(body: MarkdownBody): MobileEditorBlock[] {
  const lines = stripInitialH1(body).split(/\r?\n/)
  const blocks: MobileEditorBlock[] = []
  let index = 0

  while (index < lines.length && blocks.length < MAX_EDITOR_BLOCKS) {
    if (!lines[index].trim()) {
      index += 1
      continue
    }

    const parsed = readEditorBlock(lines, index)
    blocks.push(parsed.block)
    index = parsed.nextIndex
  }

  return blocks
}

function readEditorBlock(lines: MarkdownLine[], startIndex: number): EditorBlockRead {
  for (const reader of editorBlockReaders) {
    const result = reader(lines, startIndex)
    if (result) return result
  }

  const paragraph = readParagraph(lines, startIndex)
  return {
    block: { content: parseInlineText(paragraph.text), kind: 'paragraph' },
    nextIndex: paragraph.nextIndex,
  }
}

export function localVaultEditorBullets(blocks: MobileEditorBlock[]): string[] {
  return blocks.flatMap((block) => {
    if (block.kind !== 'bullets') return []
    return block.items.map((item) => item.content.map((segment) => segment.text).join(''))
  })
}

function firstH1Title(body: MarkdownBody): NoteTitle | null {
  const firstContentLine = scanMarkdownLines(body, (line) => line.trim() ? line : undefined)
  const match = firstContentLine?.trim().match(/^#\s+(.+)$/)
  return match ? stripMarkdown(match[1]).trim() : null
}

function humanizeFilename(filename: NoteFilename): NoteTitle {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  return withoutExtension
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function stripInitialH1(body: MarkdownBody): MarkdownBody {
  const lines = body.split(/\r?\n/)
  const firstContentIndex = lines.findIndex((line) => line.trim())
  const firstContentLine = lines[firstContentIndex]?.trim()
  if (firstContentIndex < 0 || (firstContentLine !== '#' && !firstContentLine?.startsWith('# '))) return body

  lines[firstContentIndex] = ''
  return lines.join('\n')
}

function lineFenceMarker(line: MarkdownLine): string | null {
  return line.trimStart().match(/^(`{3,}|~{3,})/)?.[1] ?? null
}

function nextMarkdownFenceMarker(line: MarkdownLine, currentMarker: string | null): string | null {
  const marker = lineFenceMarker(line)
  if (!marker) return currentMarker
  if (!currentMarker) return marker
  return marker[0] === currentMarker[0] && marker.length >= currentMarker.length ? null : currentMarker
}

function isPrimarySnippetLine(line: MarkdownLine): boolean {
  const trimmed = line.trim()
  return Boolean(trimmed)
    && !trimmed.startsWith('#')
    && !trimmed.startsWith('```')
    && !/^[-*_]{3,}$/.test(trimmed)
}

function scanMarkdownLines<T>(
  body: MarkdownBody,
  visit: (line: MarkdownLine) => T | undefined,
): T | undefined {
  let start = 0

  while (start <= body.length) {
    const end = body.indexOf('\n', start)
    const lineEnd = end === -1 ? body.length : end
    const rawLine = body.slice(start, lineEnd)
    const result = visit(rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine)
    if (result !== undefined) return result
    if (end === -1) break
    start = end + 1
  }

  return undefined
}

function isFallbackSnippetLine(line: MarkdownLine): boolean {
  const trimmed = line.trim()
  return Boolean(trimmed) && !trimmed.startsWith('```')
}

function truncateSnippet(text: MarkdownText): SnippetText {
  if (text.length <= MAX_SNIPPET_LENGTH) return text
  return `${text.slice(0, MAX_SNIPPET_LENGTH).trimEnd()}...`
}

function stripMarkdown(text: MarkdownText): MarkdownText {
  if (!markdownSyntaxPattern.test(text)) return addSoftBreaks(normalizeSnippetWhitespace(text))

  const stripped = text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^[\s>*-]+/g, '')
    .replace(/^\[[ xX]\]\s+/g, '')
    .replace(/^\d+[.)]\s+/g, '')
    .replace(/[*_`>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return addSoftBreaks(stripped)
}

function stripInlineMarkdown(text: MarkdownText): MarkdownText {
  const leading = text.match(/^\s*/)?.[0] ?? ''
  const trailing = text.match(/\s*$/)?.[0] ?? ''
  const stripped = stripMarkdown(text)
  if (!stripped) return ''
  return `${leading}${stripped}${trailing}`
}

function addSoftBreaks(text: MarkdownText): MarkdownText {
  if (!longTokenPattern.test(text)) return text
  return text.replace(/\S{32,}/g, (token) => token.replace(/([/._?&=-])/g, '$1\u200B'))
}

function normalizeSnippetWhitespace(text: MarkdownText): MarkdownText {
  return text.replace(/\s+/g, ' ').trim()
}

function headingBlock(line: MarkdownLine): MobileEditorBlock | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/)
  if (!match) return null

  return {
    kind: 'heading',
    level: headingLevel(match[1]),
    text: stripMarkdown(match[2]),
  }
}

function readHeadingBlock(lines: MarkdownLine[], startIndex: number): EditorBlockRead | null {
  const heading = headingBlock(lines[startIndex].trim())
  return heading ? { block: heading, nextIndex: startIndex + 1 } : null
}

function readDividerBlock(lines: MarkdownLine[], startIndex: number): EditorBlockRead | null {
  return isHorizontalRule(lines[startIndex]) ? { block: { kind: 'divider' }, nextIndex: startIndex + 1 } : null
}

function headingLevel(marker: MarkdownText): MobileEditorHeadingLevel {
  const level = marker.length
  if (level <= 1) return 1
  if (level === 2) return 2
  if (level === 3) return 3
  if (level === 4) return 4
  if (level === 5) return 5
  return 6
}

function readQuote(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'quote' }>; nextIndex: number } | null {
  const quoteLines: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].trim().match(/^>\s?(.*)$/)
    if (!match) break
    quoteLines.push(match[1])
    index += 1
  }

  return quoteLines.length > 0
    ? { block: { content: parseInlineText(quoteLines.join(' ')), kind: 'quote' }, nextIndex: index }
    : null
}

function readTasks(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'tasks' }>; nextIndex: number } | null {
  const items: Array<MobileEditorTaskItem & { sourceLine: number }> = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].match(/^(\s*)[-*]\s+\[([ xX])]\s+(.+)$/)
    if (!match) break
    items.push({
      checked: match[2].toLowerCase() === 'x',
      content: parseInlineText(match[3]),
      depth: listDepth(match[1]),
      sourceLine: index,
    })
    index += 1
  }

  return items.length > 0 ? { block: { items, kind: 'tasks' }, nextIndex: index } : null
}

function readOrderedList(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'orderedList' }>; nextIndex: number } | null {
  const items: MobileEditorOrderedListItem[] = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].match(/^(\s*)(\d+[.)])\s+(.+)$/)
    if (!match) break
    items.push({
      content: parseInlineText(match[3]),
      depth: listDepth(match[1]),
      marker: match[2],
    })
    index += 1
  }

  return items.length > 0 ? { block: { items, kind: 'orderedList' }, nextIndex: index } : null
}

function readBulletList(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'bullets' }>; nextIndex: number } | null {
  const items: MobileEditorListItem[] = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].match(/^(\s*)[-*]\s+(?!\[[ xX]\]\s)(.+)$/)
    if (!match) break
    items.push({
      content: parseInlineText(match[2]),
      depth: listDepth(match[1]),
    })
    index += 1
  }

  return items.length > 0 ? { block: { items, kind: 'bullets' }, nextIndex: index } : null
}

function listDepth(indent: MarkdownText): number {
  const expanded = indent.replace(/\t/g, '  ')
  return Math.min(Math.floor(expanded.length / 2), 3)
}

function readParagraph(lines: MarkdownLine[], startIndex: number): { nextIndex: number; text: MarkdownText } {
  const parts: string[] = []
  let index = startIndex

  while (index < lines.length && parts.length < 3) {
    const line = lines[index].trim()
    if (!line || isParagraphBoundary(lines, index)) break
    parts.push(line)
    index += 1
  }

  return {
    nextIndex: Math.max(index, startIndex + 1),
    text: parts.join(' '),
  }
}

function isParagraphBoundary(lines: MarkdownLine[], index: number): boolean {
  const line = lines[index].trim()
  return isBlockStart(line) || readTable(lines, index) !== null
}

function isBlockStart(line: MarkdownLine): boolean {
  return line.startsWith('```')
    || line.startsWith('#')
    || line.startsWith('>')
    || isHorizontalRule(line)
    || /^[-*]\s+/.test(line)
    || /^\d+[.)]\s+/.test(line)
}

function readCodeBlock(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'codeBlock' }>; nextIndex: number } | null {
  const fence = readMobileMarkdownCodeFence(lines[startIndex])
  if (!fence) return null

  const codeLines: string[] = []
  let index = startIndex + 1

  while (index < lines.length && !isMobileMarkdownCodeFenceClose(lines[index], fence)) {
    codeLines.push(lines[index])
    index += 1
  }

  return {
    block: {
      code: codeLines.join('\n'),
      kind: 'codeBlock',
      language: fence.info,
    },
    nextIndex: index < lines.length ? index + 1 : index,
  }
}

function isHorizontalRule(line: MarkdownLine): boolean {
  return /^[-*_]{3,}$/.test(line.trim())
}

function readTable(
  lines: MarkdownLine[],
  startIndex: number,
): { block: Extract<MobileEditorBlock, { kind: 'table' }>; nextIndex: number } | null {
  const header = lines[startIndex]
  const separator = lines[startIndex + 1]
  if (!header || !separator || !isPotentialTableRow(header) || !isMarkdownTableSeparator(separator)) {
    return null
  }

  const rows: string[][] = []
  let index = startIndex + 2
  while (index < lines.length && isPotentialTableRow(lines[index]) && rows.length < 4) {
    rows.push(splitTableCells(lines[index]))
    index += 1
  }

  return {
    block: {
      headers: splitTableCells(header),
      kind: 'table',
      rows,
    },
    nextIndex: index,
  }
}

function isPotentialTableRow(line: MarkdownLine): boolean {
  return line.trim().includes('|')
}

function isMarkdownTableSeparator(line: MarkdownLine): boolean {
  return rawTableCells(line).every((cell) => /^:?-+:?$/.test(cell))
}

function splitTableCells(line: MarkdownLine): MarkdownText[] {
  return rawTableCells(line).map((cell) => stripMarkdown(cell))
}

function rawTableCells(line: MarkdownLine): MarkdownText[] {
  return line.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseInlineText(text: MarkdownText): MobileEditorInline[] {
  const segments: MobileEditorInline[] = []
  const pattern = /(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)|(\[([^\]]+)\]\(([^)]+)\))|(\[\[[^\]]+\]\])/g
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) segments.push({ text: stripInlineMarkdown(text.slice(cursor, match.index)) })
    segments.push(inlineMatch(match))
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) segments.push({ text: stripInlineMarkdown(text.slice(cursor)) })

  return segments.filter((segment) => segment.text.length > 0)
}

function inlineMatch(match: RegExpMatchArray): MobileEditorInline {
  if (match[2]) return { code: true, text: match[2] }
  if (match[4]) return { bold: true, italic: true, text: stripMarkdown(match[4]) }
  if (match[6]) return { bold: true, text: stripMarkdown(match[6]) }
  if (match[8]) return { italic: true, text: stripMarkdown(match[8]) }
  if (match[10]) return { strike: true, text: stripMarkdown(match[10]) }
  if (match[12]) return { linkHref: match[13], text: stripMarkdown(match[12]) }
  return wikilinkInline(match[14] ?? '')
}

function wikilinkInline(value: MarkdownText): MobileEditorInline {
  const parsed = parseMobileWikilink(value)
  if (!parsed) return { text: stripMarkdown(value) }

  return {
    text: addSoftBreaks(parsed.display),
    wikilinkTarget: parsed.target,
  }
}
