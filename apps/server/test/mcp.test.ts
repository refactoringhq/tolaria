import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accessTicketKey, signAccessTicket } from '../src/accessTickets.ts'
import { blobEtag } from '../src/paths.ts'
import type { Vault } from '../src/vault.ts'
import { NOTE, NOTE_EDITOR, NOTE_VIEWER, OTHER_NOTE, TOKEN, VAULT_EDITOR, VAULT_VIEWER } from './accessHelpers.ts'
import { createFixture, type Fixture, SEED_NOTES, text } from './helpers.ts'
import { McpServer } from './mcpHelpers.ts'

const TRAILER_ANA = 'Co-authored-by: ana <ana@example.com>'
const SEVEN_TOOLS = [
  'append_to_note',
  'create_note',
  'get_note',
  'get_vault_context',
  'list_vaults',
  'search_notes',
  'update_note',
]

interface NoteJson {
  path: string
  frontmatter: Record<string, unknown>
  content: string
  etag: string
}

interface WriteJson {
  path: string
  outcome: string
  etag: string
  commit: string
  pushed: boolean
}

let fixture: Fixture
let vault: Vault
let mcp: McpServer

async function startWith(extra: Parameters<McpServer['start']>[0] = {}): Promise<void> {
  await mcp.stop()
  mcp = new McpServer(fixture, vault)
  await mcp.start(extra)
}

beforeEach(async () => {
  fixture = await createFixture()
  vault = await fixture.openVault({ now: () => new Date('2026-11-17T10:00:00Z'), fetchIntervalMs: 0 })
  mcp = new McpServer(fixture, vault)
  await mcp.start()
})

afterEach(async () => {
  await mcp.stop()
  await vault.idle()
  await fixture.cleanup()
})

describe('the MCP transport', () => {
  it('initializes, takes the initialized notification and lists the seven tools', async () => {
    const init = await mcp.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'tolaria-remote' } })

    const initialized = await mcp.post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    expect(initialized.status).toBe(202)
    expect(await initialized.text()).toBe('')

    const listed = (await mcp.request('tools/list')).result as { tools: { name: string; annotations: object; inputSchema: object }[] }
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(SEVEN_TOOLS)
    const getNote = listed.tools.find((tool) => tool.name === 'get_note')
    expect(getNote?.annotations).toMatchObject({ readOnlyHint: true })
    expect(getNote?.inputSchema).toMatchObject({ type: 'object', required: ['path'] })
  })

  it('answers an older known protocol version with that version and an unknown one with its newest', async () => {
    const older = await mcp.request('initialize', { protocolVersion: '2025-03-26', capabilities: {} })
    expect(older.result).toMatchObject({ protocolVersion: '2025-03-26' })
    const unknown = await mcp.request('initialize', { protocolVersion: '1999-01-01', capabilities: {} })
    expect(unknown.result).toMatchObject({ protocolVersion: '2025-06-18' })
  })

  it('answers ping and a JSON-RPC response with 202', async () => {
    expect((await mcp.request('ping')).result).toEqual({})
    const response = await mcp.post(JSON.stringify({ jsonrpc: '2.0', id: 7, result: {} }))
    expect(response.status).toBe(202)
  })

  it('refuses a request without a credential with 401', async () => {
    const response = await mcp.post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {}, null)
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
  })

  it.each(['GET', 'DELETE'])('answers %s with 405 and Allow: POST', async (method) => {
    const response = await fetch(mcp.url('/mcp'), { method, headers: { authorization: 'Bearer test-token-0123456789' } })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('maps unknown methods, bad JSON, malformed messages and batches to JSON-RPC errors', async () => {
    expect((await mcp.request('resources/list')).error?.code).toBe(-32601)

    const badJson = await mcp.post('{"jsonrpc":')
    expect(badJson.status).toBe(400)
    expect(await badJson.json()).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32700 } })

    const malformed = await mcp.post(JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' }))
    expect(await malformed.json()).toMatchObject({ id: 1, error: { code: -32600 } })

    const batch = await mcp.post(JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }]))
    expect(batch.status).toBe(400)
    expect(await batch.json()).toMatchObject({ error: { code: -32600, message: expect.stringMatching(/batch/i) } })
  })

  it('refuses an unknown MCP-Protocol-Version header with 400', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    expect((await mcp.post(body, { 'mcp-protocol-version': '2025-06-18' })).status).toBe(200)
    expect((await mcp.post(body, { 'mcp-protocol-version': '2099-01-01' })).status).toBe(400)
  })

  it('ignores arguments a tool does not name, such as the desktop vaultPath', async () => {
    const note = await mcp.json<NoteJson>('get_note', { path: NOTE, vaultPath: '/somewhere' })
    expect(note.path).toBe(NOTE)
    const noArguments = await mcp.request('tools/call', { name: 'list_vaults' })
    expect((noArguments.result as { isError?: boolean }).isError).toBeUndefined()
  })

  it('answers bad tool arguments and unknown tools with -32602', async () => {
    const notObject = await mcp.request('tools/call', { name: 'get_note', arguments: 'welcome.md' })
    expect(notObject.error?.code).toBe(-32602)
    const missing = await mcp.request('tools/call', { name: 'get_note', arguments: {} })
    expect(missing.error?.code).toBe(-32602)
    const wrongType = await mcp.request('tools/call', { name: 'search_notes', arguments: { query: 'x', limit: 'ten' } })
    expect(wrongType.error?.code).toBe(-32602)
    const unknown = await mcp.request('tools/call', { name: 'open_note', arguments: { path: NOTE } })
    expect(unknown.error?.code).toBe(-32602)
  })
})

describe('the read tools', () => {
  it('searches the index and names title, path and snippet', async () => {
    const result = await mcp.tool('search_notes', { query: 'heron' })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('**Alpha** (projects/alpha.md)')
    expect(result.content[0].text).toContain('Heron')
    expect((await mcp.tool('search_notes', { query: 'nothing-matches-this' })).content[0].text).toBe('No matching notes found.')
  })

  it('caps the hits at the given limit and refuses a query of several lines', async () => {
    const one = await mcp.tool('search_notes', { query: 'a', limit: 1 })
    expect(one.content[0].text.split('\n\n')).toHaveLength(1)
    expect((await mcp.tool('search_notes', { query: 'two\nlines' })).isError).toBe(true)
  })

  it('reads notes only', async () => {
    const binary = await mcp.tool('get_note', { path: 'attachments/pixel.bin' })
    expect(binary.isError).toBe(true)
    expect(binary.content[0].text).toMatch(/must end in \.md/)
  })

  it('describes a vault without AGENTS.md', async () => {
    const context = await mcp.json<{ agentInstructions: unknown }>('get_vault_context')
    expect(context.agentInstructions).toBeNull()
    const { vaults } = await mcp.json<{ vaults: { hasAgentInstructions: boolean; agentInstructionsPath: unknown }[] }>('list_vaults')
    expect(vaults[0]).toMatchObject({ hasAgentInstructions: false, agentInstructionsPath: null })
  })

  it('reads a note with its frontmatter, body and etag', async () => {
    const note = await mcp.json<NoteJson>('get_note', { path: OTHER_NOTE })
    expect(note).toEqual({
      path: OTHER_NOTE,
      frontmatter: { type: 'Note' },
      content: '# Welcome\n\nA throwaway vault for tests.',
      etag: blobEtag(text(SEED_NOTES[OTHER_NOTE])),
    })
  })

  it('reports a missing note or a path outside the vault as a tool error', async () => {
    expect((await mcp.tool('get_note', { path: 'missing.md' })).isError).toBe(true)
    const outside = await mcp.tool('get_note', { path: '../outside.md' })
    expect(outside.isError).toBe(true)
    expect(outside.content[0].text).toMatch(/path/)
  })

  it('describes the vault, with the root AGENTS.md', async () => {
    await fixture.desktop.commit('AGENTS.md', '# Agents\n\nBe brief.\n')
    await mcp.sync()
    const context = await mcp.json<Record<string, unknown>>('get_vault_context')
    expect(context).toMatchObject({
      name: 'remote',
      branch: 'main',
      noteCount: 3,
      types: ['Note'],
      folders: ['projects'],
      agentInstructions: { path: 'AGENTS.md', content: '# Agents\n\nBe brief.\n' },
    })
    expect((context.recentNotes as { path: string }[]).map((note) => note.path)).toEqual(['AGENTS.md', 'projects/alpha.md', 'welcome.md'])

    const { vaults } = await mcp.json<{ vaults: object[] }>('list_vaults')
    expect(vaults).toEqual([{ name: 'remote', label: 'remote', branch: 'main', hasAgentInstructions: true, agentInstructionsPath: 'AGENTS.md' }])
  })

  it('sees what the desktop pushed once the server has pulled', async () => {
    await fixture.desktop.commit('inbox/kestrel.md', '# Kestrel\n\nHovering over the field.\n')
    await mcp.sync()
    expect((await mcp.json<NoteJson>('get_note', { path: 'inbox/kestrel.md' })).content).toBe('# Kestrel\n\nHovering over the field.')
    expect((await mcp.tool('search_notes', { query: 'hovering' })).content[0].text).toContain('inbox/kestrel.md')
  })
})

describe('the write tools', () => {
  it('creates a note in one commit that reaches the remote, and never over an existing one', async () => {
    const before = await fixture.desktop.log()
    const created = await mcp.json<WriteJson>('create_note', { path: 'inbox/new.md', content: '# New\n\nFrom an agent.\n' })
    expect(created).toMatchObject({ path: 'inbox/new.md', outcome: 'created', pushed: true })
    expect(await fixture.desktop.read('inbox/new.md')).toBe('# New\n\nFrom an agent.\n')
    expect(await fixture.desktop.log()).toEqual(['Create inbox/new.md', ...before])

    const again = await mcp.tool('create_note', { path: 'inbox/new.md', content: '# Other\n' })
    expect(again.isError).toBe(true)
    expect(again.content[0].text).toMatch(/already exists/)
    expect(await fixture.desktop.log()).toEqual(['Create inbox/new.md', ...before])
  })

  it('builds a note from title and type when no content is given, and only creates .md files', async () => {
    await mcp.json<WriteJson>('create_note', { path: 'people/ada.md', title: 'Ada Lovelace', type: 'Person' })
    expect(await fixture.desktop.read('people/ada.md')).toBe('---\ntype: "Person"\n---\n\n# Ada Lovelace\n')
    await mcp.json<WriteJson>('create_note', { path: 'plain.md' })
    expect(await fixture.desktop.read('plain.md')).toBe('---\ntype: "Note"\n---\n\n# plain\n')
    expect((await mcp.tool('create_note', { path: 'notes.txt', content: 'x' })).isError).toBe(true)
  })

  it('refuses a stale expectedEtag without changing anything, and commits with the current one', async () => {
    const { etag } = await mcp.json<NoteJson>('get_note', { path: NOTE })
    await fixture.desktop.commit(NOTE, '# Alpha\n\nEdited on the desktop.\n')
    const before = await fixture.desktop.log()

    const stale = await mcp.tool('update_note', { path: NOTE, content: '# Alpha\n\nAgent rewrite.\n', expectedEtag: etag })
    expect(stale.isError).toBe(true)
    expect(stale.content[0].text).toMatch(/changed/)
    expect(await fixture.desktop.log()).toEqual(before)
    expect(await fixture.desktop.read(NOTE)).toBe('# Alpha\n\nEdited on the desktop.\n')

    const current = await mcp.json<NoteJson>('get_note', { path: NOTE })
    const updated = await mcp.json<WriteJson>('update_note', { path: NOTE, content: '# Alpha\n\nAgent rewrite.\n', expectedEtag: current.etag })
    expect(updated).toMatchObject({ outcome: 'updated', pushed: true })
    expect(await fixture.desktop.read(NOTE)).toBe('# Alpha\n\nAgent rewrite.\n')
  })

  it('updates over the current revision without expectedEtag, but only an existing note', async () => {
    await fixture.desktop.commit(NOTE, '# Alpha\n\nEdited on the desktop.\n')
    await mcp.json<WriteJson>('update_note', { path: NOTE, content: '# Alpha\n\nLast write.\n' })
    expect(await fixture.desktop.read(NOTE)).toBe('# Alpha\n\nLast write.\n')
    expect((await mcp.tool('update_note', { path: 'missing.md', content: '# Missing\n' })).isError).toBe(true)
  })

  it('refuses empty content for update and append', async () => {
    const before = await fixture.desktop.log()
    expect((await mcp.tool('update_note', { path: NOTE, content: '' })).content[0].text).toMatch(/content is required/)
    expect((await mcp.tool('append_to_note', { path: NOTE, content: '' })).isError).toBe(true)
    expect(await fixture.desktop.log()).toEqual(before)
  })

  it('appends to the body and keeps every existing byte, frontmatter included', async () => {
    const appended = await mcp.json<WriteJson>('append_to_note', { path: OTHER_NOTE, content: '\n- logged by an agent\n' })
    expect(appended.outcome).toBe('updated')
    expect(await fixture.desktop.read(OTHER_NOTE)).toBe(`${SEED_NOTES[OTHER_NOTE]}\n- logged by an agent\n`)
  })

  it('appends on top of a desktop change it has not pulled yet', async () => {
    await fixture.desktop.commit(NOTE, '# Alpha\n\nDesktop line.\n')
    await mcp.json<WriteJson>('append_to_note', { path: NOTE, content: 'Agent line.\n' })
    expect(await fixture.desktop.read(NOTE)).toBe('# Alpha\n\nDesktop line.\nAgent line.\n')
  })

  it('names the conflict copy when the desktop created the same note first', async () => {
    await fixture.desktop.commit('inbox/race.md', '# Race\n\nDesktop wins the path.\n')
    const result = await mcp.tool('create_note', { path: 'inbox/race.md', content: '# Race\n\nAgent version.\n' })
    const copy = 'inbox/race (conflict 2026-11-17 1000).md'
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain(copy)
    expect(await fixture.desktop.read('inbox/race.md')).toBe('# Race\n\nDesktop wins the path.\n')
    expect(await fixture.desktop.read(copy)).toBe('# Race\n\nAgent version.\n')
  })
})

describe('access tickets', () => {
  it('gives a viewer reads and refuses every write tool', async () => {
    const viewer = VAULT_VIEWER()
    expect((await mcp.json<NoteJson>('get_note', { path: NOTE }, viewer)).path).toBe(NOTE)
    const writes = [
      mcp.tool('create_note', { path: 'inbox/v.md', content: '# V\n' }, viewer),
      mcp.tool('update_note', { path: NOTE, content: '# V\n' }, viewer),
      mcp.tool('append_to_note', { path: NOTE, content: 'V\n' }, viewer),
    ]
    for (const result of await Promise.all(writes)) {
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toMatch(/read-only|cannot add/)
    }
    expect(await fixture.desktop.read(NOTE)).toBe(SEED_NOTES[NOTE])
  })

  it('hides notes outside a single-note grant from search, reads and the vault context', async () => {
    const viewer = NOTE_VIEWER()
    expect((await mcp.tool('search_notes', { query: 'welcome' }, viewer)).content[0].text).not.toContain(OTHER_NOTE)
    expect((await mcp.tool('get_note', { path: OTHER_NOTE }, viewer)).isError).toBe(true)
    const context = await mcp.json<{ noteCount: number; recentNotes: { path: string }[] }>('get_vault_context', {}, viewer)
    expect(context.noteCount).toBe(1)
    expect(context.recentNotes.map((note) => note.path)).toEqual([NOTE])
  })

  it('lets a single-note editor edit that note but not create one', async () => {
    const editor = NOTE_EDITOR()
    await mcp.json<WriteJson>('append_to_note', { path: NOTE, content: 'Edited.\n' }, editor)
    expect((await mcp.tool('create_note', { path: 'inbox/e.md', content: '# E\n' }, editor)).isError).toBe(true)
    expect((await mcp.tool('update_note', { path: OTHER_NOTE, content: '# E\n' }, editor)).isError).toBe(true)
  })

  it('names the ticket holder as co-author of the commits it causes', async () => {
    const iat = Date.now()
    const author = { name: 'ana', email: 'ana@example.com' }
    const payload = { v: 1 as const, sub: 'ana', grants: [{ scope: '*', role: 'editor' as const }], iat, exp: iat + 60_000, author }
    const ticket = signAccessTicket(payload, accessTicketKey(TOKEN))
    await mcp.json<WriteJson>('append_to_note', { path: NOTE, content: 'By a ticket.\n' }, ticket)
    await mcp.json<WriteJson>('create_note', { path: 'inbox/ana.md', content: '# Ana\n' }, ticket)
    await fixture.desktop.read(NOTE)
    const { stdout } = await fixture.desktop.run(['log', '-2', '--format=%B%x00'])
    const messages = stdout.split('\0').map((message) => message.trim()).filter(Boolean)
    expect(messages).toEqual([`Create inbox/ana.md\n\n${TRAILER_ANA}`, `Update ${NOTE}\n\n${TRAILER_ANA}`])
  })

  it('makes an owner commit without trailers for a vault editor ticket that names nobody', async () => {
    await mcp.json<WriteJson>('append_to_note', { path: NOTE, content: 'Anonymous editor.\n' }, VAULT_EDITOR())
    expect((await fixture.desktop.log())[0]).toBe(`Update ${NOTE}`)
  })
})

describe('switching and limiting', () => {
  it('leaves /mcp unserved when switched off', async () => {
    await startWith({ mcp: false })
    const response = await mcp.post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }))
    expect(response.status).toBe(404)
  })

  it('charges MCP requests to the account rate limit', async () => {
    await startWith({ rateLimit: { perSecond: 1, burst: 1 } })
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    expect((await mcp.post(body)).status).toBe(200)
    const limited = await mcp.post(body)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })
})
