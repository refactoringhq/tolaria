import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import * as Y from 'yjs'
import { CollabProvider, type SocketLike } from '../../../packages/collab-client/src/collabProvider.ts'
import type { AccessGrant, AccessTicketAuthor, CollabTicketResponse, ListResponse, VaultResponse } from '../../../packages/protocol/src/index.ts'
import { Access } from '../src/access.ts'
import { accessTicketKey, readAccessTicket, signAccessTicket } from '../src/accessTickets.ts'
import { ChangeEmitter } from '../src/changeEmitter.ts'
import { CoAuthors, coAuthorTrailers, isCoAuthor, parseCoAuthor } from '../src/coAuthors.ts'
import { closeVaultServer, createVaultServer } from '../src/server.ts'
import type { VaultPath } from '../src/paths.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault } from '../src/vault.ts'
import { bearer, NOTE, TOKEN } from './accessHelpers.ts'
import { codec, settle } from './collabHelpers.ts'
import { createFixture, type Fixture, text } from './helpers.ts'

// TOL-238 (B5-4): commits a collaborator causes name them in `Co-authored-by` trailers; the
// owner's commits stay exactly as they were.

const ANA: AccessTicketAuthor = { name: 'ana', email: 'ana@example.com' }
const BEN: AccessTicketAuthor = { name: 'ben', email: '1234+ben@users.noreply.github.com' }
const NOTE_EDIT: AccessGrant[] = [{ scope: NOTE, role: 'editor' }]
const VAULT_EDIT: AccessGrant[] = [{ scope: '*', role: 'editor' }]
const TRAILER_ANA = 'Co-authored-by: ana <ana@example.com>'
const TRAILER_BEN = 'Co-authored-by: ben <1234+ben@users.noreply.github.com>'

interface Collaborator {
  sub: string
  grants: AccessGrant[]
  /** Left out, the ticket is one an older front end mints. */
  author?: unknown
}

/** A ticket as the hosted front end mints it since 1.10: with the user's git identity. */
function authored({ sub, grants, author }: Collaborator): string {
  const iat = Date.now()
  const payload = { v: 1 as const, sub, grants, iat, exp: iat + 60_000, ...(author === undefined ? {} : { author }) }
  return signAccessTicket(payload as Parameters<typeof signAccessTicket>[0], accessTicketKey(TOKEN))
}

describe('co-author identities', () => {
  it('accepts a name and an address that fit on one trailer line', () => {
    expect(isCoAuthor(ANA)).toBe(true)
    expect(isCoAuthor(BEN)).toBe(true)
    expect(isCoAuthor({ name: 'Ana María Pérez', email: 'ana@example.com' })).toBe(true)
  })

  it.each([
    ['no object', 'ana'],
    ['no name', { name: '', email: 'ana@example.com' }],
    ['a line break in the name', { name: 'ana\nSigned-off-by: x', email: 'ana@example.com' }],
    ['an angle bracket in the name', { name: 'ana <x@y.z>', email: 'ana@example.com' }],
    ['padding around the name', { name: ' ana', email: 'ana@example.com' }],
    ['a name too long', { name: 'a'.repeat(101), email: 'ana@example.com' }],
    ['no address', { name: 'ana', email: 'ana' }],
    ['a space in the address', { name: 'ana', email: 'ana @example.com' }],
    ['an angle bracket in the address', { name: 'ana', email: 'ana>@example.com' }],
    ['an address too long', { name: 'ana', email: `${'a'.repeat(250)}@x.yz` }],
    ['a name that is not text', { name: 7, email: 'ana@example.com' }],
  ])('refuses %s', (_case, value) => {
    expect(isCoAuthor(value)).toBe(false)
  })

  it('writes one trailer per person and reads them back', () => {
    const trailers = coAuthorTrailers([ANA, BEN])

    expect(trailers).toBe(`${TRAILER_ANA}\n${TRAILER_BEN}`)
    expect(trailers.split('\n').map((line) => parseCoAuthor(line.slice('Co-authored-by: '.length)))).toEqual([ANA, BEN])
    expect(coAuthorTrailers([])).toBe('')
    expect(parseCoAuthor('not a trailer')).toBeNull()
  })

  it('names each person once, by address', () => {
    const people = new CoAuthors([ANA, BEN])
    people.add([{ name: 'Ana', email: 'ANA@example.com' }])

    expect(people.take()).toEqual([ANA, BEN])
    expect(people.list()).toEqual([])
  })
})

describe('the author of an access ticket', () => {
  const key = accessTicketKey(TOKEN)
  const read = (ticket: string): Access | null => readAccessTicket(ticket, key, Date.now())

  it('names a collaborator', () => {
    const access = read(authored({ sub: 'ana-1', grants: NOTE_EDIT, author: ANA }))

    expect(access?.author).toEqual(ANA)
    expect(access?.coAuthors()).toEqual([ANA])
  })

  it('is optional: a ticket from an older front end names nobody', () => {
    expect(read(authored({ sub: 'ana-1', grants: NOTE_EDIT }))?.coAuthors()).toEqual([])
  })

  it('spoils the ticket when it is malformed', () => {
    expect(read(authored({ sub: 'ana-1', grants: NOTE_EDIT, author: { name: 'ana\nx', email: 'ana@example.com' } }))).toBeNull()
    expect(read(authored({ sub: 'ana-1', grants: NOTE_EDIT, author: 'ana@example.com' }))).toBeNull()
  })

  it('is never named for the owner', () => {
    expect(read(authored({ sub: 'owner-1', grants: [{ scope: '*', role: 'owner' }], author: ANA }))?.coAuthors()).toEqual([])
    expect(Access.OWNER.coAuthors()).toEqual([])
  })
})

let fixture: Fixture
let vault: Vault
let server: Server
let origin: string
let providers: CollabProvider[]

async function startServer(pushDebounceMs = 0): Promise<void> {
  vault = await fixture.openVault({ fetchIntervalMs: 0, pushDebounceMs })
  server = await createVaultServer({
    vault,
    store: new LocalDiskStore(join(fixture.root, 'server', 'state')),
    token: TOKEN,
    maxBodyBytes: 1024 * 1024,
    collab: { policy: { idleMs: 30, maxWaitMs: 5_000 }, lingerMs: 10 },
    changes: new ChangeEmitter(),
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

beforeEach(async () => {
  fixture = await createFixture()
  providers = []
})

afterEach(async () => {
  for (const provider of providers) provider.destroy()
  if (server) await closeVaultServer(server)
  await vault?.idle()
  await settle(20)
  await fixture.cleanup()
})

interface Call {
  path: string
  init: RequestInit
}

/** The only host these tests may call: the server they started on loopback. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1'])

function call({ path, init }: Call): Promise<Response> {
  const url = new URL(path, origin)
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    return fetch(url, init)
  }
  throw new Error(`the attribution tests only call the local test server, not ${url.host}`)
}

function as(credential: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...bearer(credential), ...(init.headers as Record<string, string>) }
  return call({ path, init: { ...init, headers } })
}

/** Writes `content` over the stored revision of `path`, as an editor that has seen it. */
async function put(credential: string, { path, content }: { path: string; content: string }): Promise<Response> {
  const current = await as(credential, `/v1/files/${path}`)
  const etag = current.headers.get('etag') ?? ''
  return as(credential, `/v1/files/${path}`, { method: 'PUT', body: content, headers: { 'if-match': etag } })
}

/** Full messages of the commits on the remote, newest first, as the desktop app pulls them. */
async function messages(): Promise<string[]> {
  await fixture.desktop.run(['pull', '-q', '--ff-only'])
  const { stdout } = await fixture.desktop.run(['log', '--format=%B%x00'])
  return stdout.split('\0').map((message) => message.trim()).filter(Boolean)
}

/** The authors and committers of the commits on the remote, newest first. */
async function signatures(): Promise<string[]> {
  const { stdout } = await fixture.desktop.run(['log', '--format=%an <%ae> / %cn <%ce>'])
  return stdout.trim().split('\n')
}

describe('REST edits of a shared note', () => {
  beforeEach(() => startServer())

  it('name each collaborator in the commit of their edit', async () => {
    const ana = authored({ sub: 'ana-1', grants: NOTE_EDIT, author: ANA })
    const ben = authored({ sub: 'ben-1', grants: NOTE_EDIT, author: BEN })

    expect((await put(ana, { path: NOTE, content: '# Alpha\n\nAna was here.\n' })).status).toBe(200)
    expect((await put(ben, { path: NOTE, content: '# Alpha\n\nAna and Ben were here.\n' })).status).toBe(200)

    const [benCommit, anaCommit] = await messages()
    expect(anaCommit).toBe(`Update ${NOTE}\n\n${TRAILER_ANA}`)
    expect(benCommit).toBe(`Update ${NOTE}\n\n${TRAILER_BEN}`)
    // The owner still makes the commit: only the trailer names the collaborator.
    expect((await signatures())[0]).toBe('Tolaria Remote <remote@tolaria.invalid> / Tolaria Remote <remote@tolaria.invalid>')
  })

  it('keep the owner’s commits exactly as they were', async () => {
    await put(TOKEN, { path: NOTE, content: '# Alpha\n\nThe owner was here.\n' })
    await put(authored({ sub: 'owner-1', grants: [{ scope: '*', role: 'owner' }], author: ANA }), { path: NOTE, content: '# Alpha\n\nAgain.\n' })
    await put(authored({ sub: 'ana-1', grants: NOTE_EDIT }), { path: NOTE, content: '# Alpha\n\nAn older front end.\n' })

    expect((await messages()).slice(0, 3)).toEqual([`Update ${NOTE}`, `Update ${NOTE}`, `Update ${NOTE}`])
  })

  it('name a vault editor in creates, renames, deletes and folder changes', async () => {
    const ana = authored({ sub: 'ana-1', grants: VAULT_EDIT, author: ANA })
    const json = (body: object): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

    await as(ana, '/v1/files/notes/new.md', { method: 'PUT', body: '# New\n', headers: { 'if-none-match': '*' } })
    await as(ana, '/v1/rename', json({ from: 'notes/new.md', to: 'notes/moved.md' }))
    const moved = await as(ana, '/v1/files/notes/moved.md')
    await as(ana, '/v1/files/notes/moved.md', { method: 'DELETE', headers: { 'if-match': moved.headers.get('etag') ?? '' } })
    await as(ana, '/v1/folders', json({ path: 'drafts' }))
    await as(ana, '/v1/folders/rename', json({ from: 'drafts', to: 'ideas' }))
    await as(ana, '/v1/folders/delete', json({ path: 'ideas' }))

    const authoredByAna = (await messages()).slice(0, 6)
    expect(authoredByAna).toHaveLength(6)
    for (const message of authoredByAna) expect(message).toMatch(new RegExp(`\n\n${TRAILER_ANA}$`))
  })

  it('advertise that tickets may carry an author', async () => {
    const vaultInfo = (await (await as(TOKEN, '/v1/vault')).json()) as VaultResponse

    expect(vaultInfo.protocolVersion).toBe('1.11')
    expect(vaultInfo.capabilities).toContain('access.authors')
  })
})

describe('live edits of a shared note', () => {
  beforeEach(() => startServer())

  async function docIdOf(path: string): Promise<string> {
    const { files } = (await (await as(TOKEN, '/v1/files')).json()) as ListResponse
    return files.find((file) => file.path === path)?.docId ?? ''
  }

  async function join(credential: string): Promise<CollabProvider> {
    const response = await as(credential, '/v1/collab/tickets', { method: 'POST', body: JSON.stringify({ docId: await docIdOf(NOTE), access: 'write' }) })
    const issued = (await response.json()) as CollabTicketResponse
    const url = `${origin.replace('http', 'ws')}${issued.path}?ticket=${issued.ticket}`
    const provider = new CollabProvider({ doc: new Y.Doc(), openSocket: async () => new NodeWebSocket(url) as unknown as SocketLike })
    providers.push(provider)
    await provider.whenSynced()
    return provider
  }

  function paragraph(doc: Y.Doc): Y.XmlText {
    const texts = doc.getXmlFragment('blocks').createTreeWalker((node) => node instanceof Y.XmlText)
    texts.next()
    return texts.next().value as Y.XmlText
  }

  it('name every collaborator who typed before the document was written', async () => {
    const owner = await join(TOKEN)
    const ana = await join(authored({ sub: 'ana-1', grants: NOTE_EDIT, author: ANA }))
    const ben = await join(authored({ sub: 'ben-1', grants: NOTE_EDIT, author: BEN }))

    paragraph(owner.doc).insert(0, 'Owner. ')
    paragraph(ana.doc).insert(0, 'Ana. ')
    paragraph(ben.doc).insert(0, 'Ben. ')

    const everyone = async (): Promise<boolean> => {
      const file = await fixture.desktop.read(NOTE)
      return ['Owner. ', 'Ana. ', 'Ben. '].every((edit) => file.includes(edit))
    }
    await expect.poll(everyone, { timeout: 5_000 }).toBe(true)
    expect(codec.read(owner.doc)).toContain('Ben. ')
    const written = (await messages()).filter((message) => message.startsWith(`Update ${NOTE}`))
    const trailers = written.flatMap((message) => message.split('\n').filter((line) => line.startsWith('Co-authored-by:')))
    expect(new Set(trailers)).toEqual(new Set([TRAILER_ANA, TRAILER_BEN]))
  })

  it('keep the commit of the owner’s own live edit exactly as it was', async () => {
    const owner = await join(TOKEN)

    paragraph(owner.doc).insert(0, 'Owner only. ')

    await expect.poll(() => fixture.desktop.read(NOTE), { timeout: 5_000 }).toContain('Owner only. ')
    expect((await messages())[0]).toBe(`Update ${NOTE}`)
  })
})

describe('local commits replayed onto upstream', () => {
  beforeEach(() => startServer(60_000))

  it('keep naming the collaborators of the commits they replace', async () => {
    await put(authored({ sub: 'ana-1', grants: NOTE_EDIT, author: ANA }), { path: NOTE, content: '# Alpha\n\nAna, not pushed yet.\n' })
    await put(authored({ sub: 'ben-1', grants: NOTE_EDIT, author: BEN }), { path: NOTE, content: '# Alpha\n\nBen, not pushed yet.\n' })
    await fixture.desktop.commit('welcome.md', '# Welcome\n\nThe desktop moved on.\n')

    await as(TOKEN, '/v1/sync', { method: 'POST' })

    const [replay] = await messages()
    expect(replay.split('\n')[0]).toBe('Replay 1 local change(s) onto upstream')
    expect(new Set(replay.split('\n').filter((line) => line.startsWith('Co-authored-by:')))).toEqual(new Set([TRAILER_ANA, TRAILER_BEN]))
  })

  it('stay as they were when only the owner changed something', async () => {
    await vault.write('drafts/owner.md' as VaultPath, text('# Owner\n'), { kind: 'absent' })
    await fixture.desktop.commit('welcome.md', '# Welcome\n\nThe desktop moved on.\n')

    await as(TOKEN, '/v1/sync', { method: 'POST' })

    expect((await messages())[0]).toBe('Replay 1 local change(s) onto upstream')
  })
})
