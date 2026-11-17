import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isLoopbackHost, loadConfig } from '../src/config.ts'

const TOKEN = 'test-token-0123456789'

describe('loadConfig', () => {
  it('refuses to start without a token', () => {
    expect(() => loadConfig({})).toThrowError(/TOLARIA_SERVER_TOKEN is required/)
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: '   ' })).toThrowError(/TOLARIA_SERVER_TOKEN is required/)
  })

  it('refuses a token that is too short to be a secret', () => {
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: 'short' })).toThrowError(/at least 16 characters/)
  })

  it('binds to loopback on the default port', () => {
    const config = loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN })
    expect(config).toMatchObject({ token: TOKEN, host: '127.0.0.1', port: 8787, maxBodyBytes: 25 * 1024 * 1024 })
    expect(config.remoteUrl).toBeUndefined()
    expect(config.vaultDir).toBe(resolve('data', 'vault'))
    expect(config.stateDir).toBe(resolve('data', 'state'))
  })

  it('reads the vault remote, branch, data directory, port and body limit', () => {
    const config = loadConfig({
      TOLARIA_SERVER_TOKEN: TOKEN,
      TOLARIA_SERVER_PORT: '9000',
      TOLARIA_SERVER_DATA_DIR: '/srv/tolaria',
      TOLARIA_VAULT_REMOTE_URL: ' git@github.com:someone/vault.git ',
      TOLARIA_VAULT_BRANCH: 'main',
      TOLARIA_SERVER_MAX_BODY_BYTES: '1024',
    })
    expect(config).toMatchObject({
      port: 9000,
      remoteUrl: 'git@github.com:someone/vault.git',
      branch: 'main',
      vaultDir: '/srv/tolaria/vault',
      stateDir: '/srv/tolaria/state',
      maxBodyBytes: 1024,
    })
  })

  it('keeps agent tokens in the data directory unless told otherwise, and refuses a token file inside the vault', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).tokensFile).toBe(resolve('data', 'tokens.json'))
    const moved = loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_SERVER_TOKENS_FILE: '/etc/tolaria/tokens.json' })
    expect(moved.tokensFile).toBe('/etc/tolaria/tokens.json')
    expect(() =>
      loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_SERVER_DATA_DIR: '/srv/t', TOLARIA_SERVER_TOKENS_FILE: '/srv/t/vault/../vault/tokens.json' }),
    ).toThrowError(/inside the vault/)
  })

  it.each(['abc', '0', '-1', '80.5', '70000'])('rejects the port %j', (port) => {
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_SERVER_PORT: port })).toThrowError(
      /TOLARIA_SERVER_PORT must be an integer/,
    )
  })

  it('refuses a non-loopback address unless explicitly allowed', () => {
    const env = { TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_SERVER_HOST: '0.0.0.0' }
    expect(() => loadConfig(env)).toThrowError(/refusing to bind 0.0.0.0/)
    expect(loadConfig({ ...env, TOLARIA_SERVER_ALLOW_NON_LOOPBACK: '1' }).host).toBe('0.0.0.0')
  })
})

describe('background fetch (TOL-234)', () => {
  const fetchEvery = (value?: string) =>
    loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_VAULT_FETCH_INTERVAL_MS: value }).fetchIntervalMs

  it('leaves the vault default unless set, and switches it off with 0', () => {
    expect(fetchEvery()).toBeUndefined()
    expect(fetchEvery('5000')).toBe(5000)
    expect(fetchEvery('0')).toBe(0)
  })

  it.each(['abc', '-1', '2.5'])('rejects the interval %j', (value) => {
    expect(() => fetchEvery(value)).toThrowError(/TOLARIA_VAULT_FETCH_INTERVAL_MS must be an integer/)
  })
})

describe('private R2 endpoints (TOL-207)', () => {
  it('are refused by default and allowed by the development flag in development', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).allowPrivateR2Endpoint).toBe(false)
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT: '0' }).allowPrivateR2Endpoint).toBe(false)
    const flagged = { TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT: '1', NODE_ENV: 'development' }
    expect(loadConfig(flagged).allowPrivateR2Endpoint).toBe(true)
  })

  it.each([undefined, 'production', 'test', 'staging'])('refuses the development flag when NODE_ENV is %s', (nodeEnv) => {
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT: '1', NODE_ENV: nodeEnv })).toThrowError(
      'TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT is for development only: it also needs NODE_ENV=development',
    )
  })
})

describe('isLoopbackHost', () => {
  it.each(['127.0.0.1', '127.1.2.3', 'localhost', 'LOCALHOST', '::1'])('accepts %s', (host) => {
    expect(isLoopbackHost(host)).toBe(true)
  })

  it.each(['0.0.0.0', '192.168.1.10', '::', '127.evil.example', 'example.com'])('rejects %s', (host) => {
    expect(isLoopbackHost(host)).toBe(false)
  })
})

describe('collaboration settings', () => {
  it('serves the channel by default, flushing after 5 s of quiet or 60 s of typing', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).collab).toEqual({
      policy: { idleMs: 5_000, maxWaitMs: 60_000 },
      lingerMs: 30_000,
      limits: { perAccount: 128, perDoc: 32, idleTimeoutMs: 60_000 },
    })
  })

  it('reads the cadence from the environment', () => {
    const config = loadConfig({
      TOLARIA_SERVER_TOKEN: TOKEN,
      TOLARIA_COLLAB_IDLE_MS: '2000',
      TOLARIA_COLLAB_MAX_WAIT_MS: '30000',
      TOLARIA_COLLAB_LINGER_MS: '1000',
    })

    expect(config.collab).toMatchObject({ policy: { idleMs: 2_000, maxWaitMs: 30_000 }, lingerMs: 1_000 })
  })

  it('switches the channel off with TOLARIA_COLLAB=0 and refuses a cadence that is no number', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_COLLAB: '0' }).collab).toBeNull()
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_COLLAB_IDLE_MS: 'soon' })).toThrowError(/TOLARIA_COLLAB_IDLE_MS/)
  })
})

describe('blob store settings', () => {
  it('defaults to local disk store', () => {
    const config = loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN })
    expect(config.blobStore).toEqual({ type: 'local', stateDir: resolve('data', 'state') })
  })

  it('configures R2 store when TOLARIA_BLOBSTORE=r2', () => {
    const config = loadConfig({
      TOLARIA_SERVER_TOKEN: TOKEN,
      TOLARIA_BLOBSTORE: 'r2',
      TOLARIA_R2_BUCKET: 'test-bucket',
      TOLARIA_R2_ENDPOINT: 'https://r2.example.com',
      TOLARIA_R2_REGION: 'auto',
      TOLARIA_R2_ACCESS_KEY_ID: 'key-id',
      TOLARIA_R2_SECRET_ACCESS_KEY: 'secret-key',
    })

    expect(config.blobStore).toEqual({
      type: 'r2',
      config: {
        bucket: 'test-bucket',
        endpoint: 'https://r2.example.com',
        region: 'auto',
        accessKeyId: 'key-id',
        secretAccessKey: 'secret-key',
      },
    })
  })

  it('requires all R2 environment variables when TOLARIA_BLOBSTORE=r2', () => {
    const base = { TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_BLOBSTORE: 'r2' }
    expect(() => loadConfig(base)).toThrowError(/TOLARIA_R2_BUCKET is required/)

    expect(() => loadConfig({ ...base, TOLARIA_R2_BUCKET: 'bucket' })).toThrowError(/TOLARIA_R2_ENDPOINT is required/)

    expect(() =>
      loadConfig({
        ...base,
        TOLARIA_R2_BUCKET: 'bucket',
        TOLARIA_R2_ENDPOINT: 'https://r2.example.com',
      }),
    ).toThrowError(/TOLARIA_R2_REGION is required/)

    expect(() =>
      loadConfig({
        ...base,
        TOLARIA_R2_BUCKET: 'bucket',
        TOLARIA_R2_ENDPOINT: 'https://r2.example.com',
        TOLARIA_R2_REGION: 'auto',
      }),
    ).toThrowError(/TOLARIA_R2_ACCESS_KEY_ID is required/)

    expect(() =>
      loadConfig({
        ...base,
        TOLARIA_R2_BUCKET: 'bucket',
        TOLARIA_R2_ENDPOINT: 'https://r2.example.com',
        TOLARIA_R2_REGION: 'auto',
        TOLARIA_R2_ACCESS_KEY_ID: 'key',
      }),
    ).toThrowError(/TOLARIA_R2_SECRET_ACCESS_KEY is required/)
  })

  it('rejects invalid TOLARIA_BLOBSTORE values', () => {
    expect(() =>
      loadConfig({
        TOLARIA_SERVER_TOKEN: TOKEN,
        TOLARIA_BLOBSTORE: 'invalid',
      }),
    ).toThrowError(/invalid TOLARIA_BLOBSTORE value: invalid/)
  })

  it('validates R2 endpoint URL format', () => {
    const base = {
      TOLARIA_SERVER_TOKEN: TOKEN,
      TOLARIA_BLOBSTORE: 'r2',
      TOLARIA_R2_BUCKET: 'test',
      TOLARIA_R2_REGION: 'auto',
      TOLARIA_R2_ACCESS_KEY_ID: 'key',
      TOLARIA_R2_SECRET_ACCESS_KEY: 'secret',
    }
    expect(() => loadConfig({ ...base, TOLARIA_R2_ENDPOINT: 'not-a-url' })).toThrowError(/TOLARIA_R2_ENDPOINT must be a valid URL/)
    expect(() => loadConfig({ ...base, TOLARIA_R2_ENDPOINT: 'ftp://invalid.com' })).toThrowError(/TOLARIA_R2_ENDPOINT must be an HTTP or HTTPS URL/)
  })

  it('never logs credentials', () => {
    const messages: string[] = []
    const originalWrite = process.stderr.write
    process.stderr.write = ((msg: string) => {
      messages.push(msg)
      return true
    }) as typeof process.stderr.write

    try {
      loadConfig({
        TOLARIA_SERVER_TOKEN: TOKEN,
        TOLARIA_BLOBSTORE: 'r2',
        TOLARIA_R2_BUCKET: 'bucket',
        TOLARIA_R2_ENDPOINT: 'ftp://bad',
        TOLARIA_R2_REGION: 'auto',
        TOLARIA_R2_ACCESS_KEY_ID: 'secret-key-id',
        TOLARIA_R2_SECRET_ACCESS_KEY: 'super-secret',
      })
    } catch {
      // expected
    } finally {
      process.stderr.write = originalWrite
    }

    const output = messages.join('')
    expect(output).not.toContain('secret-key-id')
    expect(output).not.toContain('super-secret')
    expect(output).not.toContain(TOKEN)
  })
})

describe('index snapshot settings', () => {
  const R2 = {
    TOLARIA_SERVER_TOKEN: TOKEN,
    TOLARIA_R2_BUCKET: 'tolaria-proto',
    TOLARIA_R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    TOLARIA_R2_REGION: 'auto',
    TOLARIA_R2_ACCESS_KEY_ID: 'key-id',
    TOLARIA_R2_SECRET_ACCESS_KEY: 'secret',
  }

  it('keeps indexes on the server disk only by default', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).indexSnapshots).toBeNull()
  })

  it('snapshots indexes to R2 under the prefix, while the blob store stays local', () => {
    const config = loadConfig({ ...R2, TOLARIA_INDEX_SNAPSHOTS: 'r2', TOLARIA_INDEX_SNAPSHOT_PREFIX: 'vaults/prototype' })
    expect(config.blobStore.type).toBe('local')
    expect(config.indexSnapshots).toEqual({
      prefix: 'vaults/prototype',
      r2: { bucket: 'tolaria-proto', endpoint: 'https://account.r2.cloudflarestorage.com', region: 'auto', accessKeyId: 'key-id', secretAccessKey: 'secret' },
    })
  })

  it('refuses an unknown kind, a missing or unsafe prefix, and missing R2 settings', () => {
    expect(() => loadConfig({ ...R2, TOLARIA_INDEX_SNAPSHOTS: 's3' })).toThrowError(/invalid TOLARIA_INDEX_SNAPSHOTS value: s3/)
    expect(() => loadConfig({ ...R2, TOLARIA_INDEX_SNAPSHOTS: 'r2' })).toThrowError(/TOLARIA_INDEX_SNAPSHOT_PREFIX is required/)
    for (const prefix of ['../other', 'vaults//x', '/vaults', 'vaults/x?y']) {
      expect(() => loadConfig({ ...R2, TOLARIA_INDEX_SNAPSHOTS: 'r2', TOLARIA_INDEX_SNAPSHOT_PREFIX: prefix })).toThrowError(
        /TOLARIA_INDEX_SNAPSHOT_PREFIX must be/,
      )
    }
    expect(() =>
      loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_INDEX_SNAPSHOTS: 'r2', TOLARIA_INDEX_SNAPSHOT_PREFIX: 'v' }),
    ).toThrowError('TOLARIA_R2_BUCKET is required when TOLARIA_INDEX_SNAPSHOTS=r2')
  })
})

describe('limit settings', () => {
  it('allows 50 requests a second with bursts of 500 by default', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).rateLimit).toEqual({ perSecond: 50, burst: 500 })
  })

  it('reads the request and websocket limits from the environment', () => {
    const config = loadConfig({
      TOLARIA_SERVER_TOKEN: TOKEN,
      TOLARIA_RATE_LIMIT_PER_SECOND: '5',
      TOLARIA_RATE_LIMIT_BURST: '10',
      TOLARIA_COLLAB_MAX_CONNECTIONS: '8',
      TOLARIA_COLLAB_MAX_CONNECTIONS_PER_DOC: '2',
      TOLARIA_COLLAB_SOCKET_IDLE_TIMEOUT_MS: '1000',
      TOLARIA_COLLAB_MAX_MESSAGE_BYTES: '4096',
    })

    expect(config.rateLimit).toEqual({ perSecond: 5, burst: 10 })
    expect(config.collab).toMatchObject({ limits: { perAccount: 8, perDoc: 2, idleTimeoutMs: 1_000 }, maxMessageBytes: 4096 })
  })

  it.each([
    ['TOLARIA_RATE_LIMIT_PER_SECOND', '0'],
    ['TOLARIA_RATE_LIMIT_BURST', 'lots'],
    ['TOLARIA_COLLAB_MAX_CONNECTIONS_PER_DOC', '-1'],
    ['TOLARIA_COLLAB_MAX_MESSAGE_BYTES', String(16 * 1024 * 1024 + 1)],
  ])('refuses %s=%s', (name, value) => {
    expect(() => loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, [name]: value })).toThrowError(`${name} must be an integer`)
  })
})

describe('the MCP endpoint setting', () => {
  it('serves /mcp unless TOLARIA_MCP=0', () => {
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN }).mcp).toBe(true)
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_MCP: '1' }).mcp).toBe(true)
    expect(loadConfig({ TOLARIA_SERVER_TOKEN: TOKEN, TOLARIA_MCP: '0' }).mcp).toBe(false)
  })
})
