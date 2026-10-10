import {
  serializeBlockNoteMarkdown,
  type DirectMarkdownCapableSerializer,
} from './blockNoteDirectMarkdown'

export const MARKDOWN_HIGHLIGHT_STYLE = 'highlight' as const
export const MARKDOWN_HIGHLIGHT_COLOR_OPTIONS = [
  { color: 'yellow', localeKey: 'editor.formatting.highlightYellow', markdownPrefix: '' },
  { color: 'green', localeKey: 'editor.formatting.highlightGreen', markdownPrefix: '🟢' },
  { color: 'red', localeKey: 'editor.formatting.highlightRed', markdownPrefix: '🔴' },
  { color: 'blue', localeKey: 'editor.formatting.highlightBlue', markdownPrefix: '🔵' },
  { color: 'purple', localeKey: 'editor.formatting.highlightPurple', markdownPrefix: '🟣' },
] as const

export type MarkdownHighlightColor = typeof MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[number]['color']

export const DEFAULT_MARKDOWN_HIGHLIGHT_COLOR = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[0].color
export const MARKDOWN_HIGHLIGHT_COLORS = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.map(({ color }) => color)

interface TextStyles {
  [style: string]: string | boolean | undefined
}

interface InlineItem {
  type: string
  text?: string
  styles?: TextStyles
  content?: unknown
  props?: Record<string, string>
  [key: string]: unknown
}

interface BlockLike {
  type?: string
  content?: BlockContent
  props?: Record<string, string>
  children?: BlockLike[]
  [key: string]: unknown
}

interface TableContentLike {
  type?: string
  rows?: TableRowLike[]
  [key: string]: unknown
}

interface TableRowLike {
  cells?: TableCellValue[]
  [key: string]: unknown
}

interface TableCellLike {
  content?: InlineItem[]
  [key: string]: unknown
}

type MarkdownSerializer = DirectMarkdownCapableSerializer

type BlockContent = unknown
type TableCellValue = TableCellLike | string
type InlineContentTransform = (content: InlineItem[]) => InlineItem[]
type InlineSegment = { kind: 'delimiter' } | { kind: 'item'; item: InlineItem }
type HighlightInjectionState = {
  color: MarkdownHighlightColor | null
  readsColorPrefix: boolean
}

function isTextItem(item: InlineItem): item is InlineItem & { text: string } {
  return item.type === 'text' && typeof item.text === 'string'
}

function isCodeTextItem(item: InlineItem): boolean {
  return item.styles?.code === true
}

function textItemWithText(item: InlineItem, text: string): InlineItem {
  return { ...item, text }
}

export function markdownHighlightPrefix(color: MarkdownHighlightColor): string {
  return markdownHighlightColorOption(color).markdownPrefix
}

export function markdownHighlightColorOption(color: MarkdownHighlightColor) {
  return MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(option => option.color === color)
    ?? MARKDOWN_HIGHLIGHT_COLOR_OPTIONS[0]
}

export function readMarkdownHighlightPrefix(text: string): {
  color: MarkdownHighlightColor
  text: string
} {
  const option = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(candidate => (
    candidate.markdownPrefix.length > 0 && text.startsWith(candidate.markdownPrefix)
  ))
  if (!option) return { color: DEFAULT_MARKDOWN_HIGHLIGHT_COLOR, text }

  return {
    color: option.color,
    text: text.slice(option.markdownPrefix.length),
  }
}

export function markdownHighlightColorFromStyles(styles: {
  backgroundColor?: unknown
  highlight?: unknown
} | undefined): MarkdownHighlightColor | null {
  if (styles?.highlight !== true) return null

  const customColor = MARKDOWN_HIGHLIGHT_COLOR_OPTIONS.find(option => (
    option.color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
      && option.color === styles.backgroundColor
  ))
  return customColor?.color ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
}

function pushTextSegment(segments: InlineSegment[], item: InlineItem, text: string): void {
  if (text) segments.push({ kind: 'item', item: textItemWithText(item, text) })
}

function splitTextItemAtHighlightDelimiters(item: InlineItem): InlineSegment[] {
  if (!isTextItem(item) || isCodeTextItem(item)) return [{ kind: 'item', item }]

  const segments: InlineSegment[] = []
  let cursor = 0
  let delimiterIndex = item.text.indexOf('==')

  while (delimiterIndex !== -1) {
    pushTextSegment(segments, item, item.text.slice(cursor, delimiterIndex))
    segments.push({ kind: 'delimiter' })
    cursor = delimiterIndex + 2
    delimiterIndex = item.text.indexOf('==', cursor)
  }

  pushTextSegment(segments, item, item.text.slice(cursor))
  return segments
}

function delimiterCount(segments: InlineSegment[]): number {
  return segments.filter(segment => segment.kind === 'delimiter').length
}

function addHighlightStyle(item: InlineItem, color: MarkdownHighlightColor): InlineItem {
  if (!isTextItem(item)) return item
  const styles = { ...(item.styles ?? {}) }
  delete styles.backgroundColor

  return {
    ...item,
    styles: {
      ...styles,
      highlight: true,
      ...(color === DEFAULT_MARKDOWN_HIGHLIGHT_COLOR ? {} : { backgroundColor: color }),
    },
  }
}

function toggleInjectedHighlight(state: HighlightInjectionState): InlineItem[] {
  state.color = state.color === null ? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR : null
  state.readsColorPrefix = state.color !== null
  return []
}

function consumeHighlightColorPrefix(
  item: InlineItem,
  state: HighlightInjectionState,
  hasContentAfter: boolean,
): InlineItem {
  if (state.color === null || !state.readsColorPrefix) return item

  state.readsColorPrefix = false
  if (!isTextItem(item)) return item

  const prefixed = readMarkdownHighlightPrefix(item.text)
  state.color = prefixed.color
  // `==🟢==` holds nothing but its own circle, so the emoji is the content, not a color cue:
  // dropping it would delete text the reader never meant to hide.
  if (prefixed.text.length === 0 && !hasContentAfter) return item
  return textItemWithText(item, prefixed.text)
}

function hasHighlightContentAfter(segments: InlineSegment[], index: number): boolean {
  return segments[index + 1]?.kind === 'item'
}

function isEmptyTextItem(item: InlineItem): boolean {
  return isTextItem(item) && item.text.length === 0
}

function injectHighlightSegment(
  segment: InlineSegment,
  state: HighlightInjectionState,
  hasContentAfter: boolean,
): InlineItem[] {
  if (segment.kind === 'delimiter') return toggleInjectedHighlight(state)

  const item = consumeHighlightColorPrefix(segment.item, state, hasContentAfter)
  state.readsColorPrefix = false
  if (isEmptyTextItem(item)) return []

  return [state.color === null ? item : addHighlightStyle(item, state.color)]
}

function injectMarkdownHighlights(content: InlineItem[]): InlineItem[] {
  const segments = content.flatMap(splitTextItemAtHighlightDelimiters)
  const delimiters = delimiterCount(segments)
  if (delimiters === 0 || delimiters % 2 !== 0) return content

  const state: HighlightInjectionState = { color: null, readsColorPrefix: false }
  return segments.flatMap((segment, index) => (
    injectHighlightSegment(segment, state, hasHighlightContentAfter(segments, index))
  ))
}

function withoutHighlightStyle(styles: TextStyles | undefined): TextStyles {
  const rest = { ...(styles ?? {}) }
  const color = markdownHighlightColorFromStyles(rest)
  delete rest.highlight
  if (color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR && rest.backgroundColor === color) {
    delete rest.backgroundColor
  }
  return rest
}

function isHighlightedTextItem(item: InlineItem): boolean {
  return isTextItem(item) && item.styles?.highlight === true
}

function highlightMarker(prefix = ''): InlineItem {
  return { type: 'text', text: `==${prefix}`, styles: {} }
}

function restoreHighlightedTextItem(item: InlineItem): InlineItem {
  return {
    ...item,
    styles: withoutHighlightStyle(item.styles),
  }
}

function appendRestoredHighlightedItem(
  restored: InlineItem[],
  item: InlineItem,
  activeColor: MarkdownHighlightColor | null,
): MarkdownHighlightColor {
  const color = markdownHighlightColorFromStyles(item.styles) ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
  appendHighlightColorSwitch(restored, activeColor, color)
  restored.push(restoreHighlightedTextItem(item))
  return color
}

function appendHighlightColorSwitch(
  restored: InlineItem[],
  activeColor: MarkdownHighlightColor | null,
  color: MarkdownHighlightColor,
): void {
  if (activeColor === color) return
  if (activeColor !== null) restored.push(highlightMarker())
  restored.push(highlightMarker(markdownHighlightPrefix(color)))
}

function highlightedItemColor(item: InlineItem): MarkdownHighlightColor {
  return markdownHighlightColorFromStyles(item.styles) ?? DEFAULT_MARKDOWN_HIGHLIGHT_COLOR
}

function isBareHighlightColorPrefix(item: InlineItem, color: MarkdownHighlightColor): boolean {
  const prefix = markdownHighlightPrefix(color)
  return prefix.length > 0 && isTextItem(item) && item.text === prefix
}

/** A highlight holding nothing but its own circle is persisted as `==🟢==`, not `==🟢🟢==`. */
function bareHighlightColorMarker(
  content: InlineItem[],
  index: number,
): MarkdownHighlightColor | null {
  const item = content[index]
  if (!isHighlightedTextItem(item)) return null

  const color = highlightedItemColor(item)
  if (!isBareHighlightColorPrefix(item, color)) return null

  const next = content[index + 1]
  if (next !== undefined && isHighlightedTextItem(next) && highlightedItemColor(next) === color) {
    return null
  }
  return color
}

function appendRestoredPlainItem(
  restored: InlineItem[],
  item: InlineItem,
  activeColor: MarkdownHighlightColor | null,
): void {
  if (activeColor !== null) restored.push(highlightMarker())
  restored.push(item)
}

function restoreMarkdownHighlights(content: InlineItem[]): InlineItem[] {
  const restored: InlineItem[] = []
  let activeColor: MarkdownHighlightColor | null = null
  let changed = false

  for (const [index, item] of content.entries()) {
    const bareColor = bareHighlightColorMarker(content, index)
    if (bareColor !== null) {
      appendHighlightColorSwitch(restored, activeColor, bareColor)
      activeColor = bareColor
      changed = true
      continue
    }

    if (isHighlightedTextItem(item)) {
      activeColor = appendRestoredHighlightedItem(restored, item, activeColor)
      changed = true
      continue
    }

    appendRestoredPlainItem(restored, item, activeColor)
    activeColor = null
  }

  if (activeColor !== null) restored.push(highlightMarker())
  return changed ? restored : content
}

function isTableContent(content: BlockContent): content is TableContentLike {
  return Boolean(
    content
      && typeof content === 'object'
      && !Array.isArray(content)
      && (content as TableContentLike).type === 'tableContent'
      && Array.isArray((content as TableContentLike).rows),
  )
}

function transformTableCell(cell: TableCellValue, transform: InlineContentTransform): TableCellValue {
  if (typeof cell === 'string' || !Array.isArray(cell.content)) return cell
  const content = transform(cell.content)
  return content === cell.content ? cell : { ...cell, content }
}

function transformTableContent(
  content: TableContentLike,
  transform: InlineContentTransform,
): TableContentLike {
  const rows = content.rows?.map((row) => transformTableRow(row, transform))
  if (!rows || !content.rows || rows.every((row, index) => row === content.rows?.at(index))) return content
  return {
    ...content,
    rows,
  }
}

function transformTableRow(
  row: TableRowLike,
  transform: InlineContentTransform,
): TableRowLike {
  const cells = row.cells?.map((cell) => transformTableCell(cell, transform))
  if (!cells || !row.cells || cells.every((cell, index) => cell === row.cells?.at(index))) return row
  return { ...row, cells }
}

function transformBlockContent(
  content: BlockContent,
  transform: InlineContentTransform,
): BlockContent {
  if (Array.isArray(content)) return transform(content)
  if (isTableContent(content)) return transformTableContent(content, transform)
  return content
}

function shouldTransformBlockContent(block: BlockLike): boolean {
  return block.type !== 'codeBlock'
}

function transformBlock(block: BlockLike, transform: InlineContentTransform): BlockLike {
  const content = shouldTransformBlockContent(block)
    ? transformBlockContent(block.content, transform)
    : block.content
  const children = transformChildBlocks(block.children, child => transformBlock(child, transform))
  return content === block.content && children === block.children ? block : { ...block, content, children }
}

function transformChildBlocks(
  children: BlockLike[] | undefined,
  transform: (block: BlockLike) => BlockLike,
): BlockLike[] | undefined {
  if (!Array.isArray(children)) return children
  const nextChildren = children.map(transform)
  return nextChildren.some((child, index) => child !== children.at(index)) ? nextChildren : children
}

export function injectMarkdownHighlightsInBlocks(blocks: unknown[]): unknown[] {
  return (blocks as BlockLike[]).map(block => transformBlock(block, injectMarkdownHighlights))
}

export function restoreMarkdownHighlightsInBlocks(blocks: unknown[]): unknown[] {
  return (blocks as BlockLike[]).map(block => transformBlock(block, restoreMarkdownHighlights))
}

export function serializeMarkdownHighlightAwareBlocks(
  editor: MarkdownSerializer,
  blocks: unknown[],
): string {
  return serializeBlockNoteMarkdown(editor, restoreMarkdownHighlightsInBlocks(blocks)).trimEnd()
}
