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

/** Extract the paragraph surrounding a [[target]] wikilink match from note content.
 * Searches for any target in the set, returns the first matching paragraph trimmed
 * to a max length. Returns null if no match found. */
export function extractBacklinkContext(
  content: string,
  matchTargets: Set<string>,
  maxLength = 120,
): string | null {
  const [, body] = splitFrontmatter(content)
  // Remove the H1 title line
  const withoutTitle = body.replace(/^\s*# [^\n]+\n?/, '')
  const paragraphs = withoutTitle.split(/\n{2,}/)

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    // Check if this paragraph contains a wikilink matching any target
    const re = /\[\[([^\]]+)\]\]/g
    let match
    while ((match = re.exec(trimmed)) !== null) {
      const inner = match[1]
      const pipeIdx = inner.indexOf('|')
      const target = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner
      if (matchTargets.has(target) || matchTargets.has(target.split('/').pop() ?? '')) {
        // Collapse whitespace and truncate
        const flat = trimmed.replace(/\s+/g, ' ')
        if (flat.length <= maxLength) return flat
        return flat.slice(0, maxLength - 1) + '\u2026'
      }
    }
  }
  return null
}

/** Check if a line is useful for snippet extraction (not blank, heading, code fence, or rule). */
function isSnippetLine(line: string): boolean {
  const t = line.trim()
  return t !== '' && !t.startsWith('#') && !t.startsWith('```') && !t.startsWith('---')
}

/** Remove the first H1 heading line, allowing leading blank lines. */
function removeH1Line(body: string): string {
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('# ')) return lines.slice(i + 1).join('\n')
    if (lines[i].trim() !== '') return body
  }
  return body
}

/** Strip markdown formatting chars: bold, italic, code, strikethrough, and resolve links. */
function stripMarkdownChars(s: string): string {
  let result = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '[' && s[i + 1] === '[') {
      i += 2
      let inner = ''
      while (i < s.length - 1 && !(s[i] === ']' && s[i + 1] === ']')) { inner += s[i]; i++ }
      if (i < s.length - 1) i += 2
      const pipe = inner.indexOf('|')
      result += pipe !== -1 ? inner.slice(pipe + 1) : inner
    } else if (s[i] === '[') {
      i++
      let text = ''
      while (i < s.length && s[i] !== ']') { text += s[i]; i++ }
      if (i < s.length) i++
      if (i < s.length && s[i] === '(') { i++; while (i < s.length && s[i] !== ')') i++; if (i < s.length) i++ }
      result += text
    } else if (s[i] === '*' || s[i] === '_' || s[i] === '`' || s[i] === '~') {
      i++
    } else {
      result += s[i]
      i++
    }
  }
  return result
}

/** Extract a snippet: first ~160 chars of body content, stripped of markdown.
 *  Mirrors the Rust extract_snippet() logic for frontend use. */
export function extractSnippet(content: string): string {
  const [, body] = splitFrontmatter(content)
  const withoutH1 = removeH1Line(body)
  const clean = withoutH1.split('\n').filter(isSnippetLine).join(' ')
  const stripped = stripMarkdownChars(clean)
  if (stripped.length <= 160) return stripped
  return stripped.slice(0, 160) + '...'
}

export function countWords(content: string): number {
  const [, body] = splitFrontmatter(content)
  const withoutTitle = body.replace(/^\s*# [^\n]+\n?/, '')
  const withoutWikilinks = withoutTitle.replace(/\[\[[^\]]*\]\]/g, '')
  const text = withoutWikilinks.replace(/[#*_[\]`>~\-|]/g, '').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}
