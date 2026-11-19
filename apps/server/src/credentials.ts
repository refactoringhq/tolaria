import { Access } from './access.ts'
import { accessTicketKey, isAccessTicket, readAccessTicket } from './accessTickets.ts'
import type { AgentTokens } from './agentTokenFile.ts'
import { isAgentToken } from './agentTokens.ts'
import type { Revocations } from './accessRevocations.ts'
import { isAuthorized } from './httpIo.ts'
import { ACCOUNT } from './rateLimit.ts'

/** Who a request is, for the rate limits, and what it may do. */
export interface Credential {
  /** The rate limit and connection bucket: the token's account, or one per ticket subject. */
  account: string
  access: Access
}

const BEARER = /^Bearer (\S+)$/

export function subjectAccount(subject: string): string {
  return `subject:${subject}`
}

export interface CredentialSources {
  /** Agent tokens from the token file; none accepted without. */
  tokens?: AgentTokens
  now?: () => number
}

/**
 * Reads the bearer credential of a request: the server token, an access ticket signed with it,
 * or an agent token from the token file.
 */
export class Credentials {
  private readonly token: string
  private readonly key: Buffer
  private readonly revocations: Revocations
  private readonly tokens: AgentTokens | undefined
  private readonly now: () => number

  constructor(token: string, revocations: Revocations, { tokens, now = Date.now }: CredentialSources = {}) {
    this.token = token
    this.key = accessTicketKey(token)
    this.revocations = revocations
    this.tokens = tokens
    this.now = now
  }

  /** Null for a missing, wrong, expired or revoked credential. */
  of(authorization: string | undefined): Credential | null {
    if (isAuthorized(authorization, this.token)) return { account: ACCOUNT, access: Access.OWNER }
    const credential = BEARER.exec(authorization ?? '')?.[1] ?? ''
    const access = this.accessOf(credential)
    if (!access?.subject) return null
    return { account: subjectAccount(access.subject), access }
  }

  private accessOf(credential: string): Access | null {
    if (isAgentToken(credential)) return this.tokens?.of(credential) ?? null
    if (!isAccessTicket(credential)) return null
    const access = readAccessTicket(credential, this.key, this.now())
    return access && !this.revocations.refuses(access) ? access : null
  }
}
