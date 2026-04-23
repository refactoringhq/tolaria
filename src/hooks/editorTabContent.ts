import { splitFrontmatter } from '../utils/wikilinks'

type MarkdownContent = string
type FilePath = string
type Frontmatter = string
type NoteTitle = string
type PathStem = string
type HeadingTextInline = { type?: string; text?: string }

export function extractEditorBody(rawFileContent: MarkdownContent): MarkdownContent {
  const [, rawBody] = splitFrontmatter(rawFileContent)
  return rawBody.trimStart()
}

function extractH1Content(blocks: unknown[]): HeadingTextInline[] | null {
  const first = blocks?.[0] as {
    type?: string
    props?: { level?: number }
    content?: HeadingTextInline[]
  } | undefined

  if (!first) return null
  if (first.type !== 'heading') return null
  if (first.props?.level !== 1) return null
  if (!Array.isArray(first.content)) return null
  return first.content
}

export function getH1TextFromBlocks(blocks: unknown[]): NoteTitle | null {
  const content = extractH1Content(blocks)
  if (!content) return null

  let text = ''
  for (const item of content) {
    if (item.type === 'text') {
      text += item.text || ''
    }
  }

  const trimmed = text.trim()
  return trimmed || null
}

export function replaceTitleInFrontmatter(frontmatter: Frontmatter, newTitle: NoteTitle): Frontmatter {
  return frontmatter.replace(/^(title:\s*).+$/m, `$1${newTitle}`)
}

export function pathStem(path: FilePath): PathStem {
  const filename = path.split('/').pop() ?? path
  return filename.replace(/\.md$/, '')
}

export function slugifyPathStem(title: NoteTitle): PathStem {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function isUntitledPath(path: FilePath): boolean {
  return pathStem(path).startsWith('untitled-')
}
