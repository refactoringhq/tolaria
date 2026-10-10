import { expect, it, vi } from 'vitest'
import { createGitFetchClient, type GitFetch } from './gitFetchClient'

it('preserves binary request bytes and refuses implicit credential-bearing redirects', async () => {
  const fetcher = vi.fn<GitFetch>(async () => new Response(new Uint8Array([0, 255, 2])))
  const client = createGitFetchClient(fetcher)
  async function* body() { yield new Uint8Array([0, 128]); yield new Uint8Array([255]) }
  const response = await client.request({ url: 'https://github.com/team/vault.git/git-receive-pack', method: 'POST', body: body() })
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error', credentials: 'omit', body: new Uint8Array([0, 128, 255]) })
  const chunks: Uint8Array[] = []
  for await (const chunk of response.body ?? []) chunks.push(chunk)
  expect(chunks).toEqual([new Uint8Array([0, 255, 2])])
})

it('aborts the transport when the caller cancels', async () => {
  const abort = new AbortController()
  abort.abort()
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    expect(options?.signal?.aborted).toBe(true)
    throw new Error('cancelled')
  })
  await expect(createGitFetchClient(fetcher).request({ url: 'https://github.com/team/vault.git', signal: abort.signal })).rejects.toThrow('cancelled')
})
