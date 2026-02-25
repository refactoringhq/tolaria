// Wikilink placeholder tokens for markdown round-trip
const WL_START = '\u2039WIKILINK:'
const WL_END = '\u203A'
const WL_RE = new RegExp(`${WL_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^${WL_END}]+)${WL_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')

/** Pre-process markdown: replace [[target]] with placeholder tokens */
export function preProcessWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_m, target) => `${WL_START}${target}${WL_END}`)
}

// Minimal shape of a BlockNote block for wikilink processing
interface BlockLike {
  content?: InlineItem[]
  children?: BlockLike[]
  [key: string]: unknown
}

interface InlineItem {
  type: string
  text?: string
  props?: Record<string, string>
  content?: unknown
  [key: string]: unknown
}

type ContentTransform = (content: InlineItem[]) => InlineItem[]

/** Walk blocks recursively, applying a transform to each block's inline content */
function walkBlocks(blocks: unknown[], transform: ContentTransform, clone = false): unknown[] {
  return (blocks as BlockLike[]).map(block => {
    const b = clone ? { ...block } : block
    if (b.content && Array.isArray(b.content)) {
      b.content = transform(b.content)
    }
    if (b.children && Array.isArray(b.children)) {
      b.children = walkBlocks(b.children, transform, clone) as BlockLike[]
    }
    return b
  })
}

/** Walk blocks and replace placeholder text with wikilink inline content */
export function injectWikilinks(blocks: unknown[]): unknown[] {
  return walkBlocks(blocks, expandWikilinksInContent)
}

/**
 * Deep-clone blocks and convert wikilink inline content back to [[target]] text.
 * This is the reverse of injectWikilinks — used before blocksToMarkdownLossy
 * so that wikilinks survive the markdown round-trip.
 */
export function restoreWikilinksInBlocks(blocks: unknown[]): unknown[] {
  return walkBlocks(blocks, collapseWikilinksInContent, true)
}

function expandWikilinksInContent(content: InlineItem[]): InlineItem[] {
  const result: InlineItem[] = []
  for (const item of content) {
    if (item.type !== 'text' || typeof item.text !== 'string' || !item.text.includes(WL_START)) {
      result.push(item)
      continue
    }
    const text = item.text as string
    let lastIndex = 0
    WL_RE.lastIndex = 0
    let match
    while ((match = WL_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ ...item, text: text.slice(lastIndex, match.index) })
      }
      result.push({
        type: 'wikilink',
        props: { target: match[1] },
        content: undefined,
      })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ ...item, text: text.slice(lastIndex) })
    }
  }
  return result
}

function collapseWikilinksInContent(content: InlineItem[]): InlineItem[] {
  const result: InlineItem[] = []
  for (const item of content) {
    if (item.type === 'wikilink' && item.props?.target) {
      result.push({ type: 'text', text: `[[${item.props.target}]]` })
    } else {
      result.push(item)
    }
  }
  return result
}

/** Strip YAML frontmatter from markdown, returning [frontmatter, body] */
export function splitFrontmatter(content: string): [string, string] {
  if (!content.startsWith('---')) return ['', content]
  const end = content.indexOf('\n---', 3)
  if (end === -1) return ['', content]
  let to = end + 4
  if (content[to] === '\n') to++
  return [content.slice(0, to), content.slice(to)]
}

/** Extract all outgoing wikilink targets from content.
 * Finds [[target]] and [[target|display]] patterns, returning just the target part.
 * Returns a sorted, deduplicated array. */
export function extractOutgoingLinks(content: string): string[] {
  const links: string[] = []
  const re = /\[\[([^\]]+)\]\]/g
  let match
  while ((match = re.exec(content)) !== null) {
    const inner = match[1]
    const pipeIdx = inner.indexOf('|')
    const target = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner
    if (target) links.push(target)
  }
  return [...new Set(links)].sort()
}

export function countWords(content: string): number {
  const [, body] = splitFrontmatter(content)
  const withoutTitle = body.replace(/^\s*# [^\n]+\n?/, '')
  const withoutWikilinks = withoutTitle.replace(/\[\[[^\]]*\]\]/g, '')
  const text = withoutWikilinks.replace(/[#*_[\]`>~\-|]/g, '').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}
