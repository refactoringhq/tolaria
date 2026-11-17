import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { AGENT_TOKEN_PREFIX, ACCESS_VAULT_SCOPE, type AccessGrant } from '../../../packages/protocol/src/index.ts'
import { Access } from './access.ts'
import { validGrants } from './accessTickets.ts'
import { type CoAuthor, isCoAuthor } from './coAuthors.ts'

/**
 * Agent tokens (protocol 1.11): long-lived, named credentials with `viewer` or `editor` grants,
 * created and revoked on the box with `pnpm run server:token` and kept in a local JSON file.
 * The file holds only a SHA-256 of each secret: the secret is 256 random bits, so a plain hash
 * is as strong as a slow one. Nothing here ever puts a secret or a hash in an error message.
 */

export interface AgentTokenRecord {
  /** Public: in listings, logs and the subject `token:<id>`. */
  id: string
  name: string
  /** SHA-256 of the secret, base64url. */
  hash: string
  grants: AccessGrant[]
  createdAt: number
  /** Null: never. */
  expiresAt: number | null
  /** Who the token is in git, named as co-author of the commits it causes. */
  author: CoAuthor
}

export interface AgentTokenSpec {
  name: string
  grants: AccessGrant[]
  expiresAt: number | null
  author?: CoAuthor
}

export const TOKEN_FILE_VERSION = 1
export const MAX_AGENT_TOKENS = 100
export const MAX_TOKEN_NAME_LENGTH = 64
const ID_BYTES = 8
const SECRET_BYTES = 32
const ID = /^[A-Za-z0-9_-]{11}$/
const HASH = /^[A-Za-z0-9_-]{43}$/
const CREDENTIAL = /^tat1\.([A-Za-z0-9_-]{11})\.([A-Za-z0-9_-]{43})$/
/** Control characters and angle brackets would break the co-author trailer the name may end up in. */
const UNSAFE_NAME = /[\p{Cc}<>]/u
const AUTHOR_DOMAIN = 'tokens.tolaria.invalid'

/** Thrown for a token or token file that breaks a rule; the message is fit for the operator. */
export class AgentTokenError extends Error {}

export function tokenSubject(id: string): string {
  return `token:${id}`
}

export function isAgentToken(credential: string): boolean {
  return credential.startsWith(AGENT_TOKEN_PREFIX)
}

function hashOf(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value)
}

export function isTokenName(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TOKEN_NAME_LENGTH) return false
  return value.trim() === value && !UNSAFE_NAME.test(value)
}

/** Ticket grants without `owner`: a token never administers the vault. */
function isTokenGrants(value: unknown): value is AccessGrant[] {
  return validGrants(value) && value.every((grant) => grant.role !== 'owner')
}

function isTime(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isTokenRecord(value: unknown): value is AgentTokenRecord {
  if (!isRecord(value)) return false
  const { id, name, hash, grants, createdAt, expiresAt, author } = value
  const shaped = typeof id === 'string' && ID.test(id) && typeof hash === 'string' && HASH.test(hash)
  const timed = isTime(createdAt) && (expiresAt === null || isTime(expiresAt))
  return shaped && timed && isTokenName(name) && isTokenGrants(grants) && isCoAuthor(author)
}

/** The rule a list of tokens breaks, or null: at most 100, ids and names each used once. */
function listProblem(tokens: readonly AgentTokenRecord[]): string | null {
  if (tokens.length > MAX_AGENT_TOKENS) return `at most ${MAX_AGENT_TOKENS} tokens are allowed`
  if (new Set(tokens.map((token) => token.id)).size !== tokens.length) return 'two tokens share an id'
  if (new Set(tokens.map((token) => token.name)).size !== tokens.length) return 'two tokens share a name'
  return null
}

function fileTokens(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) && parsed.version === TOKEN_FILE_VERSION ? parsed.tokens : undefined
  } catch {
    return undefined
  }
}

/** The tokens of a token file. Throws naming `file`, and only the position of a bad token. */
export function parseTokenFile(text: string, file: string): AgentTokenRecord[] {
  const tokens = fileTokens(text)
  if (!Array.isArray(tokens)) throw new AgentTokenError(`${file}: not a version ${TOKEN_FILE_VERSION} token file`)
  const bad = tokens.findIndex((token) => !isTokenRecord(token))
  if (bad >= 0) throw new AgentTokenError(`${file}: token ${bad + 1} is malformed`)
  const problem = listProblem(tokens as AgentTokenRecord[])
  if (problem) throw new AgentTokenError(`${file}: ${problem}`)
  return tokens as AgentTokenRecord[]
}

export function serializeTokens(tokens: readonly AgentTokenRecord[]): string {
  return `${JSON.stringify({ version: TOKEN_FILE_VERSION, tokens }, null, 2)}\n`
}

function checkGrants(grants: AccessGrant[]): void {
  if (grants.some((grant) => grant.role === 'owner')) throw new AgentTokenError('a token’s role is viewer or editor')
  if (!validGrants(grants)) {
    throw new AgentTokenError(`each scope is ${ACCESS_VAULT_SCOPE} or a note path inside the vault`)
  }
}

function checkSpec(spec: AgentTokenSpec, existing: readonly AgentTokenRecord[]): void {
  if (!isTokenName(spec.name)) {
    throw new AgentTokenError(`a token name is 1 to ${MAX_TOKEN_NAME_LENGTH} characters, without < > or surrounding spaces`)
  }
  if (existing.some((token) => token.name === spec.name)) throw new AgentTokenError(`a token named ${spec.name} already exists`)
  if (existing.length >= MAX_AGENT_TOKENS) throw new AgentTokenError(`at most ${MAX_AGENT_TOKENS} tokens are allowed`)
  checkGrants(spec.grants)
  if (spec.author && !isCoAuthor(spec.author)) throw new AgentTokenError('the author needs a name and an email address')
}

/** A new token: the credential to show once, and the record to keep. */
export function mintAgentToken(
  spec: AgentTokenSpec,
  existing: readonly AgentTokenRecord[],
  now: number,
): { credential: string; record: AgentTokenRecord } {
  checkSpec(spec, existing)
  let id = randomBytes(ID_BYTES).toString('base64url')
  while (existing.some((token) => token.id === id)) id = randomBytes(ID_BYTES).toString('base64url')
  const secret = randomBytes(SECRET_BYTES).toString('base64url')
  const author = spec.author ?? { name: spec.name, email: `${id}@${AUTHOR_DOMAIN}` }
  const record: AgentTokenRecord = {
    id,
    name: spec.name,
    hash: hashOf(secret).toString('base64url'),
    grants: spec.grants,
    createdAt: now,
    expiresAt: spec.expiresAt,
    author,
  }
  return { credential: `${AGENT_TOKEN_PREFIX}${id}.${secret}`, record }
}

export function isExpired(token: AgentTokenRecord, now: number): boolean {
  return token.expiresAt !== null && token.expiresAt <= now
}

/** One loaded token file, by id. */
export class AgentTokenSet {
  private readonly byId: Map<string, AgentTokenRecord>

  constructor(tokens: readonly AgentTokenRecord[]) {
    this.byId = new Map(tokens.map((token) => [token.id, token]))
  }

  get size(): number {
    return this.byId.size
  }

  records(): AgentTokenRecord[] {
    return [...this.byId.values()]
  }

  has(id: string): boolean {
    return this.byId.has(id)
  }

  /** The access a credential gives, or null for anything unknown, wrong or expired: all alike. */
  verify(credential: string, now: number): Access | null {
    const [, id, secret] = CREDENTIAL.exec(credential) ?? []
    const token = id === undefined ? undefined : this.byId.get(id)
    if (!token || isExpired(token, now)) return null
    const expected = Buffer.from(token.hash, 'base64url')
    if (!timingSafeEqual(hashOf(secret), expected)) return null
    return new Access(tokenSubject(token.id), token.grants, token.createdAt, token.author)
  }
}
