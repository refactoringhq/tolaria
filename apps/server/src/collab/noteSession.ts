import * as Y from 'yjs'
import { type NoteCodec, type NoteVersion, reconcile, setRevision } from '../../../../packages/markdown-yjs/src/index.ts'
import { DOC_FORMAT, DOC_META, DOC_META_MAP } from '../../../../packages/protocol/src/index.ts'
import { type CoAuthor, CoAuthors } from '../coAuthors.ts'
import type { DocId } from '../docIndex.ts'
import { blobEtag, type VaultPath } from '../paths.ts'
import { type LinkRewrites, rewriteLinks } from '../renameLinks.ts'
import type { StoredFile, Vault } from '../vault.ts'
import { type FlushPolicy, FlushScheduler, type Timers } from './flush.ts'
import { patchLiveLinks } from './liveLinks.ts'
import { type Peer, Room } from './room.ts'
import type { SnapshotStore } from './snapshots.ts'

/** Origin of the changes the server itself makes to a document; they are not user edits. */
const SERVER_ORIGIN = { name: 'tolaria-server' }

export interface SessionServices {
  vault: Vault
  codec: NoteCodec
  snapshots: SnapshotStore
  policy: FlushPolicy
  timers?: Timers
  log(message: string): void
}

export interface SessionTarget {
  docId: DocId
  path: VaultPath
}

/** What a flush did: `skipped` when the document says what the file already says. */
export type FlushOutcome = 'written' | 'skipped' | 'conflict'

/** The file version a document is in step with, and how the serializer renders it. */
interface Base extends NoteVersion {
  canonical: string
}

function utf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8')
}

/**
 * One note that is open for collaboration: its room, and the link between the live document
 * and the markdown file. It writes edits to the file on a cadence (`flush`) and takes in
 * changes that reach the file from git (`fileChanged`), so both stay one note.
 */
export class NoteSession {
  readonly room: Room
  readonly docId: DocId
  path: VaultPath
  private readonly services: SessionServices
  private readonly scheduler: FlushScheduler
  private base: Base = { markdown: '', revision: '', canonical: '' }
  /** Etag of the content a flush is writing right now: the change it causes is our own. */
  private writing: string | null = null
  /** Path of the conflict copy of the last fork, as announced in `meta`. */
  private conflictCopy: string | null = null
  /** Who edited the document since it was last written: the next commit names them. */
  private readonly editors = new CoAuthors()
  private work: Promise<unknown> = Promise.resolve()

  private constructor({ docId, path }: SessionTarget, services: SessionServices) {
    this.docId = docId
    this.path = path
    this.services = services
    this.room = new Room((doc) => services.codec.violation(doc))
    this.scheduler = new FlushScheduler(services.policy, () => this.background(() => this.flush()), services.timers)
  }

  /** Opens the document from its snapshot, or builds it from the markdown file. */
  static async open(target: SessionTarget, services: SessionServices): Promise<NoteSession> {
    const session = new NoteSession(target, services)
    const file = await services.vault.read(target.path)
    const snapshot = await services.snapshots.load(target.docId)
    if (snapshot) {
      Y.applyUpdate(session.doc, snapshot.state, SERVER_ORIGIN)
      await session.rebase(snapshot.base)
      await session.takeIn(file)
    } else {
      await session.adopt({ markdown: utf8(file.bytes), revision: file.etag })
    }
    session.doc.on('update', (_update: Uint8Array, origin: unknown) => session.edited(origin))
    session.meta.observe((event) => session.guardMeta(event.transaction.origin))
    return session
  }

  get doc(): Y.Doc {
    return this.room.doc
  }

  private get meta(): Y.Map<string> {
    return this.doc.getMap<string>(DOC_META_MAP)
  }

  /** True while the document holds edits that are not in the file. */
  get dirty(): boolean {
    return this.services.codec.read(this.doc) !== this.base.canonical
  }

  /**
   * Writes the document to its file if it differs: one pull, one commit, one push, with the
   * untouched lines of the file byte-identical.
   */
  async flush(): Promise<FlushOutcome> {
    this.scheduler.reset()
    const plan: { written: Base | null } = { written: null }
    // Filled once the document is read, so whoever edits after that is named by the next write.
    const coAuthors: CoAuthor[] = []
    const result = await this.services.vault
      .update(
        this.path,
        async (current) => {
          plan.written = await this.fileContent(current)
          // With the file there, the document is either written now or says what the file says.
          if (current) coAuthors.push(...this.editors.take())
          return plan.written ? Buffer.from(plan.written.markdown) : null
        },
        coAuthors,
      )
      .catch((error: unknown) => {
        this.editors.add(coAuthors)
        throw error
      })
    this.writing = null
    if (!result || !plan.written) return 'skipped'
    // A commit that landed mid-write took the path; the file change it caused was reconciled.
    if (result.outcome === 'conflict') return 'conflict'
    this.rebaseTo(plan.written)
    await this.saveSnapshot()
    return 'written'
  }

  /**
   * The note's file changed. Called with the vault lock held, so it must not write to the
   * vault; a conflict copy is written once the lock is free. `conflictCopy` names the copy a
   * replay already saved of a version that crossed the file's (see `GitSync`).
   */
  async fileChanged(conflictCopy?: VaultPath): Promise<void> {
    await this.takeIn(await this.services.vault.read(this.path))
    if (conflictCopy) this.announceCopy(conflictCopy)
  }

  /**
   * A rename rewrote the note's wikilinks in its file. Called with the vault lock held. The
   * document gets the same rewrite as a targeted patch (see `patchLiveLinks`), so it keeps
   * any edit not written yet, and moves on to the new file revision. When the patch and the
   * file rewrite do not line up exactly, the file is reconciled like any other change.
   */
  async relink(rewrite: LinkRewrites): Promise<void> {
    const { codec, vault } = this.services
    const file = await vault.read(this.path)
    const markdown = utf8(file.bytes)
    const canonical = await codec.canonical(markdown)
    // From here to the rebase only microtasks run: no edit can arrive in between.
    const live = codec.read(this.doc)
    this.doc.transact(() => patchLiveLinks(this.doc, rewrite), SERVER_ORIGIN)
    const exact = codec.read(this.doc) === rewriteLinks(live, rewrite)
    if (exact && this.rewritesBaseTo({ markdown, canonical }, rewrite)) this.rebaseTo({ markdown, canonical, revision: file.etag })
    else await this.takeIn(file)
  }

  /** True when `next` is the file the document was in step with, after the rewrite. */
  private rewritesBaseTo(next: Omit<Base, 'revision'>, rewrite: LinkRewrites): boolean {
    const { markdown, canonical } = this.base
    return rewriteLinks(markdown, rewrite) === next.markdown && rewriteLinks(canonical, rewrite) === next.canonical
  }

  /**
   * The file is gone. Returns the document's unwritten edits as file content, if it has any,
   * based on the revision that was deleted: written back, the edit wins and the note returns.
   */
  async unwritten(): Promise<NoteVersion | null> {
    const { codec } = this.services
    const canonical = codec.read(this.doc)
    if (canonical === this.base.canonical) return null
    const versions = { source: this.base.markdown, canonicalSource: this.base.canonical, canonical }
    return { markdown: (await codec.fileContent(versions)).markdown, revision: this.base.revision }
  }

  /** Who edited the document since it was last written, forgotten here: for writing it elsewhere. */
  takeCoAuthors(): CoAuthor[] {
    return this.editors.take()
  }

  /** Resolves when background work (scheduled flushes, conflict copies) has finished. */
  async settled(): Promise<void> {
    await this.work
  }

  /** Writes what is pending, stores the snapshot and frees the room. */
  async close(): Promise<void> {
    this.scheduler.reset()
    await this.settled()
    await this.flush()
    await this.saveSnapshot()
    this.room.destroy()
  }

  /** Stops without writing: the note no longer exists. */
  discard(): void {
    this.scheduler.reset()
    this.room.destroy()
  }

  /**
   * `meta` is the server's to write: clients read the revision and the conflict copy from it.
   * A change to it from anyone else is put back at once, and the correction goes to everyone.
   */
  private guardMeta(origin: unknown): void {
    if (origin === SERVER_ORIGIN) return
    const owned = new Map<string, string>([
      [DOC_META.format, DOC_FORMAT],
      [DOC_META.baseRevision, this.base.revision],
    ])
    if (this.conflictCopy) owned.set(DOC_META.conflictCopy, this.conflictCopy)
    this.doc.transact(() => {
      for (const key of [...this.meta.keys()]) {
        if (!owned.has(key)) this.meta.delete(key)
      }
      for (const [key, value] of owned) {
        if (this.meta.get(key) !== value) this.meta.set(key, value)
      }
    }, SERVER_ORIGIN)
  }

  /** Changes come from the server itself or from a peer, which is then their origin. */
  private edited(origin: unknown): void {
    if (origin === SERVER_ORIGIN) return
    this.scheduler.touch()
    this.editors.add((origin as Peer | null)?.coAuthors ?? [])
  }

  /** Computed after the pull, with nothing but microtasks between reading the document and returning. */
  private async fileContent(current: StoredFile | null): Promise<Base | null> {
    const { codec } = this.services
    const canonical = codec.read(this.doc)
    // A deleted note is handled where the deletion is reported, not here.
    if (!current || canonical === this.base.canonical) return null
    const versions = { source: this.base.markdown, canonicalSource: this.base.canonical, canonical }
    const { markdown } = await codec.fileContent(versions)
    return this.announce({ markdown, canonical })
  }

  private announce({ markdown, canonical }: Omit<Base, 'revision'>): Base {
    const revision = blobEtag(Buffer.from(markdown))
    this.writing = revision
    return { markdown, canonical, revision }
  }

  /** Brings the document in step with a version of the file it has not seen. */
  private async takeIn(file: StoredFile): Promise<void> {
    if (file.etag === this.base.revision || file.etag === this.writing) return
    const { codec } = this.services
    const incoming: NoteVersion = { markdown: utf8(file.bytes), revision: file.etag }
    const canonical = await codec.canonical(incoming.markdown)
    // From here to the end of each branch only microtasks run: no edit can arrive in between.
    const outcome = reconcile({ base: this.base.canonical, live: codec.read(this.doc), incoming: canonical })
    if (outcome.kind === 'conflict') return this.fork({ ...incoming, canonical })
    if (outcome.kind === 'adopt') return this.adopt(incoming)
    if (outcome.kind === 'merged') await codec.write(this.doc, { ...incoming, markdown: outcome.markdown }, SERVER_ORIGIN)
    this.rebaseTo({ ...incoming, canonical })
    if (outcome.kind === 'merged') this.scheduler.touch()
  }

  /** The document becomes the file. */
  private async adopt(version: NoteVersion): Promise<void> {
    await this.services.codec.write(this.doc, version, SERVER_ORIGIN)
    this.rebaseTo({ ...version, canonical: this.services.codec.read(this.doc) })
  }

  /**
   * The file and the document changed the same lines. The document keeps its edits: the
   * people typing in it lose nothing under their cursor. It moves on to the incoming file as
   * its base and is written over it, and the incoming version is then committed next to it
   * as a conflict copy, named in `meta` so editors are told. Nothing is dropped.
   */
  private fork(incoming: Base): void {
    this.rebaseTo(incoming)
    this.background(() => this.keepIncomingAsCopy(incoming))
  }

  /** Runs once the vault lock is free: the document takes the path, the incoming version a copy. */
  private async keepIncomingAsCopy(incoming: NoteVersion): Promise<void> {
    const { vault } = this.services
    await this.flush()
    const copy = await vault.write(this.path, Buffer.from(incoming.markdown), { kind: 'match', etag: incoming.revision })
    if (copy.outcome !== 'conflict') return
    this.announceCopy(copy.path)
  }

  /** Names the conflict copy of the note in `meta`, so editors are told. */
  private announceCopy(path: string): void {
    this.services.log(`collab: ${this.path} changed on both sides; the incoming version is saved as ${path}`)
    this.conflictCopy = path
    this.doc.transact(() => this.meta.set(DOC_META.conflictCopy, path), SERVER_ORIGIN)
  }

  private async rebase(version: NoteVersion): Promise<void> {
    this.base = { ...version, canonical: await this.services.codec.canonical(version.markdown) }
  }

  private rebaseTo(base: Base): void {
    this.base = base
    this.doc.transact(() => setRevision(this.doc, base.revision), SERVER_ORIGIN)
  }

  private async saveSnapshot(): Promise<void> {
    const { markdown, revision } = this.base
    await this.services.snapshots.save(this.docId, { state: Y.encodeStateAsUpdate(this.doc), base: { markdown, revision } })
  }

  /** Runs after everything already queued; a failure is logged, never thrown at a timer. */
  private background(task: () => Promise<unknown>): void {
    this.work = this.work.then(task).catch((error: unknown) => {
      this.services.log(`collab: background work on ${this.path} failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  }
}
