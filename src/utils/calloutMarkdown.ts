import type { BlockLike, InlineItem, MarkdownSerializer } from './durableMarkdownBlocks'
import { serializeInlineMathAwareBlocks } from './mathMarkdown'

export const CALLOUT_BLOCK_TYPE = 'calloutBlock'

export interface CalloutMarker {
  title: string
  type: string
}

interface CalloutBlockProps {
  calloutType: string
  title: string
}

const CALLOUT_MARKER = /^\[!([a-z][a-z0-9_-]*)\](?![+-])[ \t]*(.*)$/iu
function normalizedCalloutType(type: string): string {
  return type.trim().toLowerCase()
}

export function parseCalloutMarker(line: string): CalloutMarker | null {
  const match = CALLOUT_MARKER.exec(line.trim())
  const type = match?.at(1)
  if (!type) return null

  return {
    title: (match?.at(2) ?? '').trim(),
    type: normalizedCalloutType(type),
  }
}

const CALLOUT_TYPE = /^[a-z][a-z0-9_-]*$/u

function serializableCalloutType(type: string): string {
  const normalized = normalizedCalloutType(type)
  return CALLOUT_TYPE.test(normalized) ? normalized : 'note'
}

export function formatCalloutMarker(marker: CalloutMarker): string {
  const head = `[!${serializableCalloutType(marker.type)}]`
  const title = marker.title.replace(/\s*[\r\n]+\s*/gu, ' ').trim()
  return title ? `${head} ${title}` : head
}

export function calloutHeading(type: string, title: string, defaultHeading = 'Note'): string {
  if (title) return title
  const normalized = normalizedCalloutType(type)
  if (!normalized || normalized === 'note') return defaultHeading
  return normalized.split(/[-_]+/u).filter(Boolean).map((part) => (
    `${part.charAt(0).toUpperCase()}${part.slice(1)}`
  )).join(' ')
}

function inlineItemText(item: InlineItem): string {
  if (item.type === 'text' && typeof item.text === 'string') return item.text
  if (!Array.isArray(item.content)) return ''
  return (item.content as InlineItem[]).map(inlineItemText).join('')
}

function inlineContentText(content: InlineItem[] | undefined): string | null {
  if (!Array.isArray(content)) return null
  return content.map(inlineItemText).join('')
}

interface DroppedInlineItem {
  item: InlineItem | null
  remaining: number
}

function dropTextPrefix(item: InlineItem, count: number): DroppedInlineItem {
  const text = item.text ?? ''
  if (count >= text.length) return { item: null, remaining: count - text.length }
  return { item: { ...item, text: text.slice(count) }, remaining: 0 }
}

function dropNestedPrefix(item: InlineItem, count: number): DroppedInlineItem {
  const nested = item.content as InlineItem[]
  const result = dropInlinePrefix(nested, count)
  if (result.content.length === 0) return { item: null, remaining: result.remaining }
  return { item: { ...item, content: result.content }, remaining: result.remaining }
}

function dropInlineItemPrefix(item: InlineItem, count: number): DroppedInlineItem {
  if (count === 0) return { item, remaining: 0 }
  if (item.type === 'text' && typeof item.text === 'string') return dropTextPrefix(item, count)
  if (Array.isArray(item.content)) return dropNestedPrefix(item, count)
  return { item: null, remaining: count }
}

function dropInlinePrefix(
  content: InlineItem[],
  count: number,
): { content: InlineItem[]; remaining: number } {
  const result: InlineItem[] = []
  let remaining = count

  for (const item of content) {
    const dropped = dropInlineItemPrefix(item, remaining)
    remaining = dropped.remaining
    if (dropped.item) result.push(dropped.item)
  }
  return { content: result, remaining }
}

function readQuoteCallout(block: BlockLike): { bodyOffset: number; marker: CalloutMarker } | null {
  if (block.type !== 'quote') return null
  const text = inlineContentText(block.content)
  if (text === null) return null

  const newlineIndex = text.indexOf('\n')
  const firstLine = newlineIndex === -1 ? text : text.slice(0, newlineIndex)
  const marker = parseCalloutMarker(firstLine)
  if (!marker) return null
  return {
    bodyOffset: newlineIndex === -1 ? text.length : newlineIndex + 1,
    marker,
  }
}

export function buildCalloutBlock(block: BlockLike): BlockLike {
  const parsed = readQuoteCallout(block)
  if (!parsed) return block

  const props: CalloutBlockProps = {
    calloutType: parsed.marker.type,
    title: parsed.marker.title,
  }
  const body = dropInlinePrefix(block.content ?? [], parsed.bodyOffset).content
  return {
    ...block,
    content: body,
    props: { ...(block.props ?? {}), ...props },
    type: CALLOUT_BLOCK_TYPE,
  }
}

export function isCalloutBlock(block: BlockLike): boolean {
  return block.type === CALLOUT_BLOCK_TYPE
}

function readCalloutProps(block: BlockLike): CalloutBlockProps {
  const calloutType = block.props?.calloutType
  const title = block.props?.title
  return {
    calloutType: typeof calloutType === 'string' ? normalizedCalloutType(calloutType) : 'note',
    title: typeof title === 'string' ? title : '',
  }
}

function quoteLine(line: string): string {
  return line ? `> ${line}` : '>'
}

function serializeCalloutBody(editor: MarkdownSerializer, block: BlockLike): string {
  if (!Array.isArray(block.content) || block.content.length === 0) return ''
  const markdown = serializeInlineMathAwareBlocks(editor, [{
    content: block.content,
    props: {},
    type: 'paragraph',
  }]).trim()
  const lines = markdown.split('\n')
  return lines.map((line, index) => (
    index < lines.length - 1 && line.endsWith('\\') ? line.slice(0, -1) : line
  )).join('\n')
}

export function serializeCalloutBlock(editor: MarkdownSerializer, block: BlockLike): string {
  const props = readCalloutProps(block)
  const marker = formatCalloutMarker({
    title: props.title,
    type: props.calloutType,
  })
  const body = serializeCalloutBody(editor, block)
  const lines = body ? [marker, ...body.split('\n')] : [marker]
  return lines.map(quoteLine).join('\n')
}

function injectCalloutBlock(block: BlockLike): BlockLike {
  const converted = buildCalloutBlock(block)
  if (!Array.isArray(converted.children)) return converted
  return { ...converted, children: converted.children.map(injectCalloutBlock) }
}

export function injectCalloutBlocks(blocks: unknown[]): unknown[] {
  return (blocks as BlockLike[]).map(injectCalloutBlock)
}

function hasCalloutBlock(block: BlockLike): boolean {
  if (isCalloutBlock(block)) return true
  return Array.isArray(block.children) && block.children.some(hasCalloutBlock)
}

export function hasCalloutBlocks(blocks: unknown[]): boolean {
  return (blocks as BlockLike[]).some(hasCalloutBlock)
}
