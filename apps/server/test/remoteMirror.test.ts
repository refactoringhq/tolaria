import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { git } from '../src/git.ts'
import type { VaultPath } from '../src/paths.ts'
import type { VaultEvent } from '../src/remoteMirror.ts'
import type { Vault, VaultOptions } from '../src/vault.ts'
import { createFixture, type Fixture, text } from './helpers.ts'

// Saves with a git remote that is slow, hangs or is gone (TOL-424): the save is acknowledged
// once it is committed in the server's clone, and the commit reaches the remote afterwards.

const NOTE = 'welcome.md' as VaultPath
/** Every save must come back well before a remote round trip of this length. */
const REMOTE_DELAY_S = 2
const FAST_SAVE_MS = 1000
const MISSING_REMOTE = '/nonexistent/tolaria-remote.git'

let fixture: Fixture
let vault: Vault
let events: VaultEvent[]

/** A vault that pushes in the background, quickly enough for a test. */
async function openVault(options: Partial<VaultOptions> = {}): Promise<Vault> {
  events = []
  vault = await fixture.openVault({
    pushDebounceMs: 50,
    maxPushRetryMs: 200,
    fetchIntervalMs: 0,
    onVaultEvent: (event) => events.push(event),
    ...options,
  })
  return vault
}

/** Makes every fetch and push of the server's clone take `REMOTE_DELAY_S` longer. */
async function slowRemote(): Promise<void> {
  await git(fixture.vaultDir, ['config', 'remote.upstream.uploadpack', `sleep ${REMOTE_DELAY_S}; git-upload-pack`])
  await git(fixture.vaultDir, ['config', 'remote.upstream.receivepack', `sleep ${REMOTE_DELAY_S}; git-receive-pack`])
}

async function setRemoteUrl(url: string): Promise<void> {
  await git(fixture.vaultDir, ['remote', 'set-url', 'upstream', url])
}

/** The note's content on the remote's main branch, or null when it is not there. */
async function onRemote(path: string): Promise<string | null> {
  const result = await git(fixture.remote, ['show', `main:${path}`], { okCodes: [128] })
  return result.code === 0 ? result.stdout : null
}

async function eventually(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

async function etagOf(path: VaultPath): Promise<string> {
  return (await vault.read(path)).etag
}

async function timedSave(content: string): Promise<number> {
  const started = performance.now()
  await vault.write(NOTE, text(content), { kind: 'match', etag: await etagOf(NOTE) })
  return performance.now() - started
}

beforeEach(async () => {
  fixture = await createFixture()
})

afterEach(async () => {
  await vault.flushAndPush()
  await vault.idle()
  await fixture.cleanup()
})

describe('saves with a background git remote', () => {
  it('acknowledges a save without contacting a slow remote, then pushes it', async () => {
    await openVault()
    await slowRemote()

    expect(await timedSave('# Welcome\n\nEdited on the web.\n')).toBeLessThan(FAST_SAVE_MS)

    await eventually(async () => events.some((event) => event.type === 'push-success'))
    expect(events.map((event) => event.type)).toEqual(['commit', 'push-success'])
    expect(await onRemote(NOTE)).toBe('# Welcome\n\nEdited on the web.\n')
  })

  it('does not hold a save behind a push that is still talking to the remote', async () => {
    await openVault()
    await timedSave('# Welcome\n\nFirst.\n')
    await slowRemote()
    const pushing = vault.syncNow()
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(await timedSave('# Welcome\n\nSecond, while the push runs.\n')).toBeLessThan(FAST_SAVE_MS)

    await pushing
    await eventually(async () => (await onRemote(NOTE)) === '# Welcome\n\nSecond, while the push runs.\n')
  })

  it('keeps saving while the remote is unreachable and retries the push until it lands', async () => {
    await openVault()
    await setRemoteUrl(MISSING_REMOTE)

    const result = await vault.write(NOTE, text('# Welcome\n\nOffline edit.\n'), { kind: 'match', etag: await etagOf(NOTE) })
    expect(result).toMatchObject({ outcome: 'updated', pushed: false })
    await eventually(async () => events.some((event) => event.type === 'push-failed'))

    // No further save: the retry alone brings the commit to the remote once it is back.
    await setRemoteUrl(fixture.remote)
    await eventually(async () => (await onRemote(NOTE)) === '# Welcome\n\nOffline edit.\n')
  })

  it('pushes within the longest delay even while saves keep resetting the debounce', async () => {
    await openVault({ pushDebounceMs: 300, maxPushDelayMs: 400 })
    let etag = await etagOf(NOTE)
    let pushedWhileSaving = false
    const until = Date.now() + 1500
    for (let save = 0; Date.now() < until && !pushedWhileSaving; save++) {
      etag = (await vault.write(NOTE, text(`# Welcome\n\nsave ${save}\n`), { kind: 'match', etag })).etag
      pushedWhileSaving = (await onRemote(NOTE))?.includes('save ') ?? false
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(pushedWhileSaving).toBe(true)
  })

  it('keeps both of two overlapping saves of the same revision', async () => {
    await openVault()
    const base = await etagOf(NOTE)
    const [first, second] = await Promise.all([
      vault.write(NOTE, text('# Welcome\n\nFrom the phone.\n'), { kind: 'match', etag: base }),
      vault.write(NOTE, text('# Welcome\n\nFrom the laptop.\n'), { kind: 'match', etag: base }),
    ])

    expect(first).toMatchObject({ outcome: 'updated', path: NOTE })
    expect(second.outcome).toBe('conflict')
    await eventually(async () => (await onRemote(second.path)) === '# Welcome\n\nFrom the laptop.\n')
    expect(await onRemote(NOTE)).toBe('# Welcome\n\nFrom the phone.\n')
  })

  it('keeps an acknowledged web save at its path and the crossing desktop push as a conflict copy', async () => {
    await openVault()
    await fixture.desktop.commit(NOTE, '# Welcome\n\nFrom the desktop.\n')

    const result = await vault.write(NOTE, text('# Welcome\n\nFrom the web.\n'), { kind: 'match', etag: await etagOf(NOTE) })
    expect(result).toMatchObject({ outcome: 'updated', path: NOTE, pushed: false })

    await eventually(async () => events.some((event) => event.type === 'push-success'))
    const files = (await git(fixture.remote, ['ls-tree', '-r', '--name-only', 'main'])).stdout.split('\n')
    const copies = files.filter((path) => path.startsWith('welcome') && path !== NOTE)
    expect(await onRemote(NOTE)).toBe('# Welcome\n\nFrom the web.\n')
    expect(copies).toHaveLength(1)
    expect(await onRemote(copies[0])).toBe('# Welcome\n\nFrom the desktop.\n')
  })

  it('syncs desktop pushes in through the background queue and reports the pull', async () => {
    await openVault()
    await fixture.desktop.commit('desktop.md', '# Desktop\n')

    expect(await vault.syncNow()).toMatchObject({ pulled: true, pushed: true })
    expect((await vault.read('desktop.md' as VaultPath)).bytes.toString()).toBe('# Desktop\n')
    expect(events.map((event) => event.type)).toEqual(['pull', 'push-success'])
  })

  it('pulls desktop pushes on its own when background fetch is on', async () => {
    await openVault({ fetchIntervalMs: 50 })
    await fixture.desktop.commit('fetched.md', '# Fetched\n')

    await eventually(async () => events.some((event) => event.type === 'pull'))
    expect((await vault.read('fetched.md' as VaultPath)).bytes.toString()).toBe('# Fetched\n')
  })

  it('leaves commits local and says so when the remote is gone at shutdown', async () => {
    const lines: string[] = []
    await openVault({ log: (line) => lines.push(line), pushDebounceMs: 60_000 })
    await vault.write(NOTE, text('# Welcome\n\nLast edit.\n'), { kind: 'match', etag: await etagOf(NOTE) })
    await setRemoteUrl(MISSING_REMOTE)

    await vault.flushAndPush()

    expect(lines).toContain('WARNING: failed to push 1 commit(s) on shutdown; they remain local only')
    await setRemoteUrl(fixture.remote)
  })
})
