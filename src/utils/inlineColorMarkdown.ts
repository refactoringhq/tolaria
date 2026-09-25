import { advanceMarkdownFence, type MarkdownFence } from './markdownFences'

export const INLINE_TEXT_COLOR_STYLE = 'textColor'
export const INLINE_BACKGROUND_COLOR_STYLE = 'backgroundColor'

export type InlineColorStyle =
  | typeof INLINE_TEXT_COLOR_STYLE
  | typeof INLINE_BACKGROUND_COLOR_STYLE

/**
 * BlockNote's inline color palette is fixed, so Tolaria persists the colors the
 * formatting toolbar applies with canonical inline HTML spans instead of
 * dropping them on save. Every Markdown reader that renders inline HTML shows
 * them, and the surrounding prose stays plain Markdown.
 */
export const INLINE_COLOR_HEX_BY_VALUE = {
  gray: '#9b9a97',
  brown: '#64473a',
  orange: '#d9730d',
  yellow: '#dfab01',
  green: '#0f7b6c',
  blue: '#0b6e99',
  purple: '#6940a5',
  pink: '#ad1a72',
  red: '#e03e3e',
} as const

export type InlineColorValue = keyof typeof INLINE_COLOR_HEX_BY_VALUE

export const INLINE_COLOR_STYLE_ORDER: readonly InlineColorStyle[] = [
  INLINE_TEXT_COLOR_STYLE,
  INLINE_BACKGROUND_COLOR_STYLE,
]

const INLINE_COLOR_CSS_PROPERTY_BY_STYLE = new Map<InlineColorStyle, string>([
  [INLINE_TEXT_COLOR_STYLE, 'color'],
  [INLINE_BACKGROUND_COLOR_STYLE, 'background-color'],
])

const INLINE_COLOR_STYLE_BY_CSS_PROPERTY = new Map<string, InlineColorStyle>(
  [...INLINE_COLOR_CSS_PROPERTY_BY_STYLE].map(([style, property]) => [property, style]),
)

const INLINE_COLOR_VALUE_BY_HEX = new Map<string, InlineColorValue>(
  (Object.keys(INLINE_COLOR_HEX_BY_VALUE) as InlineColorValue[]).map(
    value => [INLINE_COLOR_HEX_BY_VALUE[value], value],
  ),
)

const TOKEN_PREFIX = '\uE000TOLARIA_INLINE_COLOR:'
const TOKEN_SUFFIX = '\uE001'
const TOKEN_END = 'end'
const TOKEN_PATTERN = /\uE000TOLARIA_INLINE_COLOR:([a-z-]+):([0-9a-f]{6})\uE001|\uE000TOLARIA_INLINE_COLOR:end\uE001/gu
const SPAN_PATTERN = /<span style="([a-z-]+):(#[0-9a-fA-F]{6})">|<\/span>/gu
const INLINE_CODE_RUN_PATTERN = /`+/gu
const CLOSING_SPAN = '</span>'

interface TextStyles {
  [style: string]: string | boolean | undefined
}

interface InlineItem {
  type: string
  text?: string
  styles?: TextStyles
  props?: Record<string, string>
  [key: string]: unknown
}

interface BlockLike {
  type?: string
  content?: unknown
  children?: BlockLike[]
  [key: string]: unknown
}

interface TableRowLike {
  cells?: unknown[]
  [key: string]: unknown
}

interface TableContentLike {
  type: string
  rows?: TableRowLike[]
  [key: string]: unknown
}

interface TableCellLike {
  content?: InlineItem[]
  [key: string]: unknown
}

type InlineTransform = (content: InlineItem[]) => InlineItem[]

function inlineColorToken(style: InlineColorStyle, value: InlineColorValue): string {
  const property = INLINE_COLOR_CSS_PROPERTY_BY_STYLE.get(style)
  return `${TOKEN_PREFIX}${property}:${INLINE_COLOR_HEX_BY_VALUE[value].slice(1)}${TOKEN_SUFFIX}`
}

const CLOSING_TOKEN = `${TOKEN_PREFIX}${TOKEN_END}${TOKEN_SUFFIX}`

function isInlineColorValue(value: string): value is InlineColorValue {
  return typeof INLINE_COLOR_HEX_BY_VALUE[value as InlineColorValue] === 'string'
}

function isPlainTextItem(item: InlineItem): item is InlineItem & { text: string } {
  return item.type === 'text' && typeof item.text === 'string' && item.styles?.code !== true
}

function isTableContent(content: unknown): content is TableContentLike {
  return Boolean(
    content
      && typeof content === 'object'
      && !Array.isArray(content)
      && (content as TableContentLike).type === 'tableContent'
      && Array.isArray((content as TableContentLike).rows),
  )
}

function transformTableCell(cell: unknown, transform: InlineTransform): unknown {
  const content = (cell as TableCellLike | null)?.content
  if (!Array.isArray(content)) return cell

  const transformed = transform(content)
  return transformed === content ? cell : { ...(cell as TableCellLike), content: transformed }
}

function transformTableRow(row: TableRowLike, transform: InlineTransform): TableRowLike {
  const cells = row.cells
  if (!Array.isArray(cells)) return row

  const transformed = cells.map(cell => transformTableCell(cell, transform))
  return transformed.every((cell, index) => cell === cells.at(index))
    ? row
    : { ...row, cells: transformed }
}

function transformTableContent(content: TableContentLike, transform: InlineTransform): TableContentLike {
  const rows = content.rows
  if (!Array.isArray(rows)) return content

  const transformed = rows.map(row => transformTableRow(row, transform))
  return transformed.every((row, index) => row === rows.at(index))
    ? content
    : { ...content, rows: transformed }
}

function transformBlockContent(content: unknown, transform: InlineTransform): unknown {
  if (Array.isArray(content)) return transform(content as InlineItem[])
  if (isTableContent(content)) return transformTableContent(content, transform)
  return content
}

function transformChildBlocks(
  children: BlockLike[] | undefined,
  transform: (block: BlockLike) => BlockLike,
): BlockLike[] | undefined {
  if (!Array.isArray(children)) return children

  const transformed = children.map(transform)
  return transformed.some((child, index) => child !== children.at(index))
    ? transformed
    : children
}

function transformBlock(block: BlockLike, transform: InlineTransform): BlockLike {
  const content = block.type === 'codeBlock'
    ? block.content
    : transformBlockContent(block.content, transform)
  const children = transformChildBlocks(block.children, child => transformBlock(child, transform))

  return content === block.content && children === block.children
    ? block
    : { ...block, content, children }
}

function transformBlocks(blocks: unknown[], transform: InlineTransform): unknown[] {
  return (blocks as BlockLike[]).map(block => transformBlock(block, transform))
}

function inlineCodeRanges(line: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let openStart = -1
  let openLength = 0

  for (const match of line.matchAll(INLINE_CODE_RUN_PATTERN)) {
    const length = match[0].length
    if (openStart === -1) {
      openStart = match.index ?? 0
      openLength = length
      continue
    }
    if (length !== openLength) continue

    ranges.push({ start: openStart, end: (match.index ?? 0) + length })
    openStart = -1
  }
  return ranges
}

function isInsideInlineCode(index: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(range => index > range.start && index < range.end)
}

function markdownTokenForSpan(match: RegExpMatchArray, tokenizedSpans: boolean[]): string | null {
  const property = match.at(1)
  const hex = match.at(2)
  if (property === undefined || hex === undefined) {
    return tokenizedSpans.pop() ? CLOSING_TOKEN : null
  }

  const style = INLINE_COLOR_STYLE_BY_CSS_PROPERTY.get(property)
  const value = INLINE_COLOR_VALUE_BY_HEX.get(hex.toLowerCase())
  if (!style || !value) {
    tokenizedSpans.push(false)
    return null
  }

  tokenizedSpans.push(true)
  return inlineColorToken(style, value)
}

function replaceInlineColorSpans(line: string): string {
  if (!line.includes('<')) return line

  const codeRanges = inlineCodeRanges(line)
  const tokenizedSpans: boolean[] = []
  let output = ''
  let cursor = 0

  for (const match of line.matchAll(SPAN_PATTERN)) {
    const index = match.index ?? 0
    if (isInsideInlineCode(index, codeRanges)) continue

    const token = markdownTokenForSpan(match, tokenizedSpans)
    if (token === null) continue

    output += `${line.slice(cursor, index)}${token}`
    cursor = index + match[0].length
  }

  return output + line.slice(cursor)
}

/**
 * Hides canonical inline color spans from BlockNote's Markdown parser, which
 * drops raw inline HTML, so the colors can be restored as rich-editor styles.
 */
export function preProcessInlineColorMarkdown({ markdown }: { markdown: string }): string {
  const result: string[] = []
  let fence: MarkdownFence | null = null

  for (const line of markdown.split('\n')) {
    fence = advanceMarkdownFence(line, fence)
    result.push(fence === null ? replaceInlineColorSpans(line) : line)
  }
  return result.join('\n')
}

interface OpenInlineColor {
  style: InlineColorStyle
  value: InlineColorValue
}

function activeInlineColors(open: readonly OpenInlineColor[]): Partial<Record<InlineColorStyle, InlineColorValue>> {
  const active: Partial<Record<InlineColorStyle, InlineColorValue>> = {}
  for (const entry of open) active[entry.style] = entry.value
  return active
}

function itemWithInlineColors(
  item: InlineItem & { text: string },
  text: string,
  active: Partial<Record<InlineColorStyle, InlineColorValue>>,
): InlineItem {
  const styles: TextStyles = { ...(item.styles ?? {}) }
  for (const style of INLINE_COLOR_STYLE_ORDER) {
    const value = active[style]
    if (value) styles[style] = value
  }
  return { ...item, text, styles }
}

function injectInlineColorsInContent(content: InlineItem[]): InlineItem[] {
  const open: OpenInlineColor[] = []
  const items: InlineItem[] = []
  let changed = false

  for (const item of content) {
    if (!isPlainTextItem(item) || !item.text.includes(TOKEN_PREFIX)) {
      items.push(item)
      continue
    }

    changed = true
    let cursor = 0
    for (const match of item.text.matchAll(TOKEN_PATTERN)) {
      const index = match.index ?? 0
      const text = item.text.slice(cursor, index)
      if (text) items.push(itemWithInlineColors(item, text, activeInlineColors(open)))
      cursor = index + match[0].length

      if (match.at(1) === undefined) {
        if (open.length > 0) open.pop()
        else items.push({ ...item, text: CLOSING_SPAN })
        continue
      }
      const style = INLINE_COLOR_STYLE_BY_CSS_PROPERTY.get(match.at(1) ?? '')
      const value = INLINE_COLOR_VALUE_BY_HEX.get(`#${match.at(2)}`)
      if (style && value) open.push({ style, value })
    }

    const rest = item.text.slice(cursor)
    if (rest) items.push(itemWithInlineColors(item, rest, activeInlineColors(open)))
  }

  return changed ? items : content
}

function inlineColorsOfItem(item: InlineItem): OpenInlineColor[] {
  const styles = item.styles
  if (!styles) return []

  const colors: OpenInlineColor[] = []
  for (const style of INLINE_COLOR_STYLE_ORDER) {
    const value = styles[style]
    if (typeof value === 'string' && isInlineColorValue(value)) colors.push({ style, value })
  }
  return colors
}

function withoutInlineColors(styles: TextStyles | undefined): TextStyles | undefined {
  if (!styles) return styles

  const rest: TextStyles = { ...styles }
  for (const style of INLINE_COLOR_STYLE_ORDER) {
    const value = rest[style]
    if (typeof value === 'string' && isInlineColorValue(value)) delete rest[style]
  }
  return rest
}

function openingSpanItem(entry: OpenInlineColor): InlineItem {
  const property = INLINE_COLOR_CSS_PROPERTY_BY_STYLE.get(entry.style)
  return {
    type: 'text',
    text: `<span style="${property}:${INLINE_COLOR_HEX_BY_VALUE[entry.value]}">`,
    styles: {},
  }
}

function closingSpanItem(): InlineItem {
  return { type: 'text', text: CLOSING_SPAN, styles: {} }
}

function sameInlineColors(left: readonly OpenInlineColor[], right: readonly OpenInlineColor[]): boolean {
  return left.length === right.length
    && left.every((entry, index) => (
      entry.style === right.at(index)?.style && entry.value === right.at(index)?.value
    ))
}

function restoreInlineColorsInContent(content: InlineItem[]): InlineItem[] {
  let open: OpenInlineColor[] = []
  let changed = false
  const items: InlineItem[] = []

  const closeOpenSpans = () => {
    for (let index = open.length; index > 0; index--) items.push(closingSpanItem())
    open = []
  }

  for (const item of content) {
    const wanted = inlineColorsOfItem(item)
    if (wanted.length === 0 && open.length === 0) {
      items.push(item)
      continue
    }

    changed = true
    if (!sameInlineColors(wanted, open)) {
      closeOpenSpans()
      for (const entry of wanted) items.push(openingSpanItem(entry))
    }
    open = wanted
    items.push({ ...item, styles: withoutInlineColors(item.styles) })
  }

  if (open.length > 0) {
    changed = true
    closeOpenSpans()
  }

  return changed ? items : content
}

/** Rewrites rich-editor inline colors as Markdown-persistable HTML spans. */
export function restoreInlineColorsInBlocks(blocks: unknown[]): unknown[] {
  return transformBlocks(blocks, restoreInlineColorsInContent)
}

/** Applies persisted inline color spans to parsed rich-editor inline content. */
export function injectInlineColorsInBlocks(blocks: unknown[]): unknown[] {
  return transformBlocks(blocks, injectInlineColorsInContent)
}
