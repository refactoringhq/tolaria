import { afterEach, expect, it, vi } from 'vitest'
import { beginGitHubSignIn, finishGitHubSignIn, type GitHubDeviceCode } from './githubAuth'

const code: GitHubDeviceCode = {
  device_code: 'device', user_code: 'ABCD-EFGH', verification_uri: 'https://github.com/login/device', interval: 5, expires_in: 900,
}
afterEach(() => vi.useRealTimers())

it('does not start authentication without a configured public client ID', async () => {
  const request = vi.fn<typeof fetch>()
  await expect(beginGitHubSignIn('', request)).rejects.toThrow('githubNotConfigured')
  expect(request).not.toHaveBeenCalled()
})

it('honors pending and slow-down intervals and verifies the signed-in account', async () => {
  vi.useFakeTimers()
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ error: 'authorization_pending' }))
    .mockResolvedValueOnce(Response.json({ error: 'slow_down' }))
    .mockResolvedValueOnce(Response.json({ access_token: 'test-token', expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ id: 123, login: 'example' }))
  const result = finishGitHubSignIn('public-client-id', code, new AbortController().signal, request)
  await vi.advanceTimersByTimeAsync(4999)
  expect(request).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(request).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(5000)
  expect(request).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(9999)
  expect(request).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(1)
  expect(await result).toMatchObject({ accessToken: 'test-token', userId: 123, login: 'example' })
  expect(request.mock.calls[0][1]?.body).not.toContain('client_secret')
})

it('cancels a pending sign-in without another token request', async () => {
  vi.useFakeTimers()
  const request = vi.fn<typeof fetch>()
  const abort = new AbortController()
  const result = finishGitHubSignIn('public-id', code, abort.signal, request)
  const check = expect(result).rejects.toThrow('cancelled')
  abort.abort()
  await check
  await vi.advanceTimersByTimeAsync(60_000)
  expect(request).not.toHaveBeenCalled()
})
