import { join } from 'node:path'
import * as Y from 'yjs'
import { CollabProvider, type SocketLike } from '../../../packages/collab-client/src/collabProvider.ts'
import { NoteCodec } from '../../../packages/markdown-yjs/src/index.ts'
import type { CollabAccess } from '../../../packages/protocol/src/index.ts'
import { DEFAULT_FLUSH_POLICY, type FlushPolicy } from '../src/collab/flush.ts'
import { CollabHub } from '../src/collab/hub.ts'
import type { NoteSession } from '../src/collab/noteSession.ts'
import { DocIndex } from '../src/docIndex.ts'
import { isNote, type VaultPath } from '../src/paths.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault, VaultOptions } from '../src/vault.ts'
import { createFixture, type Fixture } from './helpers.ts'

/** Building the headless editor takes a moment; every test shares one. */
export const codec = new NoteCodec()

export const NOTE = 'projects/alpha.md'

const CLOSED = 3

/** Lets queued messages, timers of 0 ms and the promises behind them run. */
export async function settle(rounds = 3): Promise<void> {
  for (let round = 0; round < rounds; round++) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** An in-memory websocket between a provider and the hub: asynchronous, like a network. */
export class MemorySocket implements SocketLike {
  binaryType = ''
  readyState = 1
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  closeCode: number | null = null
  toServer: (data: Uint8Array) => void = () => {}
  serverClosed: () => void = () => {}
  private readonly inbox: Uint8Array[] = []
  private listener: ((event: { data: unknown }) => void) | null = null

  get onmessage(): ((event: { data: unknown }) => void) | null {
    return this.listener
  }

  set onmessage(listener: ((event: { data: unknown }) => void) | null) {
    this.listener = listener
    for (const data of this.inbox.splice(0)) this.deliver(data)
  }

  send(data: Uint8Array): void {
    queueMicrotask(() => this.readyState === CLOSED || this.toServer(data))
  }

  deliver(data: Uint8Array): void {
    if (!this.listener) this.inbox.push(data)
    else queueMicrotask(() => this.listener?.({ data }))
  }

  close(code = 1000): void {
    if (this.readyState === CLOSED) return
    this.readyState = CLOSED
    this.closeCode = code
    this.serverClosed()
    this.onclose?.()
  }
}

export interface TestClient {
  doc: Y.Doc
  provider: CollabProvider
  sockets: MemorySocket[]
  /** The note as markdown, in the serializer's form. */
  markdown(): string
  /** Types at the end of the first text that contains `anchor`. */
  type(anchor: string, text: string): void
}

function textContaining(doc: Y.Doc, anchor: string): Y.XmlText {
  const walker = doc.getXmlFragment('blocks').createTreeWalker((node) => node instanceof Y.XmlText)
  const found = ([...walker] as Y.XmlText[]).find((text) => text.toString().includes(anchor))
  if (!found) throw new Error(`no text contains ${anchor}`)
  return found
}

export interface Harness {
  fixture: Fixture
  vault: Vault
  docs: DocIndex
  hub: CollabHub
  logs: string[]
  docId(path?: string): string
  session(path?: string): Promise<NoteSession>
  /** Connects a client and waits until it has the document. */
  client(path?: string, access?: CollabAccess): Promise<TestClient>
  /** A second hub over the same vault and state, as after a restart. */
  restart(): Promise<void>
  file(path?: string): Promise<string>
  commits(): Promise<string[]>
  cleanup(): Promise<void>
}

export interface HarnessOptions {
  policy?: FlushPolicy
  lingerMs?: number
  /** Vault settings, e.g. a push debounce for a vault that pushes in the background. */
  vault?: Partial<VaultOptions>
}

async function openSocket(hub: CollabHub, docId: string, access: CollabAccess): Promise<MemorySocket> {
  const socket = new MemorySocket()
  const connection = await hub.connect(docId, { send: (data) => socket.deliver(data), close: (code) => socket.close(code) }, access)
  if (!connection) throw new Error(`no document ${docId}`)
  socket.toServer = (data) => connection.receive(data)
  socket.serverClosed = () => connection.closed()
  return socket
}

export async function createHarness({ policy = DEFAULT_FLUSH_POLICY, lingerMs = 60_000, vault: settings }: HarnessOptions = {}): Promise<Harness> {
  const fixture = await createFixture()
  const vault = await fixture.openVault(settings)
  const store = new LocalDiskStore(join(fixture.root, 'server', 'state'))
  const docs = await DocIndex.open(store)
  const { files } = await vault.list()
  await docs.reconcile(files.map((file) => file.path as VaultPath).filter(isNote))
  vault.onChange((changes) => docs.apply(changes))
  const logs: string[] = []
  const newHub = (): CollabHub => new CollabHub({ vault, docs, store, codec, policy, lingerMs, log: (line) => logs.push(line) })
  const harness: Harness = {
    fixture,
    vault,
    docs,
    hub: newHub(),
    logs,
    docId: (path = NOTE) => docs.docId(path) ?? '',
    session: async (path = NOTE) => (await harness.hub.session(harness.docId(path))) as NoteSession,
    client: async (path = NOTE, access = 'write') => {
      const doc = new Y.Doc()
      const sockets: MemorySocket[] = []
      const provider = new CollabProvider({
        doc,
        retryMs: 1,
        openSocket: async () => {
          sockets.push(await openSocket(harness.hub, harness.docId(path), access))
          return sockets.at(-1) as MemorySocket
        },
      })
      await provider.whenSynced()
      await settle()
      return { doc, provider, sockets, markdown: () => codec.read(doc), type: (anchor, text) => type(doc, anchor, text) }
    },
    restart: async () => {
      await harness.hub.close()
      harness.hub = newHub()
    },
    file: async (path = NOTE) => (await vault.read(path as VaultPath)).bytes.toString('utf8'),
    commits: async () => (await fixture.desktop.log()).filter((subject) => subject !== 'Seed vault'),
    cleanup: async () => {
      await harness.hub.close()
      await vault.idle()
      await fixture.cleanup()
    },
  }
  return harness
}

function type(doc: Y.Doc, anchor: string, text: string): void {
  const target = textContaining(doc, anchor)
  target.insert(target.length, text)
}
