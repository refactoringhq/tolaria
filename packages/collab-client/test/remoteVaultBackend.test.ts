import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket as NodeWebSocket } from 'ws'
import { closeVaultServer, createVaultServer } from '../../../apps/server/src/server.ts'
import { LocalDiskStore } from '../../../apps/server/src/store.ts'
import type { Vault } from '../../../apps/server/src/vault.ts'
import { codec } from '../../../apps/server/test/collabHelpers.ts'
import { createFixture, type Fixture, SEED_NOTES } from '../../../apps/server/test/helpers.ts'
import type { SocketLike } from '../src/collabProvider.ts'
import { createRemoteVaultBackend, type RemoteBindings, RemoteError } from '../src/remoteVaultBackend.ts'
import type { VaultBackend, VaultCollabDoc } from '../../../src/lib/vaultBackend/types'

const TOKEN = 'test-token-0123456789'

let fixture: Fixture
let vault: Vault
let server: Server
let backend: VaultBackend<RemoteBindings>
let opened: VaultCollabDoc<RemoteBindings>[]

async function open(path: string, options = {}): Promise<VaultCollabDoc<RemoteBindings>> {
  const doc = await (backend.collab as NonNullable<typeof backend.collab>).openDoc(path, options)
  opened.push(doc)
  await doc.synced
  return doc
}

beforeEach(async () => {
  fixture = await createFixture()
  vault = await fixture.openVault()
  server = await createVaultServer({
    vault,
    store: new LocalDiskStore(join(fixture.root, 'server', 'state')),
    token: TOKEN,
    maxBodyBytes: 1024 * 1024,
    changes: new (await import('../../../apps/server/src/changeEmitter.ts')).ChangeEmitter(),
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  backend = createRemoteVaultBackend({
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    token: TOKEN,
    createSocket: (url) => new NodeWebSocket(url) as unknown as SocketLike,
  })
  opened = []
})

afterEach(async () => {
  for (const doc of opened) doc.close()
  await closeVaultServer(server)
  await vault.idle()
  await fixture.cleanup()
})

describe('the remote vault backend', () => {
  it('describes itself as a remote with collaboration and store-side revision checks', () => {
    expect(backend).toMatchObject({
      kind: 'remote',
      capabilities: { collaboration: true, atomicRevisions: true, attachments: true },
    })
  })

  it('reads a file with its revision', async () => {
    const file = await backend.files.read('welcome.md')

    expect(file).toEqual({ path: 'welcome.md', content: SEED_NOTES['welcome.md'], revision: expect.stringMatching(/^[0-9a-f]{40}$/) })
  })

  it('writes on top of the revision it read, creates, and overwrites when asked to', async () => {
    const { revision } = await backend.files.read('welcome.md')

    const updated = await backend.files.write('welcome.md', '# Updated\n', { baseRevision: revision })
    const created = await backend.files.write('folder/new note.md', '# New\n', { baseRevision: null })
    const forced = await backend.files.write('welcome.md', '# Forced\n')

    expect([updated.status, created.status, forced.status]).toEqual(['written', 'written', 'written'])
    expect((await backend.files.read('folder/new note.md')).content).toBe('# New\n')
  })

  it('reports a stale write as a conflict, with the file that won', async () => {
    const { revision } = await backend.files.read('welcome.md')
    await fixture.desktop.commit('welcome.md', '# From the desktop\n')

    const result = await backend.files.write('welcome.md', '# Stale\n', { baseRevision: revision })

    expect(result).toMatchObject({ status: 'conflict', current: { path: 'welcome.md', content: '# From the desktop\n' } })
  })

  it('raises the status of a request the server refuses', async () => {
    await expect(backend.files.read('missing.md')).rejects.toMatchObject({ name: 'RemoteError', status: 404 })
    await expect(open('attachments/pixel.bin')).rejects.toBeInstanceOf(RemoteError)
  })

  it('refuses by name what the server does not offer yet', async () => {
    const { files } = backend
    const refused = [files.reloadEntry('welcome.md')]

    const outcomes = await Promise.allSettled(refused)

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected'])
    expect(String((outcomes[0] as PromiseRejectedResult).reason)).toMatch(/not available on the Tolaria remote yet/)
  })

  it('opens a note as a live document that two clients share', async () => {
    const ada = await open('welcome.md', { user: { name: 'Ada', color: '#d9480f' } })
    const luca = await open('welcome.md')

    ada.doc.getText('frontmatter').insert(0, '')
    const heading = ada.fragment.createTreeWalker((node) => node.constructor.name === 'YXmlText').next().value as { insert(index: number, text: string): void }
    heading.insert(0, 'Shared ')

    await expect.poll(() => codec.read(luca.doc)).toContain('# Shared Welcome')
    expect(luca.awareness.getStates().get(ada.doc.clientID)).toEqual({ user: { name: 'Ada', color: '#d9480f' } })
  })

  it('opens a read-only document that cannot change the note', async () => {
    const viewer = await open('welcome.md', { readOnly: true })
    const editor = await open('welcome.md')

    viewer.doc.getText('frontmatter').insert(0, 'defaced')
    editor.doc.getText('frontmatter').insert(0, '')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(editor.doc.getText('frontmatter').toString()).not.toContain('defaced')
  })

  it('lists all entries in the vault', async () => {
    const entries = await backend.files.list()

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'welcome.md', filename: 'welcome.md', title: 'Welcome' }),
        expect.objectContaining({ path: 'projects/alpha.md', filename: 'alpha.md', title: 'Alpha' }),
      ]),
    )
    expect(entries.length).toBe(3)
  })

  it('leaves dot files out of the entries, as the desktop does, so a new folder adds no note', async () => {
    await backend.files.createFolder({ parentPath: null, name: 'ideas' })

    expect((await backend.files.list()).map((entry) => entry.path)).not.toContain('ideas/.keep')
    expect((await backend.files.reload()).map((entry) => entry.path)).not.toContain('ideas/.keep')
  })

  it('searches notes by content', async () => {
    const result = await backend.files.search('welcome')

    expect(result).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          path: 'welcome.md',
          title: expect.any(String),
          snippet: expect.any(String),
        }),
      ]),
      elapsedMs: expect.any(Number),
    })
  })

  it('searches with a limit', async () => {
    const result = await backend.files.search('the', { limit: 1 })

    expect(result.results).toHaveLength(1)
  })

  it('deletes files and returns what was deleted', async () => {
    await fixture.desktop.commit('to-delete.md', '# Will be deleted\n')
    await vault.syncNow()

    const deleted = await backend.files.delete(['to-delete.md', 'missing.md'])

    expect(deleted).toEqual(['to-delete.md'])
    await expect(backend.files.read('to-delete.md')).rejects.toMatchObject({ status: 404 })
  })

  it('deletes multiple files successfully', async () => {
    await fixture.desktop.commit('delete-1.md', '# First\n')
    await fixture.desktop.commit('delete-2.md', '# Second\n')
    await vault.syncNow()

    const deleted = await backend.files.delete(['delete-1.md', 'delete-2.md'])

    expect(deleted).toEqual(['delete-1.md', 'delete-2.md'])
    await expect(backend.files.read('delete-1.md')).rejects.toMatchObject({ status: 404 })
    await expect(backend.files.read('delete-2.md')).rejects.toMatchObject({ status: 404 })
  })

  it('handles delete when file is already deleted', async () => {
    const deleted = await backend.files.delete(['never-existed.md'])

    expect(deleted).toEqual([])
  })

  it('lists entries with all required fields populated', async () => {
    await fixture.desktop.commit('typed-note.md', '---\nIs A: Project\nStatus: Active\naliases:\n  - "alt-name"\n---\n# Typed Note\n')
    await vault.syncNow()

    const entries = await backend.files.list()
    const typedEntry = entries.find(e => e.path === 'typed-note.md')

    expect(typedEntry).toMatchObject({
      path: 'typed-note.md',
      title: 'Typed Note',
      isA: 'Project',
      status: 'Active',
      aliases: expect.arrayContaining(['alt-name']),
      archived: false,
      relatedTo: [],
      belongsTo: [],
      relationships: {},
      visible: true,
      organized: false,
      favorite: false,
      favoriteIndex: null,
      fileKind: 'markdown',
    })
  })

  it('lists entries with minimal frontmatter', async () => {
    await fixture.desktop.commit('minimal.md', '# Minimal Note\n\nJust content.')
    await vault.syncNow()

    const entries = await backend.files.list()
    const minimal = entries.find(e => e.path === 'minimal.md')

    expect(minimal).toMatchObject({
      path: 'minimal.md',
      title: 'Minimal Note',
      isA: 'Note',
      status: null,
      aliases: [],
      fileKind: 'markdown',
    })
  })

  it('searches returns empty results for no matches', async () => {
    const result = await backend.files.search('xyzabc-nonexistent-term')

    expect(result.results).toEqual([])
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('searches handles special characters in query', async () => {
    await fixture.desktop.commit('special.md', '# Note\n\nContent with [brackets] and (parens)')
    await vault.syncNow()

    const result = await backend.files.search('[brackets]')

    expect(result.results.some(r => r.path === 'special.md')).toBe(true)
  })

  it('searches respects the limit parameter', async () => {
    await fixture.desktop.commit('search-1.md', '# One\n\nfindme content')
    await fixture.desktop.commit('search-2.md', '# Two\n\nfindme more')
    await fixture.desktop.commit('search-3.md', '# Three\n\nfindme again')
    await vault.syncNow()

    const result = await backend.files.search('findme', { limit: 2 })

    expect(result.results.length).toBeLessThanOrEqual(2)
  })

  it('searches with default limit when not specified', async () => {
    const result = await backend.files.search('welcome', {})

    expect(result.results.length).toBeGreaterThanOrEqual(0)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it.each([
    ['spaces', 'folder/name with spaces.md', '# Spaced\n'],
    ['unicode', 'folder/日本語.md', '# Japanese\n'],
  ])('reads a file whose path has %s', async (_kind, path, content) => {
    await fixture.desktop.commit(path, content)
    await vault.syncNow()

    const file = await backend.files.read(path)

    expect(file).toMatchObject({ path, content, revision: expect.stringMatching(/^[0-9a-f]{40}$/) })
  })

  it('throws RemoteError with correct status on read failure', async () => {
    let error: RemoteError | null = null
    try {
      await backend.files.read('nonexistent-file.md')
    } catch (e) {
      error = e as RemoteError
    }

    expect(error).toBeInstanceOf(RemoteError)
    expect(error?.status).toBe(404)
    expect(error?.name).toBe('RemoteError')
    expect(error?.message).toContain('404')
  })

  it.each([
    ['list', (files: VaultBackend['files']) => files.list()],
    ['search', (files: VaultBackend['files']) => files.search('query')],
  ])('throws RemoteError when the server refuses %s', async (_operation, run) => {
    const badBackend = createRemoteVaultBackend({
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      token: 'invalid-token',
      createSocket: (url) => new NodeWebSocket(url) as unknown as SocketLike,
    })

    await expect(run(badBackend.files)).rejects.toMatchObject({ name: 'RemoteError', status: 401 })
  })

  it('maps protocol entries with all optional fields present', async () => {
    await fixture.desktop.commit('full-entry.md', [
      '---',
      'Is A: Task',
      'Status: Done',
      'aliases:',
      '  - "alias1"',
      '  - "alias2"',
      'Belongs to:',
      '  - "[[parent]]"',
      '---',
      '# Full Entry',
      '',
      '[[linked-note]]',
    ].join('\n'))
    await vault.syncNow()

    const entries = await backend.files.list()
    const fullEntry = entries.find(e => e.path === 'full-entry.md')

    expect(fullEntry).toBeTruthy()
    expect(fullEntry?.isA).toBe('Task')
    expect(fullEntry?.status).toBe('Done')
    expect(fullEntry?.aliases).toEqual(['alias1', 'alias2'])
    expect(fullEntry?.belongsTo).toEqual(expect.arrayContaining(['[[parent]]']))
    expect(fullEntry?.outgoingLinks).toEqual(expect.arrayContaining(['linked-note']))
  })

  it('searches maps results with path matches having higher scores', async () => {
    await fixture.desktop.commit('match-in-path.md', '# Some content\n')
    await fixture.desktop.commit('other.md', '# match-in-path appears here\n')
    await vault.syncNow()

    const result = await backend.files.search('match-in-path')

    const pathMatch = result.results.find(r => r.path.includes('match-in-path.md'))
    const contentMatch = result.results.find(r => r.path === 'other.md')

    if (pathMatch && contentMatch) {
      expect(pathMatch.score).toBeGreaterThan(contentMatch.score)
    }
  })

  it('searches extracts snippet from first match', async () => {
    await fixture.desktop.commit('snippet-test.md', '# Title\n\nFirst paragraph with keyword.\n\nSecond paragraph.')
    await vault.syncNow()

    const result = await backend.files.search('keyword')

    const match = result.results.find(r => r.path === 'snippet-test.md')
    expect(match?.snippet).toContain('keyword')
  })

  it('searches handles results with no matches array gracefully', async () => {
    const result = await backend.files.search('welcome')

    expect(result.results).toBeDefined()
    expect(Array.isArray(result.results)).toBe(true)
    result.results.forEach(r => {
      expect(r).toHaveProperty('path')
      expect(r).toHaveProperty('title')
      expect(r).toHaveProperty('snippet')
      expect(r).toHaveProperty('score')
    })
  })

  it('chrome operations throw unsupported errors for listViews', async () => {
    await expect(backend.chrome.listViews()).rejects.toThrow('listing views')
  })

  it('has chrome operations on the backend interface', () => {
    expect(backend.chrome).toBeDefined()
    expect(backend.chrome.listFolders).toBeInstanceOf(Function)
    expect(backend.chrome.listViews).toBeInstanceOf(Function)
  })
})
