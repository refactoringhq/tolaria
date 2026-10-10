export type GitHubSession = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  login: string
  userId: number
}
export type GitHubDeviceCode = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}
type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
}
export type GitHubRepository = { id: number; full_name: string; clone_url: string; private: boolean }

export async function beginGitHubSignIn(clientId: string, request: GitHubRequest = fetch): Promise<GitHubDeviceCode> {
  if (!clientId.trim()) throw new Error('githubNotConfigured')
  const code = await githubForm<GitHubDeviceCode>('device/code', { client_id: clientId, scope: 'repo' }, request)
  validateDeviceCode(code)
  return code
}

function validateDeviceCode(code: GitHubDeviceCode) {
  const values = [code.device_code, code.user_code, code.interval > 0, code.expires_in > 0,
    code.verification_uri === 'https://github.com/login/device']
  if (!values.every(Boolean)) throw new Error('githubAuthorizationFailed')
}

export async function finishGitHubSignIn(
  clientId: string,
  code: GitHubDeviceCode,
  signal: AbortSignal,
  request: GitHubRequest = fetch,
): Promise<GitHubSession> {
  const deadline = Date.now() + code.expires_in * 1000
  let interval = Math.max(5, code.interval) * 1000
  while (Date.now() < deadline) {
    await waitForPoll(interval, signal)
    if (Date.now() >= deadline) break
    const result = await githubForm<TokenResponse>('oauth/access_token', {
      client_id: clientId,
      device_code: code.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }, request, signal)
    if (result.access_token) return identifyGitHubSession(result, request)
    if (result.error === 'slow_down') interval += 5000
    else if (result.error !== 'authorization_pending') throw new Error('githubAuthorizationFailed')
  }
  throw new Error('githubAuthorizationExpired')
}

export async function refreshGitHubSession(session: GitHubSession, clientId: string, request: GitHubRequest = fetch) {
  if (!session.expiresAt || session.expiresAt > Date.now() + 60_000) return session
  if (!session.refreshToken) throw new Error('githubAuthorizationExpired')
  const tokens = await githubForm<TokenResponse>('oauth/access_token', {
    client_id: clientId, grant_type: 'refresh_token', refresh_token: session.refreshToken,
  }, request)
  if (!tokens.access_token) throw new Error('githubAuthorizationExpired')
  return identifyGitHubSession(tokens, request)
}

async function identifyGitHubSession(tokens: TokenResponse, request: GitHubRequest): Promise<GitHubSession> {
  const accessToken = requiredAccessToken(tokens)
  const user = await githubApi<{ id: number; login: string }>('user', accessToken, request)
  validateGitHubIdentity(user)
  return {
    accessToken,
    refreshToken: tokens.refresh_token,
    expiresAt: tokenExpiry(tokens),
    login: user.login,
    userId: user.id,
  }
}

function validateGitHubIdentity(user: { id: number; login: string }) {
  if (!Number.isSafeInteger(user.id) || !user.login) throw new Error('githubAuthorizationFailed')
}

function requiredAccessToken(tokens: TokenResponse) {
  if (!tokens.access_token) throw new Error('githubAuthorizationFailed')
  return tokens.access_token
}

function tokenExpiry(tokens: TokenResponse) {
  return tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined
}

export async function listGitHubRepositories(session: GitHubSession, page = 1, request: GitHubRequest = fetch) {
  return githubApi<GitHubRepository[]>(`user/repos?sort=updated&per_page=100&page=${page}`, session.accessToken, request)
}

function waitForPoll(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('cancelled')); return }
    const cancelled = () => { clearTimeout(timer); reject(new Error('cancelled')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve() }, ms)
    signal.addEventListener('abort', cancelled, { once: true })
  })
}
import { githubApi, githubForm, type GitHubRequest } from './githubRequest'
