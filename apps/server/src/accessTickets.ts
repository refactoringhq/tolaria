import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  ACCESS_ROLES,
  ACCESS_TICKET_KEY_LABEL,
  ACCESS_TICKET_MAX_GRANTS,
  ACCESS_TICKET_MAX_LENGTH,
  ACCESS_TICKET_MAX_LIFETIME_MS,
  ACCESS_TICKET_PREFIX,
  ACCESS_TICKET_VERSION,
  ACCESS_VAULT_SCOPE,
  type AccessGrant,
  type AccessTicketPayload,
} from '../../../packages/protocol/src/index.ts'
import { Access } from './access.ts'
import { type CoAuthor, isCoAuthor } from './coAuthors.ts'
import { vaultPath } from './paths.ts'

/**
 * Access tickets (protocol 1.9): `ta1.<payload>.<signature>`, both base64url. The signature is
 * HMAC-SHA256 over `ta1.<payload>` with a key derived from the server token, so whoever holds
 * the token (the owner, or the front end acting for users) can mint them and nobody else can.
 */

/** A minting clock slightly ahead of the server's is tolerated by this much. */
const CLOCK_SKEW_MS = 60_000
const MAX_SUBJECT_LENGTH = 200

export function accessTicketKey(token: string): Buffer {
  return createHmac('sha256', token).update(ACCESS_TICKET_KEY_LABEL).digest()
}

function signature(key: Buffer, signed: string): Buffer {
  return createHmac('sha256', key).update(signed).digest()
}

/** Mints a ticket. The server only verifies them; tests and self-hosted front ends sign. */
export function signAccessTicket(payload: AccessTicketPayload, key: Buffer): string {
  const signed = `${ACCESS_TICKET_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
  return `${signed}.${signature(key, signed).toString('base64url')}`
}

export function isAccessTicket(credential: string): boolean {
  return credential.startsWith(ACCESS_TICKET_PREFIX)
}

function signedPart(ticket: string, key: Buffer): string | null {
  if (ticket.length > ACCESS_TICKET_MAX_LENGTH || !isAccessTicket(ticket)) return null
  const dot = ticket.lastIndexOf('.')
  const signed = ticket.slice(0, dot)
  const given = Buffer.from(ticket.slice(dot + 1), 'base64url')
  const expected = signature(key, signed)
  return given.length === expected.length && timingSafeEqual(given, expected) ? signed : null
}

function decoded(signed: string): unknown {
  try {
    return JSON.parse(Buffer.from(signed.slice(ACCESS_TICKET_PREFIX.length), 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value)
}

function isPathScope(scope: string): boolean {
  try {
    vaultPath(scope)
    return true
  } catch {
    return false
  }
}

function validGrant(value: unknown): value is AccessGrant {
  if (!isRecord(value) || typeof value.scope !== 'string') return false
  if (value.scope === ACCESS_VAULT_SCOPE) return ACCESS_ROLES.includes(value.role as AccessGrant['role'])
  return (value.role === 'viewer' || value.role === 'editor') && isPathScope(value.scope)
}

export function validGrants(value: unknown): value is AccessGrant[] {
  return Array.isArray(value) && value.length > 0 && value.length <= ACCESS_TICKET_MAX_GRANTS && value.every(validGrant)
}

function validSubject(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SUBJECT_LENGTH
}

function validTimes(iat: unknown, exp: unknown, now: number): boolean {
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)) return false
  const [issued, expires] = [iat as number, exp as number]
  return issued <= now + CLOCK_SKEW_MS && expires > now && expires - issued <= ACCESS_TICKET_MAX_LIFETIME_MS
}

/** The optional author (since 1.10): null when absent, undefined when malformed, which spoils the ticket. */
function authorOf(value: unknown): CoAuthor | null | undefined {
  if (value === undefined) return null
  return isCoAuthor(value) ? value : undefined
}

/** The access a ticket gives, or null when it is not authentic, not current or not well-formed. */
export function readAccessTicket(ticket: string, key: Buffer, now: number): Access | null {
  const signed = signedPart(ticket, key)
  const payload = signed === null ? null : decoded(signed)
  if (!isRecord(payload) || payload.v !== ACCESS_TICKET_VERSION) return null
  const { sub, grants, iat, exp } = payload
  if (!validSubject(sub) || !validGrants(grants) || !validTimes(iat, exp, now)) return null
  const author = authorOf(payload.author)
  if (author === undefined) return null
  return new Access(sub, grants, iat as number, author)
}

/** Grants from a request body, validated like a ticket's. */
export function grantsFrom(value: unknown): AccessGrant[] | null {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return []
  return validGrants(value) ? value : null
}
