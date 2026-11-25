import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChangeEmitter } from '../../../apps/server/src/changeEmitter.ts'
import { closeVaultServer, createVaultServer } from '../../../apps/server/src/server.ts'
import { LocalDiskStore } from '../../../apps/server/src/store.ts'
import type { Vault } from '../../../apps/server/src/vault.ts'
import { createFixture, type Fixture, SEED_NOTES } from '../../../apps/server/test/helpers.ts'
import { RemoteError } from '../src/remoteHttp.ts'
import { remoteHistory } from '../src/remoteHistory.ts'
import { createRemoteHistory, createRemoteVaultBackend } from '../src/remoteVaultBackend.ts'

// TOL-421: the web app lists a note's checkpoints, reads one and restores it.

const TOKEN = 'test-token-0123456789'
const NOTE = 'projects/alpha.md'
const EDIT = '# Alpha\n\nAn edit.\n'

let fixture: Fixture
let vault: Vault
let server: Server
let baseUrl: string

beforeEach(async () => {
  fixture = await createFixture()
  vault = await fixture.openVault()
  server = await createVaultServer({
    vault,
    store: new LocalDiskStore(join(fixture.root, 'server', 'state')),
    token: TOKEN,
    maxBodyBytes: 1024 * 1024,
    collab: false,
    changes: new ChangeEmitter(),
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await closeVaultServer(server)
  await vault.idle()
  await fixture.cleanup()
})

async function edit(content: string): Promise<void> {
  const files = createRemoteVaultBackend({ baseUrl, token: TOKEN }).files
  const current = await files.read(NOTE)
  await files.write(NOTE, content, { baseRevision: current.revision })
}

describe('note history on the remote', () => {
  it('lists the checkpoints, reads an earlier one and restores it', async () => {
    const history = createRemoteHistory({ baseUrl, token: TOKEN })
    await edit(EDIT)

    const checkpoints = await history.list(NOTE)
    expect(checkpoints).toHaveLength(2)
    const seed = checkpoints[1]
    expect(await history.read(NOTE, seed.id)).toBe(SEED_NOTES[NOTE])

    expect(await history.restore(NOTE, seed.id)).toBe('restored')
    expect(await history.restore(NOTE, seed.id)).toBe('unchanged')
    const after = await history.list(NOTE)
    expect(after).toHaveLength(3)
    expect(await history.read(NOTE, after[1].id)).toBe(EDIT)
  })

  it('reports a refusal with the status the server answered', async () => {
    const history = createRemoteHistory({ baseUrl, token: TOKEN })

    await expect(history.read(NOTE, 'not-a-checkpoint')).rejects.toMatchObject({ status: 400 })
    await expect(history.list('../outside.md')).rejects.toBeInstanceOf(RemoteError)
  })
})

describe('malformed answers', () => {
  const answering = (body: unknown) => remoteHistory(async () => Response.json(body))

  it.each([
    ['no checkpoints', { path: NOTE }],
    ['a checkpoint without an id', { path: NOTE, checkpoints: [{ time: 't', author: 'a', message: 'm' }] }],
    ['a checkpoint that is not an object', { path: NOTE, checkpoints: ['x'] }],
  ])('refuses a history with %s', async (_name, body) => {
    await expect(answering(body).list(NOTE)).rejects.toMatchObject({ status: 502 })
  })

  it('refuses a restore answer without an outcome', async () => {
    await expect(answering({ path: NOTE }).restore(NOTE, 'a'.repeat(40))).rejects.toMatchObject({ status: 502 })
  })
})
