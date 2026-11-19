import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import * as Y from 'yjs'
import { CollabProvider, type SocketLike } from '../../../packages/collab-client/src/collabProvider.ts'
import type { CollabTicketResponse, ListResponse } from '../../../packages/protocol/src/index.ts'
import type { Vault } from '../src/vault.ts'
import { NOTE, TOKEN } from './accessHelpers.ts'
import { codec, settle } from './collabHelpers.ts'
import { createFixture, type Fixture } from './helpers.ts'
import { McpServer } from './mcpHelpers.ts'

// An MCP write to a note that is open as a live document goes the way a `PUT /v1/files` does.

let fixture: Fixture
let vault: Vault
let mcp: McpServer
let providers: CollabProvider[]

const AUTHORIZED = { authorization: `Bearer ${TOKEN}` }

async function docIdOf(path: string): Promise<string> {
  const { files } = (await (await fetch(mcp.url('/v1/files'), { headers: AUTHORIZED })).json()) as ListResponse
  return files.find((file) => file.path === path)?.docId ?? ''
}

async function writeTicket(docId: string): Promise<CollabTicketResponse> {
  const body = JSON.stringify({ docId, access: 'write' })
  const response = await fetch(mcp.url('/v1/collab/tickets'), { method: 'POST', body, headers: AUTHORIZED })
  return (await response.json()) as CollabTicketResponse
}

async function joinNote(path: string): Promise<CollabProvider> {
  const docId = await docIdOf(path)
  const provider = new CollabProvider({
    doc: new Y.Doc(),
    openSocket: async () => {
      const issued = await writeTicket(docId)
      const url = mcp.url(`${issued.path}?ticket=${issued.ticket}`).toString().replace('http', 'ws')
      return new NodeWebSocket(url) as unknown as SocketLike
    },
  })
  providers.push(provider)
  await provider.whenSynced()
  return provider
}

function heading(doc: Y.Doc): Y.XmlText {
  return doc.getXmlFragment('blocks').createTreeWalker((node) => node instanceof Y.XmlText).next().value as Y.XmlText
}

beforeEach(async () => {
  fixture = await createFixture()
  vault = await fixture.openVault({ now: () => new Date('2026-11-17T10:00:00Z'), fetchIntervalMs: 0 })
  providers = []
  mcp = new McpServer(fixture, vault)
  await mcp.start({ collab: { policy: { idleMs: 2_000, maxWaitMs: 10_000 }, lingerMs: 10 } })
})

afterEach(async () => {
  for (const provider of providers) provider.destroy()
  await mcp.stop()
  await vault.idle()
  await settle(20)
  await fixture.cleanup()
})

describe('MCP writes to a note open for collaboration', () => {
  it('reach the people editing it', async () => {
    const ada = await joinNote(NOTE)
    await mcp.json('append_to_note', { path: NOTE, content: '\nAppended by an agent.\n' })
    await expect.poll(() => codec.read(ada.doc), { timeout: 5_000 }).toContain('Appended by an agent.')
  })

  it('keep the typing of the people editing it and save the agent version as a conflict copy', async () => {
    const ada = await joinNote(NOTE)
    heading(ada.doc).insert(0, 'Typed ')
    await settle()
    const { etag } = await mcp.json<{ etag: string }>('get_note', { path: NOTE })
    await mcp.json('update_note', { path: NOTE, content: '# Agent Alpha\n\nRewritten by an agent.\n', expectedEtag: etag })

    await expect.poll(() => fixture.desktop.log(), { timeout: 5_000 }).toContain(`Conflict copy of ${NOTE}`)
    expect(codec.read(ada.doc)).toContain('# Typed Alpha')
    await expect.poll(() => fixture.desktop.read(NOTE), { timeout: 5_000 }).toContain('# Typed Alpha')
    expect(await fixture.desktop.read('projects/alpha (conflict 2026-11-17 1000).md')).toBe('# Agent Alpha\n\nRewritten by an agent.\n')
  })
})
