import { NoteCodec } from '../../../../packages/markdown-yjs/src/index.ts'
import { RejectedChange } from '../../../../packages/protocol/src/collabWire.ts'
import { COLLAB_CLOSE, type CollabAccess } from '../../../../packages/protocol/src/index.ts'
import type { DocId, DocIndex } from '../docIndex.ts'
import type { CoAuthor } from '../coAuthors.ts'
import type { VaultChange } from '../gitSync.ts'
import type { VaultPath } from '../paths.ts'
import type { BlobStore } from '../store.ts'
import type { Vault } from '../vault.ts'
import type { FlushPolicy, Timers } from './flush.ts'
import { NoteSession } from './noteSession.ts'
import type { Peer } from './room.ts'
import { SnapshotStore } from './snapshots.ts'

export interface HubOptions {
  vault: Vault
  docs: DocIndex
  store: BlobStore
  /** Built on first use when omitted: it carries a headless editor. */
  codec?: NoteCodec
  policy: FlushPolicy
  /** How long a room without clients stays open, so a reload does not rebuild it. */
  lingerMs: number
  timers?: Timers
  log(message: string): void
}

/** The server's end of one websocket. */
export interface Socket {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
}

/** What the hub hands back for a connected socket: where its messages and its end go. */
export interface Connection {
  receive(data: Uint8Array): void
  closed(): void
}

interface Open {
  session: NoteSession
  sockets: Set<Socket>
  /** Set while nobody is connected and the room is waiting to be closed. */
  closing: NodeJS.Timeout | null
}

/** Every note that is open for collaboration, by document id. */
export class CollabHub {
  private readonly options: HubOptions
  private readonly snapshots: SnapshotStore
  private readonly open = new Map<DocId, Promise<Open>>()
  private codec: NoteCodec | undefined
  private closed = false
  /** Rooms that are being written and closed because everyone left. */
  private retiring: Promise<void> = Promise.resolve()

  constructor(options: HubOptions) {
    this.options = options
    this.snapshots = new SnapshotStore(options.store)
    this.codec = options.codec
    options.vault.onChange((changes) => this.fileChanges(changes))
  }

  /**
   * Puts a websocket into the room of a document; the commits of its edits name `coAuthors`.
   * Null when there is no such document, or the hub has closed.
   */
  async connect(docId: DocId, socket: Socket, access: CollabAccess, coAuthors: readonly CoAuthor[] = []): Promise<Connection | null> {
    const entry = await this.entry(docId)
    if (!entry) return null
    const peer: Peer = { readOnly: access === 'read', coAuthors, send: (data) => socket.send(data) }
    if (entry.closing) clearTimeout(entry.closing)
    entry.closing = null
    entry.sockets.add(socket)
    entry.session.room.join(peer)
    return {
      receive: (data) => this.receive(entry, { socket, peer }, data),
      closed: () => this.disconnect(docId, entry, { socket, peer }),
    }
  }

  /** The open session of a document, for tests and tools. */
  async session(docId: DocId): Promise<NoteSession | undefined> {
    return (await this.open.get(docId))?.session
  }

  /** Writes every open document to its file and closes the rooms. */
  async close(): Promise<void> {
    this.closed = true
    await this.retiring
    const entries = await Promise.all(this.open.values())
    this.open.clear()
    for (const entry of entries) await this.closeEntry(entry, 'server shutting down')
  }

  private entry(docId: DocId): Promise<Open | null> {
    if (this.closed) return Promise.resolve(null)
    const existing = this.open.get(docId)
    if (existing) return existing
    const path = this.options.docs.pathOf(docId)
    if (!path) return Promise.resolve(null)
    const opening = this.openEntry(docId, path)
    this.open.set(docId, opening)
    // A document that fails to open must not stay in the way of the next attempt.
    opening.catch(() => this.open.delete(docId))
    return opening
  }

  private async openEntry(docId: DocId, path: VaultPath): Promise<Open> {
    const { vault, policy, timers, log } = this.options
    this.codec ??= new NoteCodec()
    const services = { vault, codec: this.codec, policy, timers, log, snapshots: this.snapshots }
    return { session: await NoteSession.open({ docId, path }, services), sockets: new Set(), closing: null }
  }

  private receive(entry: Open, { socket, peer }: { socket: Socket; peer: Peer }, data: Uint8Array): void {
    try {
      entry.session.room.receive(peer, data)
    } catch (error) {
      if (error instanceof RejectedChange) socket.close(COLLAB_CLOSE.rejectedChange, 'the change is not valid for this document')
      else socket.close(COLLAB_CLOSE.invalidMessage, 'invalid message')
    }
  }

  private disconnect(docId: DocId, entry: Open, { socket, peer }: { socket: Socket; peer: Peer }): void {
    entry.session.room.leave(peer)
    entry.sockets.delete(socket)
    if (entry.sockets.size > 0 || entry.closing) return
    entry.closing = setTimeout(() => this.retire(docId, entry), this.options.lingerMs)
  }

  private retire(docId: DocId, entry: Open): void {
    this.open.delete(docId)
    const closing = this.closeEntry(entry, 'idle').catch((error: unknown) => {
      this.options.log(`collab: closing ${entry.session.path} failed: ${error instanceof Error ? error.message : String(error)}`)
    })
    this.retiring = this.retiring.then(() => closing)
  }

  /** Resolves when no room is in the middle of being closed. */
  async idle(): Promise<void> {
    await this.retiring
  }

  private async closeEntry(entry: Open, reason: string): Promise<void> {
    if (entry.closing) clearTimeout(entry.closing)
    for (const socket of entry.sockets) socket.close(1001, reason)
    await entry.session.close()
  }

  /** Called with the vault lock held. */
  private async fileChanges(changes: VaultChange[]): Promise<void> {
    for (const change of changes) await this.fileChange(change)
  }

  private async fileChange(change: VaultChange): Promise<void> {
    if (change.kind === 'rename') return this.moved(change.from, change.to)
    const found = await this.byPath(change.path)
    if (!found) return
    if (change.kind === 'upsert') return this.changed(found.entry.session, change)
    await this.gone(found.docId, found.entry)
  }

  /** A rename's link rewrite is patched into the document; any other change is reconciled. */
  private changed(session: NoteSession, { links, conflictCopy }: Extract<VaultChange, { kind: 'upsert' }>): Promise<void> {
    return links ? session.relink(links) : session.fileChanged(conflictCopy)
  }

  private async moved(from: VaultPath, to: VaultPath): Promise<void> {
    const found = await this.byPath(from)
    if (found) found.entry.session.path = to
  }

  /**
   * The note was deleted. Its room closes; clients find the note again by path if it returns.
   * Edits that were not in the file yet are written back, which restores the note with them.
   */
  private async gone(docId: DocId, entry: Open): Promise<void> {
    const { vault, log } = this.options
    const { session } = entry
    this.open.delete(docId)
    if (entry.closing) clearTimeout(entry.closing)
    const unwritten = await session.unwritten()
    for (const socket of entry.sockets) socket.close(COLLAB_CLOSE.gone, 'the note was deleted')
    session.discard()
    await this.snapshots.delete(docId)
    if (!unwritten) return
    // Queued behind the operation that reported the deletion: the vault lock is held right now.
    const precondition = { kind: 'match', etag: unwritten.revision } as const
    const restore = vault.write(session.path, Buffer.from(unwritten.markdown), precondition, session.takeCoAuthors())
    restore.catch((error: unknown) => log(`collab: restoring ${session.path} failed: ${String(error)}`))
  }

  private async byPath(path: VaultPath): Promise<{ docId: DocId; entry: Open } | null> {
    for (const [docId, opening] of this.open) {
      const entry = await opening.catch(() => null)
      if (entry?.session.path === path) return { docId, entry }
    }
    return null
  }
}
