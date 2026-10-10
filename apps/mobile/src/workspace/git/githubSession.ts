import type { GitHubSession } from './githubAuth'

export function parseGitHubSession(serialized: string | null): GitHubSession | null {
  if (serialized === null) return null
  try {
    const value: unknown = JSON.parse(serialized)
    if (!validSession(value)) throw new Error('invalid')
    return value
  } catch {
    throw new Error('githubAuthorizationExpired')
  }
}

function validSession(value: unknown): value is GitHubSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return validToken(session.accessToken) && validIdentity(session)
    && optionalToken(session.refreshToken) && optionalExpiry(session.expiresAt)
}

function validIdentity(session: Record<string, unknown>) {
  return typeof session.login === 'string' && session.login.length > 0
    && typeof session.userId === 'number' && Number.isSafeInteger(session.userId) && session.userId > 0
}

function optionalToken(value: unknown) { return value === undefined || validToken(value) }
function optionalExpiry(value: unknown) { return value === undefined || (typeof value === 'number' && Number.isFinite(value)) }

function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[\r\n]/u.test(value)
}
