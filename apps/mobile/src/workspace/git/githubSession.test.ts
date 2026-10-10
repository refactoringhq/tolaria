import { expect, it } from 'vitest'
import { parseGitHubSession } from './githubSession'

it('validates stored credentials without returning damaged or incomplete sessions', () => {
  const session = { accessToken: 'gho_test', login: 'tester', userId: 123, expiresAt: 2000, refreshToken: 'refresh_test' }
  expect(parseGitHubSession(JSON.stringify(session))).toEqual(session)
  expect(parseGitHubSession(null)).toBeNull()
  expect(() => parseGitHubSession('broken')).toThrow('githubAuthorizationExpired')
  expect(() => parseGitHubSession(JSON.stringify({ ...session, accessToken: 'token\r\ninjected' }))).toThrow()
  expect(() => parseGitHubSession(JSON.stringify({ ...session, userId: 0 }))).toThrow()
})
