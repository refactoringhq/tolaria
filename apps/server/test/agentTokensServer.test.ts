import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import {
  ACCESS_TICKET_MAX_LIFETIME_MS,
  COLLAB_CLOSE,
  type ListResponse,
  type SearchResponse,
  type VaultResponse,
} from '../../../packages/protocol/src/index.ts'
import { addAgentToken, type AddTokenOptions, revokeAgentToken } from '../src/agentTokenAdmin.ts'
import { AgentTokens } from '../src/agentTokenFile.ts'
import { ChangeEmitter } from '../src/changeEmitter.ts'
import { closeVaultServer, createVaultServer, type ServerOptions } from '../src/server.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault } from '../src/vault.ts'
import { bearer, NOTE, OTHER_NOTE, TOKEN } from './accessHelpers.ts'
import { settle } from './collabHelpers.ts'
import { createFixture, type Fixture } from './helpers.ts'

// Agent tokens on a running server: what they may do over REST, MCP, the websocket and the
// change feed, and revoking one with the command while the server runs.

interface ToolResult {
  content: { type: string; text: string }[]
  isError?: boolean
}

let fixture: Fixture
let vault: Vault
let server: Server
let origin: string
let file: string
let clock: number
let sockets: NodeWebSocket[]

async function start(extra: Partial<ServerOptions> = {}): Promise<void> {
  const changes = new ChangeEmitter()
  vault = await fixture.openVault({ fetchIntervalMs: 0, onVaultEvent: (event) => changes.emit(event) })
  server = await createVaultServer({
    vault,
    store: new LocalDiskStore(join(fixture.root, 'server', 'state')),
    token: TOKEN,
    maxBodyBytes: 1024 * 1024,
    collab: { policy: { idleMs: 30, maxWaitMs: 5_000 }, lingerMs: 10 },
    changes,
    tokens: AgentTokens.load(file, { now: () => clock }),
    ...extra,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

beforeEach(async () => {
  fixture = await createFixture()
  file = join(fixture.root, 'server', 'tokens.json')
  clock = Date.now()
  sockets = []
})

afterEach(async () => {
  for (const socket of sockets) socket.terminate()
  await closeVaultServer(server)
  await vault.idle()
  await settle(20)
  await fixture.cleanup()
})

function add(name: string, options: Omit<AddTokenOptions, 'name'>): string {
  return addAgentToken(file, { name, ...options }, clock).credential
}

/** Every request goes to the server this test started on loopback. */
function as(credential: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(new URL(path, origin), { ...init, headers: { ...bearer(credential), ...(init.headers as Record<string, string>) } })
}

function put(credential: string, path: string, content: string): Promise<Response> {
  return as(credential, `/v1/files/${path}`, { method: 'PUT', body: content, headers: { 'if-match': '*' } })
}

let rpcId = 1
async function tool(credential: string, name: string, args: object = {}): Promise<ToolResult> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method: 'tools/call', params: { name, arguments: args } })
  const response = await as(credential, '/mcp', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
  })
  const reply = (await response.json()) as { result: ToolResult }
  return reply.result
}

async function paths(credential: string): Promise<string[]> {
  const { files } = (await (await as(credential, '/v1/files')).json()) as ListResponse
  return files.map((entry) => entry.path).sort()
}

describe('a viewer token', () => {
  it('reads over REST and MCP and is refused every write on both', async () => {
    const viewer = add('phone', { role: 'viewer' })
    await start()

    expect((await as(viewer, `/v1/files/${NOTE}`)).status).toBe(200)
    expect((await tool(viewer, 'get_note', { path: NOTE })).isError).toBeFalsy()
    expect((await tool(viewer, 'search_notes', { query: 'Heron' })).content[0].text).toContain(NOTE)

    expect((await put(viewer, NOTE, '# Changed\n')).status).toBe(403)
    expect((await as(viewer, `/v1/files/${NOTE}`, { method: 'DELETE', headers: { 'if-match': '*' } })).status).toBe(403)
    expect((await tool(viewer, 'update_note', { path: NOTE, content: '# Changed\n' })).isError).toBe(true)
    expect((await tool(viewer, 'append_to_note', { path: NOTE, content: 'more' })).isError).toBe(true)
    expect((await tool(viewer, 'create_note', { path: 'new.md', content: '# New\n' })).isError).toBe(true)
  })

  it('still works after the clock passes the longest ticket lifetime', async () => {
    const viewer = add('phone', { role: 'viewer' })
    await start()
    clock += 2 * ACCESS_TICKET_MAX_LIFETIME_MS

    expect((await as(viewer, '/v1/files')).status).toBe(200)
  })

  it('cannot call an owner-only route', async () => {
    const editor = add('agent', { role: 'editor' })
    await start()
    const response = await as(editor, '/v1/access/revocations', { method: 'POST', body: JSON.stringify({ subject: 'x' }) })

    expect(response.status).toBe(403)
  })

  it('advertises tokens and reports its subject in the vault description', async () => {
    const viewer = add('phone', { role: 'viewer' })
    await start()
    const vaultInfo = (await (await as(viewer, '/v1/vault')).json()) as VaultResponse

    expect(vaultInfo.protocolVersion).toBe('1.11')
    expect(vaultInfo.capabilities).toContain('access.tokens')
    expect(vaultInfo.access?.subject).toMatch(/^token:/)
  })
})

describe('an editor token', () => {
  it('writes, and the commit on the remote names the token as co-author', async () => {
    const editor = addAgentToken(file, { name: 'research-agent', role: 'editor' }, clock)
    await start()

    expect((await put(editor.credential, 'notes/new.md', '# New\n')).status).toBe(201)
    await vault.flushAndPush()
    await fixture.desktop.run(['pull', '-q', '--ff-only'])
    const { stdout } = await fixture.desktop.run(['log', '-1', '--format=%B'])

    expect(stdout).toContain(`Co-authored-by: research-agent <${editor.token.id}@tokens.tolaria.invalid>`)
  })
})

describe('a single-note token', () => {
  it('sees only its note in listings, search, get_note and get_vault_context', async () => {
    const reader = add('reader', { role: 'editor', notes: [NOTE] })
    await start()
    await put(TOKEN, 'AGENTS.md', '# Agents\n\nSecret instructions.\n')
    await put(TOKEN, 'hidden/plan.md', '---\ntype: Secret\n---\n# Plan\n\nA Welcome nobody else sees.\n')

    expect(await paths(reader)).toEqual([NOTE])
    const search = (await (await as(reader, '/v1/search?q=Welcome')).json()) as SearchResponse
    expect(search.results.map((result) => result.path)).toEqual([NOTE])
    expect((await tool(reader, 'get_note', { path: OTHER_NOTE })).isError).toBe(true)
    const toolHits = (await tool(reader, 'search_notes', { query: 'Welcome' })).content[0].text
    expect(toolHits).not.toContain(`(${OTHER_NOTE})`)
    expect(toolHits).not.toContain('hidden/')

    const context = JSON.parse((await tool(reader, 'get_vault_context')).content[0].text) as Record<string, unknown>
    expect(context).toMatchObject({ noteCount: 1, folders: ['projects'], types: ['Note'], agentInstructions: null })
    expect((context.recentNotes as { path: string }[]).map((note) => note.path)).toEqual([NOTE])
    const vaults = JSON.parse((await tool(reader, 'list_vaults')).content[0].text) as { vaults: { hasAgentInstructions: boolean }[] }
    expect(vaults.vaults[0].hasAgentInstructions).toBe(false)

    expect((await tool(reader, 'create_note', { path: 'projects/beta.md', content: '# Beta\n' })).isError).toBe(true)
  })
})

describe('revoking while the server runs', () => {
  async function docIdOf(path: string): Promise<string> {
    const { files } = (await (await as(TOKEN, '/v1/files')).json()) as ListResponse
    return files.find((entry) => entry.path === path)?.docId ?? ''
  }

  async function openSocket(credential: string): Promise<{ closed: Promise<number> }> {
    const socket = new NodeWebSocket(`${origin.replace('http', 'ws')}/v1/collab/docs/${await docIdOf(NOTE)}`, { headers: bearer(credential) })
    sockets.push(socket)
    const closed = new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)))
    await new Promise((resolve) => socket.on('open', resolve))
    return { closed }
  }

  async function openFeed(credential: string): Promise<{ ended: Promise<void> }> {
    const feed = await as(credential, '/v1/changes')
    const reader = (feed.body as ReadableStream<Uint8Array>).getReader()
    const ended = (async () => {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        // Drains the feed until the server ends it.
      }
    })()
    return { ended }
  }

  it('refuses the next request and closes the token’s socket and change feed, and nobody else’s', async () => {
    const phone = add('phone', { role: 'viewer' })
    const other = add('other', { role: 'viewer' })
    await start()
    const { closed: socketClosed } = await openSocket(phone)
    const { ended: feedEnded } = await openFeed(phone)
    let otherClosed = false
    void (await openSocket(other)).closed.then(() => {
      otherClosed = true
    })

    revokeAgentToken(file, 'phone')
    clock += 1000

    expect((await as(phone, '/v1/files')).status).toBe(401)
    expect(await socketClosed).toBe(COLLAB_CLOSE.revoked)
    await feedEnded
    expect((await as(other, '/v1/files')).status).toBe(200)
    expect(otherClosed).toBe(false)
  })

  it('closes the open connections of a revoked token within about a second without any request', async () => {
    const phone = add('phone', { role: 'viewer' })
    await start()
    const { closed: socketClosed } = await openSocket(phone)
    const { ended: feedEnded } = await openFeed(phone)

    revokeAgentToken(file, 'phone')
    clock += 1000

    expect(await socketClosed).toBe(COLLAB_CLOSE.revoked)
    await feedEnded
  })
})

describe('rate limits', () => {
  it('count per token: exhausting one leaves another token and the owner alone', async () => {
    const first = add('first', { role: 'viewer' })
    const second = add('second', { role: 'viewer' })
    await start({ rateLimit: { perSecond: 1, burst: 3 } })

    const statuses = []
    for (let request = 0; request < 4; request += 1) statuses.push((await as(first, '/v1/files')).status)

    expect(statuses).toEqual([200, 200, 200, 429])
    expect((await as(second, '/v1/files')).status).toBe(200)
    expect((await as(TOKEN, '/v1/files')).status).toBe(200)
  })
})
