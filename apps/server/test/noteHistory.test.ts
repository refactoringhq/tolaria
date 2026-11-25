import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NoteHistoryResponse, VaultResponse, WriteResult } from '../../../packages/protocol/src/index.ts'
import { accessTicketKey, signAccessTicket } from '../src/accessTickets.ts'
import { ChangeEmitter } from '../src/changeEmitter.ts'
import { blobEtag } from '../src/paths.ts'
import { closeVaultServer, createVaultServer } from '../src/server.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault } from '../src/vault.ts'
import { bearer, NOTE, NOTE_VIEWER, OTHER_NOTE, TOKEN, VAULT_VIEWER } from './accessHelpers.ts'
import { createFixture, type Fixture, SEED_NOTES } from './helpers.ts'

// TOL-421: a note's checkpoints can be listed and read, and one can be restored as a new checkpoint.

const FIRST_EDIT = '# Alpha\n\nFirst edit.\n'
const SECOND_EDIT = '# Alpha\n\nSecond edit.\n'

let fixture: Fixture
let vault: Vault
let server: Server
let base: string

beforeEach(async () => {
  fixture = await createFixture()
  vault = await fixture.openVault({ fetchIntervalMs: 0 })
  server = await createVaultServer({
    vault,
    store: new LocalDiskStore(join(fixture.root, 'server', 'state')),
    token: TOKEN,
    maxBodyBytes: 1024 * 1024,
    collab: false,
    changes: new ChangeEmitter(),
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await closeVaultServer(server)
  await vault.idle()
  await fixture.cleanup()
})

function as(credential: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...bearer(credential), ...(init.headers as Record<string, string>) }
  return fetch(new URL(path, base), { ...init, headers })
}

interface Edit {
  path: string
  content: string
}

interface CheckpointRef {
  id: string
  path?: string
}

async function save({ path, content }: Edit): Promise<void> {
  const current = await as(TOKEN, `/v1/files/${path}`)
  const etag = current.headers.get('etag') ?? ''
  await current.arrayBuffer()
  const response = await as(TOKEN, `/v1/files/${path}`, { method: 'PUT', body: content, headers: { 'if-match': etag } })
  expect(response.status).toBe(200)
  await response.arrayBuffer()
}

async function history(credential: string, path = NOTE): Promise<NoteHistoryResponse> {
  const response = await as(credential, `/v1/history/${path}`)
  expect(response.status).toBe(200)
  return (await response.json()) as NoteHistoryResponse
}

async function checkpointContent(credential: string, { id, path = NOTE }: CheckpointRef): Promise<Response> {
  return as(credential, `/v1/history/${path}?checkpoint=${id}`)
}

function restore(credential: string, body: unknown): Promise<Response> {
  return as(credential, '/v1/restore', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

async function currentContent(path = NOTE): Promise<string> {
  return (await vault.read(path as Parameters<Vault['read']>[0])).bytes.toString('utf8')
}

describe('note history', () => {
  it('lists every checkpoint of a note, newest first, with its time and author', async () => {
    await save({ path: NOTE, content: FIRST_EDIT })
    await save({ path: NOTE, content: SECOND_EDIT })

    const { path, checkpoints } = await history(TOKEN)

    expect(path).toBe(NOTE)
    expect(checkpoints.map((checkpoint) => checkpoint.message)).toEqual([`Update ${NOTE}`, `Update ${NOTE}`, 'Seed vault'])
    expect(checkpoints[2].author).toBe('Desktop')
    for (const checkpoint of checkpoints) {
      expect(checkpoint.id).toMatch(/^[0-9a-f]{40}$/)
      expect(Number.isNaN(Date.parse(checkpoint.time))).toBe(false)
    }
  })

  it('leaves out the commits that did not touch the note', async () => {
    await save({ path: OTHER_NOTE, content: 'Other\n' })

    const { checkpoints } = await history(TOKEN)

    expect(checkpoints).toHaveLength(1)
  })

  it('serves the content of a note at one of its checkpoints', async () => {
    await save({ path: NOTE, content: FIRST_EDIT })
    await save({ path: NOTE, content: SECOND_EDIT })
    const { checkpoints } = await history(TOKEN)

    const response = await checkpointContent(TOKEN, { id: checkpoints[1].id })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(await response.text()).toBe(FIRST_EDIT)
  })

  it('refuses a checkpoint that is not a commit id', async () => {
    const response = await checkpointContent(TOKEN, { id: 'HEAD~1' })

    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('invalid_request')
  })

  it('answers not found for a checkpoint where the note did not exist', async () => {
    const { checkpoints } = await history(TOKEN)
    const response = await checkpointContent(TOKEN, { id: checkpoints[0].id, path: 'missing.md' })

    expect(response.status).toBe(404)
    await response.arrayBuffer()
  })

  it('names the co-author of a change made through an access ticket', async () => {
    const iat = Date.now()
    const ana = signAccessTicket(
      { v: 1, sub: 'ana', grants: [{ scope: '*', role: 'editor' }], iat, exp: iat + 60_000, author: { name: 'Ana', email: 'ana@example.com' } },
      accessTicketKey(TOKEN),
    )
    const seed = await restoreTarget()
    await save({ path: NOTE, content: FIRST_EDIT })
    const restored = await restore(ana, { path: NOTE, checkpoint: seed })
    expect(restored.status).toBe(200)

    const { checkpoints } = await history(TOKEN)

    expect(checkpoints[0].author).toBe('Ana')
  })
})

/** The id of the seed checkpoint of the note. */
async function restoreTarget(): Promise<string> {
  const { checkpoints } = await history(TOKEN)
  return checkpoints[checkpoints.length - 1].id
}

describe('restoring a checkpoint', () => {
  it('puts the earlier content back as a new checkpoint and keeps the later one in history', async () => {
    await save({ path: NOTE, content: FIRST_EDIT })
    await save({ path: NOTE, content: SECOND_EDIT })
    const before = await history(TOKEN)
    const firstEdit = before.checkpoints[1]

    const response = await restore(TOKEN, { path: NOTE, checkpoint: firstEdit.id })

    expect(response.status).toBe(200)
    const result = (await response.json()) as WriteResult
    expect(result).toMatchObject({ outcome: 'updated', path: NOTE, etag: blobEtag(Buffer.from(FIRST_EDIT)) })
    expect(await currentContent()).toBe(FIRST_EDIT)
    const after = await history(TOKEN)
    expect(after.checkpoints).toHaveLength(before.checkpoints.length + 1)
    expect(after.checkpoints[0].message).toMatch(/^Restore projects\/alpha\.md from /)
    const later = await checkpointContent(TOKEN, { id: after.checkpoints[1].id })
    expect(await later.text()).toBe(SECOND_EDIT)
  })

  it('changes nothing when the note already has that content', async () => {
    const seed = await restoreTarget()

    const response = await restore(TOKEN, { path: NOTE, checkpoint: seed })

    expect(((await response.json()) as WriteResult).outcome).toBe('unchanged')
    expect((await history(TOKEN)).checkpoints).toHaveLength(1)
    expect(await currentContent()).toBe(SEED_NOTES[NOTE])
  })

  it('brings back a note deleted since the checkpoint', async () => {
    const seed = await restoreTarget()
    const current = await as(TOKEN, `/v1/files/${NOTE}`)
    await current.arrayBuffer()
    await as(TOKEN, `/v1/files/${NOTE}`, { method: 'DELETE', headers: { 'if-match': current.headers.get('etag') ?? '' } })

    const response = await restore(TOKEN, { path: NOTE, checkpoint: seed })

    expect(response.status).toBe(201)
    expect(await currentContent()).toBe(SEED_NOTES[NOTE])
  })

  it.each([
    ['no path', { checkpoint: 'a'.repeat(40) }],
    ['no checkpoint', { path: NOTE }],
    ['a checkpoint that is not a commit id', { path: NOTE, checkpoint: 'main' }],
  ])('refuses a request with %s', async (_name, body) => {
    const response = await restore(TOKEN, body)

    expect(response.status).toBe(400)
    await response.arrayBuffer()
  })
})

describe('history and access', () => {
  it('lets a viewer list and read checkpoints but not restore one', async () => {
    await save({ path: NOTE, content: FIRST_EDIT })
    const seed = await restoreTarget()

    expect((await history(VAULT_VIEWER())).checkpoints).toHaveLength(2)
    expect(await (await checkpointContent(NOTE_VIEWER(), { id: seed })).text()).toBe(SEED_NOTES[NOTE])
    const refused = await restore(VAULT_VIEWER(), { path: NOTE, checkpoint: seed })

    expect(refused.status).toBe(403)
    await refused.arrayBuffer()
    expect(await currentContent()).toBe(FIRST_EDIT)
  })

  it('hides the history of a note the ticket does not cover', async () => {
    const listed = await as(NOTE_VIEWER(), `/v1/history/${OTHER_NOTE}`)
    const restored = await restore(NOTE_VIEWER(), { path: OTHER_NOTE, checkpoint: await restoreTarget() })

    expect(listed.status).toBe(404)
    expect(restored.status).toBe(404)
    await listed.arrayBuffer()
    await restored.arrayBuffer()
  })

  it('advertises history in the vault description', async () => {
    const description = (await (await as(TOKEN, '/v1/vault')).json()) as VaultResponse

    expect(description.capabilities).toEqual(expect.arrayContaining(['history.read', 'history.restore']))
  })
})
