import { webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createGitDigest, installGitDigest, type GitCryptoHost } from './gitDigest'

describe('native Git digest boundary', () => {
  it('installs a missing digest without replacing existing random APIs', () => {
    const getRandomValues = vi.fn()
    const host: GitCryptoHost & { crypto: { getRandomValues: typeof getRandomValues } } = { crypto: { getRandomValues } }
    const digest = vi.fn()
    installGitDigest(host, digest)
    expect(host.crypto.subtle?.digest).toBe(digest)
    expect(host.crypto.getRandomValues).toBe(getRandomValues)
  })

  it('does not replace an existing WebCrypto digest', () => {
    const original = vi.fn()
    const host = { crypto: { subtle: { digest: original } } }
    installGitDigest(host, vi.fn())
    expect(host.crypto.subtle.digest).toBe(original)
  })

  it('provides the Git SHA-1 known vector when crypto was absent', async () => {
    const host: GitCryptoHost = {}
    installGitDigest(host, createGitDigest((algorithm, bytes) => webcrypto.subtle.digest(algorithm, bytes)))
    const result = await host.crypto?.subtle?.digest?.('SHA-1', new Uint8Array())
    expect(Buffer.from(result!).toString('hex')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
  })

  it('preserves byte offsets and supplies a plain Uint8Array for native conversion', async () => {
    const backend = vi.fn(async (_algorithm, bytes) => webcrypto.subtle.digest('SHA-256', bytes))
    const digest = createGitDigest(backend)
    const source = Buffer.from([99, 0, 255, 128, 33])
    const result = await digest({ name: 'sha-256' }, source.subarray(1, 4))
    const expected = await webcrypto.subtle.digest('SHA-256', new Uint8Array([0, 255, 128]))
    expect(result).toEqual(expected)
    const [algorithm, bytes] = backend.mock.calls[0]
    expect(algorithm).toBe('SHA-256')
    expect(bytes.constructor).toBe(Uint8Array)
    expect([...bytes]).toEqual([0, 255, 128])
  })

  it('accepts ArrayBuffers and rejects unsupported algorithms without calling native code', async () => {
    const backend = vi.fn(async () => new ArrayBuffer(32))
    const digest = createGitDigest(backend)
    await digest('SHA-256', new Uint8Array([1, 2]).buffer)
    await expect(digest('MD5', new Uint8Array())).rejects.toMatchObject({ name: 'NotSupportedError' })
    expect(backend).toHaveBeenCalledTimes(1)
  })
})
