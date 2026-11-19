import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ACCESS_VAULT_SCOPE, type AccessGrant } from '../../../packages/protocol/src/index.ts'
import { AgentTokenError, type AgentTokenRecord, mintAgentToken, parseTokenFile, serializeTokens } from './agentTokens.ts'
import type { CoAuthor } from './coAuthors.ts'

/**
 * What `pnpm run server:token` does to the token file. It works on the file alone, so it needs
 * no running server; a running server picks the change up within about a second.
 */

export interface AddTokenOptions {
  name: string
  role: string
  /** Note paths; none gives the role on the whole vault. */
  notes?: string[]
  /** `<n>m`, `<n>h` or `<n>d`; none never expires. */
  expiresIn?: string
  authorName?: string
  authorEmail?: string
}

/** A token as listings show it: never its secret or its hash. */
export interface TokenSummary {
  id: string
  name: string
  role: string
  scope: string
  createdAt: number
  expiresAt: number | null
}

const UNITS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 }
const DURATION = /^([1-9]\d{0,5})([mhd])$/

export function parseDuration(text: string): number {
  const match = DURATION.exec(text.trim())
  if (!match) throw new AgentTokenError(`${text} is not a duration: use a number followed by m, h or d, such as 30d`)
  return Number(match[1]) * UNITS[match[2]]
}

function readTokens(file: string): AgentTokenRecord[] {
  try {
    return parseTokenFile(readFileSync(file, 'utf8'), file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** Replaces the file in one rename, readable by its owner only. */
function writeTokens(file: string, tokens: readonly AgentTokenRecord[]): void {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
  try {
    writeFileSync(temporary, serializeTokens(tokens), { mode: 0o600, flag: 'wx' })
    renameSync(temporary, file)
  } finally {
    rmSync(temporary, { force: true })
  }
}

function grantsOf(role: string, notes: readonly string[]): AccessGrant[] {
  if (role !== 'viewer' && role !== 'editor') throw new AgentTokenError('a token’s role is viewer or editor')
  if (notes.length === 0) return [{ scope: ACCESS_VAULT_SCOPE, role }]
  return notes.map((scope) => ({ scope, role }))
}

function authorOf({ authorName, authorEmail }: AddTokenOptions): CoAuthor | undefined {
  if (authorName === undefined && authorEmail === undefined) return undefined
  if (authorName === undefined || authorEmail === undefined) {
    throw new AgentTokenError('--author-name and --author-email go together')
  }
  return { name: authorName, email: authorEmail }
}

function summary(token: AgentTokenRecord): TokenSummary {
  const notes = token.grants.filter((grant) => grant.scope !== ACCESS_VAULT_SCOPE).length
  const scope = notes === 0 ? 'whole vault' : `${notes} note${notes === 1 ? '' : 's'}`
  const { id, name, createdAt, expiresAt } = token
  return { id, name, role: token.grants[0].role, scope, createdAt, expiresAt }
}

/** Adds a token. The credential is returned here and nowhere else: only its hash is kept. */
export function addAgentToken(file: string, options: AddTokenOptions, now = Date.now()): { credential: string; token: TokenSummary } {
  const tokens = readTokens(file)
  const expiresAt = options.expiresIn === undefined ? null : now + parseDuration(options.expiresIn)
  const spec = { name: options.name, grants: grantsOf(options.role, options.notes ?? []), expiresAt, author: authorOf(options) }
  const { credential, record } = mintAgentToken(spec, tokens, now)
  writeTokens(file, [...tokens, record])
  return { credential, token: summary(record) }
}

export function listAgentTokens(file: string): TokenSummary[] {
  return readTokens(file).map(summary)
}

/** Removes the token with this name or id. */
export function revokeAgentToken(file: string, nameOrId: string): TokenSummary {
  const kept = readTokens(file)
  // Names and ids are public, so how fast they compare tells nothing.
  const index = kept.findIndex(({ name, id }) => [name, id].includes(nameOrId))
  if (index < 0) throw new AgentTokenError(`no token is named ${nameOrId} or has that id`)
  const [removed] = kept.splice(index, 1)
  writeTokens(file, kept)
  return summary(removed)
}

function day(time: number | null): string {
  return time === null ? 'never' : new Date(time).toISOString().slice(0, 16).replace('T', ' ')
}

/** The listing as a plain table. */
export function formatTokenList(tokens: readonly TokenSummary[]): string {
  if (tokens.length === 0) return 'No tokens.'
  const rows = [['ID', 'NAME', 'ROLE', 'SCOPE', 'CREATED', 'EXPIRES']]
  for (const token of tokens) rows.push([token.id, token.name, token.role, token.scope, day(token.createdAt), day(token.expiresAt)])
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n')
}
