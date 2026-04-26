import type { VaultEntry } from '../types'
import { collectLinkedEntries } from './ai-context'
import { splitFrontmatter } from './wikilinks'

const DEFAULT_MAX_LINKED_NOTES = 8
const DEFAULT_MAX_LINKED_BODY_CHARS = 2000

export interface KanbanAgentContextParams {
  /** The kanban card we are running an agent on. */
  entry: VaultEntry
  /** Raw file content of the active note (with frontmatter). */
  noteContent: string
  /** All entries in the vault, used to resolve wikilink targets. */
  allEntries: VaultEntry[]
  /** Async getter that returns the raw file content of a note (with frontmatter). */
  getContent: (path: string) => Promise<string>
  /** Cap the number of linked notes injected. Default 8. */
  maxLinkedNotes?: number
  /** Cap the body length of each linked note (in chars). Default 2000. */
  maxLinkedBodyChars?: number
}

interface ResolvedLinkedNote {
  entry: VaultEntry
  body: string
  truncated: boolean
}

function extractBody(rawContent: string): string {
  const [, body] = splitFrontmatter(rawContent)
  return body.trim()
}

function truncateBody(body: string, max: number): { body: string; truncated: boolean } {
  if (body.length <= max) return { body, truncated: false }
  return { body: body.slice(0, max).trimEnd() + '…', truncated: true }
}

async function resolveLinkedContent(
  entries: VaultEntry[],
  getContent: (path: string) => Promise<string>,
  maxLinkedBodyChars: number,
): Promise<ResolvedLinkedNote[]> {
  const results: ResolvedLinkedNote[] = []
  for (const entry of entries) {
    try {
      const raw = await getContent(entry.path)
      const { body, truncated } = truncateBody(extractBody(raw), maxLinkedBodyChars)
      results.push({ entry, body, truncated })
    } catch {
      // Linked note unreadable (deleted, permission, binary). Skip silently.
    }
  }
  return results
}

function formatLinkedSection(linked: ResolvedLinkedNote[]): string {
  if (linked.length === 0) return ''
  const blocks = linked.map((item) => {
    const header = `### ${item.entry.title || item.entry.filename} (${item.entry.path})`
    const truncatedNotice = item.truncated ? '\n\n_[truncated]_' : ''
    return `${header}\n\n${item.body}${truncatedNotice}`
  })
  return ['', '## Related notes (linked via wikilinks)', '', blocks.join('\n\n')].join('\n')
}

/**
 * Build a textual prompt for an agent (Claude / Codex / Gemini) running on a kanban card.
 *
 * The prompt contains:
 * - The active note's body (the "task description")
 * - The body of each note linked via wikilinks (1-level depth, capped)
 * - Explicit instructions to act on the vault
 *
 * This is the differentiator vs other kanban-agent tools : the agent receives
 * the knowledge graph around the task, not just a flat ticket description.
 */
export async function buildKanbanAgentContext(
  params: KanbanAgentContextParams,
): Promise<string> {
  const {
    entry,
    noteContent,
    allEntries,
    getContent,
    maxLinkedNotes = DEFAULT_MAX_LINKED_NOTES,
    maxLinkedBodyChars = DEFAULT_MAX_LINKED_BODY_CHARS,
  } = params

  const cardBody = extractBody(noteContent)
  const linkedRaw = collectLinkedEntries(entry, allEntries).slice(0, maxLinkedNotes)
  const linked = await resolveLinkedContent(linkedRaw, getContent, maxLinkedBodyChars)

  const sections = [
    `# Task: ${entry.title || entry.filename}`,
    '',
    `Path: \`${entry.path}\` | Type: ${entry.isA ?? 'Note'} | Status: ${entry.status ?? 'backlog'}`,
    '',
    '## Task description',
    '',
    cardBody.length > 0 ? cardBody : '_(empty body)_',
    formatLinkedSection(linked),
    '',
    '## Instructions',
    '',
    '- Read the task description and the related notes for context.',
    '- Take whatever action is needed in the vault to complete this task (edit notes, create new ones, run commands, etc.).',
    '- Be concise in your reasoning. Prefer doing over explaining.',
    '- When done, summarise what you changed in 2-3 bullet points.',
  ]

  return sections.join('\n')
}
