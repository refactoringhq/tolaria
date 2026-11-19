import type { VaultEntry } from '../../../../packages/protocol/src/index.ts'
import { parseDocument } from '../../../../packages/vault-index/src/index.ts'
import { VaultError } from '../errors.ts'
import { readFileAs, searchAs } from '../operations.ts'
import { isNote, type VaultPath, vaultPath } from '../paths.ts'
import { jsonResult, numberArg, stringArg, textResult, type ToolContext, type ToolHandler } from './results.ts'

const DEFAULT_SEARCH_LIMIT = 10
const RECENT_NOTES = 20
/** How far back in history recent notes are looked for. */
const RECENT_COMMITS = 200
const AGENTS_FILE = vaultPath('AGENTS.md')

/** A note path from an argument; anything else is refused before the vault is touched. */
export function notePath(raw: string): VaultPath {
  const path = vaultPath(raw)
  if (!isNote(path)) throw new VaultError(400, 'invalid_path', `${path} is not a note: the path must end in .md`)
  return path
}

/** The notes of the index this access may read, by path. */
function visibleNotes({ services, access }: ToolContext): Map<string, VaultEntry> {
  const notes = services.index.getAll().entries.filter((entry) => entry.fileKind === 'markdown')
  return new Map(access.visible(notes, (entry) => entry.path).map((entry) => [entry.path, entry]))
}

function searchLimit(requested: number | undefined): number {
  return requested !== undefined && Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_SEARCH_LIMIT
}

const searchNotes: ToolHandler = async (args, context) => {
  const limit = searchLimit(numberArg(args, 'limit'))
  const { results } = await searchAs(context.services.search, context.access, stringArg(args, 'query'), limit)
  if (results.length === 0) return textResult('No matching notes found.')
  const notes = visibleNotes(context)
  const hits = results.map(({ path, matches }) => `**${notes.get(path)?.title ?? path}** (${path})\n${matches[0]?.text ?? ''}`)
  return textResult(hits.join('\n\n'))
}

const getNote: ToolHandler = async (args, { services, access }) => {
  const path = notePath(stringArg(args, 'path'))
  const { bytes, etag } = await readFileAs(services.vault, access, path)
  const { frontmatter, body } = parseDocument(bytes.toString('utf8'))
  return jsonResult({ path, frontmatter, content: body.trim(), etag })
}

/** The root AGENTS.md, when it exists and the access may read it. */
async function agentInstructions({ services, access }: ToolContext): Promise<{ path: string; content: string } | null> {
  try {
    const { bytes } = await readFileAs(services.vault, access, AGENTS_FILE)
    return { path: AGENTS_FILE, content: bytes.toString('utf8') }
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return null
    throw error
  }
}

function topFolder(path: string): string | null {
  const slash = path.indexOf('/')
  return slash < 0 ? null : path.slice(0, slash)
}

async function recentNotes(context: ToolContext, notes: Map<string, VaultEntry>): Promise<VaultEntry[]> {
  const paths = await context.services.vault.recentPaths(RECENT_COMMITS)
  const recent = paths.flatMap((path) => notes.get(path) ?? [])
  return recent.slice(0, RECENT_NOTES)
}

function sortedSet(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
}

const getVaultContext: ToolHandler = async (_args, context) => {
  const { name, branch } = await context.services.vault.info()
  const notes = visibleNotes(context)
  const entries = [...notes.values()]
  const recent = await recentNotes(context, notes)
  return jsonResult({
    name,
    branch,
    noteCount: entries.length,
    types: sortedSet(entries.map((entry) => entry.isA)),
    folders: sortedSet(entries.map((entry) => topFolder(entry.path))),
    recentNotes: recent.map((entry) => ({ path: entry.path, title: entry.title, type: entry.isA ?? null })),
    agentInstructions: await agentInstructions(context),
  })
}

const listVaults: ToolHandler = async (_args, context) => {
  const { name, branch } = await context.services.vault.info()
  const instructions = await agentInstructions(context)
  const vault = { name, label: name, branch, hasAgentInstructions: instructions !== null, agentInstructionsPath: instructions?.path ?? null }
  return jsonResult({ vaults: [vault] })
}

export const READ_TOOLS: readonly [string, ToolHandler][] = [
  ['search_notes', searchNotes],
  ['get_vault_context', getVaultContext],
  ['list_vaults', listVaults],
  ['get_note', getNote],
]
