import { expect, it, vi } from 'vitest'
import { createGitHubAccountState, type GitHubAccountServices } from './githubAccountState'
import type { GitHubSession } from './githubAuth'

const session: GitHubSession = { accessToken: 'test-only', login: 'tester', userId: 42 }

function services(): GitHubAccountServices {
  return {
    restore: async () => session, save: async () => {}, clear: async () => {},
    begin: async () => ({ device_code: 'device', user_code: 'code', verification_uri: 'https://github.com/login/device', interval: 5, expires_in: 60 }),
    finish: async () => session, refresh: async (value) => value, list: async () => [],
  }
}

it('does not resurrect a session when restoration finishes after sign-out', async () => {
  const deps = services()
  let resolve!: (session: GitHubSession) => void
  deps.restore = () => new Promise((done) => { resolve = done })
  const account = createGitHubAccountState(deps)
  const restore = account.restore()
  await account.signOut()
  resolve(session)
  await restore
  expect(account.snapshot().session).toBeNull()
})

it('ignores authorization that completes after cancellation', async () => {
  const deps = services()
  let resolve!: (session: GitHubSession) => void
  deps.finish = () => new Promise((done) => { resolve = done })
  deps.save = vi.fn()
  const account = createGitHubAccountState(deps)
  const signIn = account.signIn()
  await Promise.resolve()
  account.cancelSignIn()
  resolve(session)
  await signIn
  expect(deps.save).not.toHaveBeenCalled()
  expect(account.snapshot()).toMatchObject({ session: null, code: null, busy: false })
})

it('does not publish repository results after sign-out', async () => {
  const deps = services()
  let resolve!: (repos: []) => void
  deps.list = () => new Promise((done) => { resolve = done })
  const account = createGitHubAccountState(deps)
  await account.restore()
  const listing = account.loadRepositories()
  await Promise.resolve()
  await Promise.resolve()
  await account.signOut()
  resolve([])
  await listing
  expect(account.snapshot()).toMatchObject({ session: null, repositories: [], busy: false })
})
