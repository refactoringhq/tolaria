import { basename } from 'node:path'
import type {
  DeleteResult,
  FileEntry,
  FolderCreateResult,
  FolderDeleteResult,
  FolderRenameResult,
  ListResponse,
  RenameResult,
  SearchResponse,
  SyncResult,
  WriteOutcome,
  WriteResult,
} from '../../../packages/protocol/src/index.ts'
import type { CoAuthor } from './coAuthors.ts'
import { notFound, stale, VaultError } from './errors.ts'
import { GitRepo, REMOTE, type RepoOptions } from './gitRepo.ts'
import { GitSync, type VaultChange } from './gitSync.ts'
import { blobEtag, conflictCopyPath, type VaultPath } from './paths.ts'
import { type StagedFolderChange, stageFolderCreate, stageFolderDelete } from './folderLifecycle.ts'
import { FolderRenameTransaction } from './folderRenameTransaction.ts'
import { type RenameOptions, RenameTransaction } from './renameTransaction.ts'
import { searchVault } from './search.ts'

export interface VaultOptions extends RepoOptions {
  now?: () => Date
  log?: (message: string) => void
  /** Debounce delay in ms before pushing commits. 0 disables debounced push. */
  pushDebounceMs?: number
  /** Interval in ms between background fetch operations. 0 disables background fetch. */
  fetchIntervalMs?: number
  /** Called when vault changes occur (commits, pulls, pushes). */
  onVaultEvent?: (event: { type: 'commit' | 'pull' | 'push-success' | 'push-failed'; head: string; paths?: string[]; error?: string }) => void
}

/** Revision of a file's content: its git blob id. */
export type Etag = string

interface Placement {
  outcome: WriteOutcome
  path: VaultPath
}

/** The revision a write is based on: the HTTP precondition of the request. */
export type WritePrecondition =
  /** `If-Match: "<etag>"`: the client edited this revision. */
  | { kind: 'match'; etag: Etag }
  /** `If-None-Match: *`: the client believes the file does not exist yet. */
  | { kind: 'absent' }
  /** `If-Match: *`: explicit last-write-wins overwrite. */
  | { kind: 'any' }

export interface Timings {
  pullMs: number
  commitMs: number
  pushMs: number
}

export type TimedWriteResult = WriteResult & { timings: Timings }

/** The stored version of a file, handed to a `FileProducer`. */
export interface StoredFile {
  bytes: Buffer
  etag: Etag
}

/** Computes the new content of a file from what is stored (null: no such file), or null to skip. */
export type FileProducer = (current: StoredFile | null) => Promise<Uint8Array | null>

interface PendingWrite {
  path: VaultPath
  bytes: Uint8Array
  precondition: WritePrecondition
  coAuthors: readonly CoAuthor[]
}

interface PullClock {
  started: number
  pulled: number
}

/**
 * Who a change was made with, besides the owner who commits it (ADR 0297). Empty for the owner,
 * whose commits stay as they were. Read when the commit is made, so a `FileProducer` may add to it.
 */
export type CommitCoAuthors = readonly CoAuthor[]

/** Called with the vault lock held, for every change to the vault's files. */
export type ChangeListener = (changes: VaultChange[]) => Promise<void>

const SYMLINK_MODE = '120000'
/** A full commit id (SHA-1 or SHA-256): never an option or a revision expression. */
const COMMIT_ID = /^([0-9a-f]{40}|[0-9a-f]{64})$/

function createOutcome(precondition: WritePrecondition): WriteOutcome {
  // The client edited a file that has since been deleted: its edit wins and the file returns.
  if (precondition.kind === 'match') return 'recreated'
  return 'created'
}

function overwriteOutcome(current: Etag, precondition: WritePrecondition): WriteOutcome {
  if (precondition.kind === 'any') return 'updated'
  if (precondition.kind === 'match' && precondition.etag === current) return 'updated'
  return 'conflict'
}

/** Decides what a write does from the stored revision, the new one and the client's base. */
export function writeOutcome(
  current: Etag | null,
  incoming: Etag,
  precondition: WritePrecondition,
): WriteOutcome {
  if (current === incoming) return 'unchanged'
  return current === null ? createOutcome(precondition) : overwriteOutcome(current, precondition)
}

function commitMessage(outcome: WriteOutcome, path: VaultPath): string {
  if (outcome === 'conflict') return `Conflict copy of ${path}`
  return `${outcome === 'updated' ? 'Update' : 'Create'} ${path}`
}

/** The paths a change touches, for the change feed. */
function changedPaths(change: VaultChange): VaultPath[] {
  if (change.kind === 'rename') return [change.from, change.to]
  return [change.path]
}

function parseTreeRecord(record: string): FileEntry | null {
  const tab = record.indexOf('\t')
  if (tab < 0) return null
  // `<mode> <type> <object> <size>`, the size padded with spaces.
  const [mode, type, etag, size] = record.slice(0, tab).split(' ').filter(Boolean)
  if (type !== 'blob' || mode === SYMLINK_MODE) return null
  return { path: record.slice(tab + 1), size: Number(size), etag }
}

const DEFAULT_PUSH_DEBOUNCE_MS = 2000
const DEFAULT_FETCH_INTERVAL_MS = 30000

type VaultSettings = Required<Pick<VaultOptions, 'now' | 'log' | 'pushDebounceMs' | 'fetchIntervalMs'>>

function vaultSettings(options: VaultOptions): VaultSettings {
  return {
    now: options.now ?? (() => new Date()),
    log: options.log ?? (() => {}),
    pushDebounceMs: options.pushDebounceMs ?? DEFAULT_PUSH_DEBOUNCE_MS,
    fetchIntervalMs: options.fetchIntervalMs ?? DEFAULT_FETCH_INTERVAL_MS,
  }
}

/**
 * One vault = one git working clone owned by this process. Every mutation runs under a
 * single lock as: fetch + integrate upstream, change files, commit. Push happens
 * asynchronously on a debounce timer.
 */
export class Vault {
  private readonly repo: GitRepo
  private readonly sync: GitSync
  private readonly now: () => Date
  private readonly listeners: ChangeListener[] = []
  private readonly log: (message: string) => void
  private readonly pushDebounceMs: number
  private readonly fetchIntervalMs: number
  private readonly onVaultEvent?: (event: { type: 'commit' | 'pull' | 'push-success' | 'push-failed'; head: string; paths?: string[]; error?: string }) => void
  private pushTimer: NodeJS.Timeout | null = null
  private fetchTimer: NodeJS.Timeout | null = null
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(repo: GitRepo, options: VaultOptions) {
    const settings = vaultSettings(options)
    this.repo = repo
    this.now = settings.now
    this.log = settings.log
    this.pushDebounceMs = settings.pushDebounceMs
    this.fetchIntervalMs = settings.fetchIntervalMs
    this.onVaultEvent = options.onVaultEvent
    this.sync = new GitSync(repo, {
      log: this.log,
      conflictPath: (path) => this.conflictPath(path),
      onChanges: (changes) => this.emit(changes),
    })
  }

  static async open(options: VaultOptions): Promise<Vault> {
    const vault = new Vault(await GitRepo.open(options), options)
    if (vault.fetchIntervalMs > 0) {
      vault.startBackgroundFetch()
    }
    return vault
  }

  onChange(listener: ChangeListener): void {
    this.listeners.push(listener)
  }

  async info(): Promise<{ name: string; branch: string; head: string }> {
    const url = (await this.repo.run(['remote', 'get-url', REMOTE])).stdout.trim()
    const name = basename(url).replace(/\.git$/, '')
    return { name, branch: this.repo.branch, head: await this.repo.head() }
  }

  async list(prefix = ''): Promise<ListResponse> {
    const head = await this.repo.head()
    const tree = await this.repo.run(['ls-tree', '-r', '-l', '-z', head])
    const files: FileEntry[] = []
    for (const record of tree.stdout.split('\0')) {
      const entry = parseTreeRecord(record)
      if (entry?.path.startsWith(prefix)) files.push(entry)
    }
    return { head, files }
  }

  async read(path: VaultPath): Promise<{ bytes: Buffer; etag: string }> {
    const bytes = await this.repo.readIfExists(path)
    if (!bytes) throw notFound(path)
    return { bytes, etag: blobEtag(bytes) }
  }

  write(path: VaultPath, bytes: Uint8Array, precondition: WritePrecondition, coAuthors: CommitCoAuthors = []): Promise<TimedWriteResult> {
    return this.locked(async () => {
      const started = performance.now()
      await this.sync.pull()
      return this.storeAndPush({ path, bytes, precondition, coAuthors }, { started, pulled: performance.now() })
    })
  }

  /**
   * Rewrites a file with content computed from its current state. `produce` runs under the
   * lock and after the pull, so what it is given is what the write replaces: a change from
   * the git remote cannot slip in between. Returning null leaves the file alone.
   */
  update(path: VaultPath, produce: FileProducer, coAuthors: CommitCoAuthors = []): Promise<TimedWriteResult | null> {
    return this.locked(async () => {
      const started = performance.now()
      await this.sync.pull()
      const pulled = performance.now()
      const current = await this.repo.readIfExists(path)
      const bytes = await produce(current ? { bytes: current, etag: blobEtag(current) } : null)
      if (!bytes) return null
      const precondition: WritePrecondition = current ? { kind: 'match', etag: blobEtag(current) } : { kind: 'absent' }
      return this.storeAndPush({ path, bytes, precondition, coAuthors }, { started, pulled })
    })
  }

  private async storeAndPush(pending: PendingWrite, clock: PullClock): Promise<TimedWriteResult> {
    const { path, bytes } = pending
    const stored = await this.store(pending)
    const committed = performance.now()

    const head = await this.repo.head()
    this.onVaultEvent?.({ type: 'commit', head, paths: [stored.path] })

    // When pushDebounceMs is 0, push inline immediately
    if (this.pushDebounceMs === 0) {
      this.sync.relocated.clear()
      const pushed = await this.sync.push()
      const moved = this.sync.relocated.get(stored.path)
      const placed: Placement = moved ? { outcome: 'conflict', path: moved } : stored
      const timings = {
        pullMs: clock.pulled - clock.started,
        commitMs: committed - clock.pulled,
        pushMs: performance.now() - committed,
      }
      if (pushed) {
        this.onVaultEvent?.({ type: 'push-success', head: await this.repo.head() })
      } else {
        this.onVaultEvent?.({ type: 'push-failed', head, error: 'push to remote failed' })
      }
      return { ...(await this.writeResult(path, bytes, placed, pushed)), timings }
    }

    // Otherwise, schedule background push
    this.schedulePush()
    this.sync.relocated.clear()
    const moved = this.sync.relocated.get(stored.path)
    const placed: Placement = moved ? { outcome: 'conflict', path: moved } : stored
    const timings = {
      pullMs: clock.pulled - clock.started,
      commitMs: committed - clock.pulled,
      pushMs: 0,
    }
    return { ...(await this.writeResult(path, bytes, placed, false)), timings }
  }

  /**
   * Moves a note in one commit; with `rewriteLinks`, the wikilinks to it in every other note
   * are rewritten in that same commit (see `RenameTransaction`).
   */
  rename(from: VaultPath, to: VaultPath, options: RenameOptions = {}, coAuthors: CommitCoAuthors = []): Promise<RenameResult> {
    return this.locked(async () => {
      await this.sync.pull()
      const { files } = await this.list()
      const staged = await new RenameTransaction(this.repo, { ...options, from, to }).stage(files.map((file) => file.path as VaultPath))
      await this.repo.commitStaged(staged.message, coAuthors)
      await this.emit(staged.changes)
      const head = await this.repo.head()
      this.onVaultEvent?.({ type: 'commit', head, paths: [from, to, ...staged.rewritten] })
      const pushed = await this.pushNow(head)
      const path = this.sync.relocated.get(to) ?? to
      const result: RenameResult = { from, path, etag: staged.etag, commit: await this.repo.head(), pushed }
      return options.rewriteLinks ? { ...result, rewritten: staged.rewritten } : result
    })
  }

  /**
   * Moves every file of a folder in one commit; with `rewriteLinks`, the wikilinks that reach
   * a moved note by its path are rewritten in that same commit (see `FolderRenameTransaction`).
   */
  async renameFolder(
    from: VaultPath,
    to: VaultPath,
    options: { rewriteLinks?: boolean } = {},
    coAuthors: CommitCoAuthors = [],
  ): Promise<FolderRenameResult> {
    const transaction = new FolderRenameTransaction(this.repo, { ...options, from, to })
    const { staged, commit, pushed } = await this.commitFolderChange((files) => transaction.stage(files), coAuthors)
    const result: FolderRenameResult = { from, path: to, commit, pushed, moved: staged.moved }
    return options.rewriteLinks ? { ...result, rewritten: staged.rewritten } : result
  }

  /** Creates an empty folder in one commit: git keeps it through its `.keep` file. */
  async createFolder(path: VaultPath, coAuthors: CommitCoAuthors = []): Promise<FolderCreateResult> {
    const { commit, pushed } = await this.commitFolderChange((files) => stageFolderCreate(this.repo, files, path), coAuthors)
    return { path, commit, pushed }
  }

  /** Deletes every file of a folder in one commit; live documents of its notes close. */
  async deleteFolder(path: VaultPath, coAuthors: CommitCoAuthors = []): Promise<FolderDeleteResult> {
    const { staged, commit, pushed } = await this.commitFolderChange((files) => stageFolderDelete(this.repo, files, path), coAuthors)
    return { path, commit, pushed, deleted: staged.deleted }
  }

  /** Stages a folder change from the tracked files after the pull, commits it once and pushes it. */
  private commitFolderChange<T extends StagedFolderChange>(
    stage: (files: VaultPath[]) => Promise<T>,
    coAuthors: CommitCoAuthors,
  ): Promise<{ staged: T; commit: string; pushed: boolean }> {
    return this.locked(async () => {
      await this.sync.pull()
      const { files } = await this.list()
      const staged = await stage(files.map((file) => file.path as VaultPath))
      await this.repo.commitStaged(staged.message, coAuthors)
      await this.emit(staged.changes)
      const head = await this.repo.head()
      this.onVaultEvent?.({ type: 'commit', head, paths: staged.changes.flatMap(changedPaths) })
      const pushed = await this.pushNow(head)
      return { staged, commit: await this.repo.head(), pushed }
    })
  }

  /** Pushes at once when there is no push debounce; otherwise schedules it. True once pushed. */
  private async pushNow(head: string): Promise<boolean> {
    this.sync.relocated.clear()
    if (this.pushDebounceMs !== 0) {
      this.schedulePush()
      return false
    }
    const pushed = await this.sync.push()
    if (pushed) this.onVaultEvent?.({ type: 'push-success', head: await this.repo.head() })
    else this.onVaultEvent?.({ type: 'push-failed', head, error: 'push to remote failed' })
    return pushed
  }

  remove(path: VaultPath, ifMatch: Etag, coAuthors: CommitCoAuthors = []): Promise<DeleteResult> {
    return this.locked(async () => {
      await this.sync.pull()
      await this.currentEtag(path, ifMatch)
      await this.repo.run(['rm', '-q', '--', path])
      await this.repo.commitStaged(`Delete ${path}`, coAuthors)
      await this.emit([{ kind: 'delete', path }])
      
      const head = await this.repo.head()
      this.onVaultEvent?.({ type: 'commit', head, paths: [path] })
      
      if (this.pushDebounceMs === 0) {
        const pushed = await this.sync.push()
        if (pushed) {
          this.onVaultEvent?.({ type: 'push-success', head: await this.repo.head() })
        } else {
          this.onVaultEvent?.({ type: 'push-failed', head, error: 'push to remote failed' })
        }
        return { path, commit: await this.repo.head(), pushed }
      }
      
      this.schedulePush()
      return { path, commit: await this.repo.head(), pushed: false }
    })
  }

  async search(query: string, limit: number): Promise<SearchResponse> {
    const { files } = await this.list()
    return searchVault(this.repo, files, query, limit)
  }

  /** Pull, then push anything still pending. Clients call this to pick up desktop pushes. */
  syncNow(): Promise<SyncResult> {
    return this.locked(async () => {
      const pulled = await this.sync.pull()
      const pushed = await this.sync.push()
      return { head: await this.repo.head(), pulled, pushed }
    })
  }

  /** Resolves once every queued operation has finished. */
  async idle(): Promise<void> {
    await this.queue
  }

  /** Returns paths that changed between two commits. */
  async diff(from: string, to: string): Promise<string[]> {
    const result = await this.repo.run(['diff', '--name-only', '-z', `${from}..${to}`])
    return result.stdout.split('\0').filter(Boolean)
  }

  /**
   * The file changes from `commit` to the head, for bringing an index saved at `commit` up to
   * date. Null when that is not worth it or not possible: `commit` is not in this clone (for
   * example after a force push), or more than `limit` files changed.
   */
  async changesSince(commit: string, limit: number): Promise<VaultChange[] | null> {
    if (!COMMIT_ID.test(commit)) return null
    let output: string
    try {
      output = (await this.repo.run(['diff', '--name-status', '--no-renames', '-z', commit, await this.repo.head()])).stdout
    } catch {
      return null
    }
    // `<status>\0<path>\0` per file.
    const fields = output.split('\0')
    const changes: VaultChange[] = []
    for (let i = 0; i + 1 < fields.length; i += 2) {
      const path = fields[i + 1] as VaultPath
      changes.push(fields[i] === 'D' ? { kind: 'delete', path } : { kind: 'upsert', path })
    }
    return changes.length > limit ? null : changes
  }

  /** Commits any staged changes and pushes with retry. Logs failures. Used on shutdown. */
  async flushAndPush(): Promise<void> {
    return this.locked(async () => {
      this.stopBackgroundFetch()
      this.cancelPushTimer()
      await this.repo.commitStaged('Server shutdown: flush pending changes')
      const pushed = await this.sync.push()
      if (!pushed) {
        const ahead = await this.repo.run(['rev-list', '--count', `${this.repo.upstream}..HEAD`])
        const unpushedCount = ahead.stdout.trim()
        this.log(`WARNING: failed to push ${unpushedCount} commit(s) on shutdown; they remain local only`)
      }
    })
  }

  private startBackgroundFetch(): void {
    this.fetchTimer = setInterval(() => {
      this.backgroundFetch()
    }, this.fetchIntervalMs)
  }

  private stopBackgroundFetch(): void {
    if (this.fetchTimer !== null) {
      clearInterval(this.fetchTimer)
      this.fetchTimer = null
    }
  }

  private backgroundFetch(): void {
    this.locked(async () => {
      const before = await this.repo.head()
      const pulled = await this.sync.pull()
      if (pulled) {
        const after = await this.repo.head()
        if (before !== after) {
          this.onVaultEvent?.({ type: 'pull', head: after })
        }
      }
    }).catch((error: unknown) => {
      this.log(`background fetch error: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  private schedulePush(): void {
    if (this.pushDebounceMs === 0) return
    this.cancelPushTimer()
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      this.backgroundPush()
    }, this.pushDebounceMs)
  }

  private cancelPushTimer(): void {
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
  }

  private backgroundPush(): void {
    this.locked(async () => {
      const head = await this.repo.head()
      const pushed = await this.sync.push()
      if (pushed) {
        this.onVaultEvent?.({ type: 'push-success', head })
      } else {
        this.log('background push failed; will retry on next commit')
        this.onVaultEvent?.({ type: 'push-failed', head, error: 'push to remote failed' })
      }
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      this.log(`background push error: ${message}`)
      this.locked(async () => {
        const head = await this.repo.head()
        this.onVaultEvent?.({ type: 'push-failed', head, error: message })
      }).catch(() => {})
    })
  }

  /** Writes and commits the bytes where the precondition allows: the path or a conflict copy. */
  private async store({ path, bytes, precondition, coAuthors }: PendingWrite): Promise<Placement> {
    const current = await this.repo.readIfExists(path)
    if (!current && this.repo.exists(path)) throw new VaultError(409, 'destination_exists', `${path} is a folder`)
    const outcome = writeOutcome(current ? blobEtag(current) : null, blobEtag(bytes), precondition)
    if (outcome === 'unchanged') return { outcome, path }
    const target = outcome === 'conflict' ? this.conflictPath(path) : path
    await this.repo.commitFile(target, bytes, commitMessage(outcome, path), coAuthors)
    await this.emit([{ kind: 'upsert', path: target }])
    return { outcome, path: target }
  }

  private async writeResult(
    requested: VaultPath,
    bytes: Uint8Array,
    placed: Placement,
    pushed: boolean,
  ): Promise<WriteResult> {
    const result: WriteResult = {
      ...placed,
      etag: blobEtag(bytes),
      commit: await this.repo.head(),
      pushed,
    }
    if (placed.outcome !== 'conflict') return result
    const kept = await this.repo.readIfExists(requested)
    if (kept) result.current = { path: requested, etag: blobEtag(kept) }
    return result
  }

  /** The etag of an existing file, checked against the revision the client last saw. */
  private async currentEtag(path: VaultPath, ifMatch?: Etag): Promise<Etag> {
    const current = await this.repo.readIfExists(path)
    if (!current) throw notFound(path)
    const etag = blobEtag(current)
    if (ifMatch && ifMatch !== etag) throw stale(path, etag)
    return etag
  }

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      try {
        return await fn()
      } catch (error) {
        // An unexpected failure may have left half a change behind; never serve or commit it.
        if (!(error instanceof VaultError)) await this.repo.restoreCleanTree()
        throw error
      }
    })
    this.queue = run.catch(() => {})
    return run
  }

  private async emit(changes: VaultChange[]): Promise<void> {
    if (changes.length === 0) return
    for (const listener of this.listeners) await listener(changes)
  }

  private conflictPath(path: VaultPath): VaultPath {
    return conflictCopyPath(path, this.now(), (candidate) => this.repo.exists(candidate))
  }
}
