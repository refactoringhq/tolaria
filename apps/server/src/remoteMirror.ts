import type { GitRepo } from './gitRepo.ts'
import type { GitSync } from './gitSync.ts'

export type VaultEventType = 'commit' | 'pull' | 'push-success' | 'push-failed'

/** What the change feed hears about: commits, pulls and pushes. */
export interface VaultEvent {
  type: VaultEventType
  head: string
  paths?: string[]
  error?: string
}

/** Runs `fn` with the vault lock held. */
export type Locked = <T>(fn: () => Promise<T>) => Promise<T>

export interface MirrorTiming {
  /** Quiet time after the last commit before it is pushed. 0 pushes inline, under the lock. */
  pushDebounceMs: number
  /** Longest a commit waits for its push while new saves keep resetting the debounce. */
  maxPushDelayMs: number
  /** Longest wait between two attempts of a push that keeps failing. */
  maxPushRetryMs: number
  /** Interval between background fetches. 0 leaves pulls to syncs (and inline writes). */
  fetchIntervalMs: number
}

export interface MirrorContext {
  repo: GitRepo
  sync: GitSync
  locked: Locked
  log: (message: string) => void
  onEvent?: (event: VaultEvent) => void
}

interface PushResult {
  pushed: boolean
  head: string
}

const PUSH_FAILED = 'push to remote failed'

/** For a task that already holds the vault lock. */
const direct: Locked = (fn) => fn()

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Keeps the vault's git remote (GitHub) in step with the working clone, off the save path
 * (ADR 0309). Remote operations run one at a time on their own queue and take the vault lock
 * only for their local steps, so a save never waits for the network: not for a fetch, not for
 * a push, and not for a remote that hangs until git's timeout. Failed pushes are retried with
 * a growing delay until they succeed. With no push debounce, everything runs inline under the
 * vault lock, as before.
 */
export class RemoteMirror {
  private readonly context: MirrorContext
  private readonly timing: MirrorTiming
  private network: Promise<unknown> = Promise.resolve()
  private pushTimer: NodeJS.Timeout | null = null
  private fetchTimer: NodeJS.Timeout | null = null
  private fetching = false
  private stopped = false
  /** When the oldest commit still waiting for its scheduled push was made. */
  private pendingSince: number | null = null
  private failures = 0

  constructor(context: MirrorContext, timing: MirrorTiming) {
    this.context = context
    this.timing = timing
  }

  get inline(): boolean {
    return this.timing.pushDebounceMs === 0
  }

  start(): void {
    if (this.timing.fetchIntervalMs > 0) this.fetchTimer = setInterval(() => this.backgroundFetch(), this.timing.fetchIntervalMs)
  }

  /** No more background fetches or scheduled pushes; `pushNow` and `sync` still work. */
  stop(): void {
    this.stopped = true
    if (this.fetchTimer !== null) clearInterval(this.fetchTimer)
    this.fetchTimer = null
    this.cancelPushTimer()
  }

  emit(event: VaultEvent): void {
    this.context.onEvent?.(event)
  }

  /**
   * Called with the vault lock held, right after a commit. Inline, pushes before returning;
   * otherwise only schedules the push. True once the remote has the commit.
   */
  async committed(head: string, paths: string[]): Promise<boolean> {
    this.emit({ type: 'commit', head, paths })
    if (!this.inline) {
      this.schedulePush()
      return false
    }
    return this.report(await this.pushPending(direct)).pushed
  }

  /** Fetches and integrates, then pushes what is pending. */
  sync(): Promise<{ pulled: boolean; pushed: boolean; head: string }> {
    return this.remote(async (local) => {
      const pulled = await this.fetchAndIntegrate(local)
      const { pushed } = this.report(await this.pushPending(local), false)
      return { pulled, pushed, head: await local(() => this.context.repo.head()) }
    })
  }

  /** Pushes what is pending now, after any remote operation already under way. */
  pushNow(): Promise<boolean> {
    return this.remote(async (local) => this.report(await this.pushPending(local), false).pushed)
  }

  /** Resolves once no remote operation is running or queued. */
  async idle(): Promise<void> {
    await this.network
  }

  /**
   * Inline: the whole task under the vault lock. Otherwise on the network queue, the task
   * taking the lock (through `local`) only for the steps that read or change the clone.
   */
  private remote<T>(task: (local: Locked) => Promise<T>): Promise<T> {
    if (this.inline) return this.context.locked(() => task(direct))
    const run = this.network.then(() => task(this.context.locked))
    this.network = run.catch(() => {})
    return run
  }

  /** Fetches upstream, then integrates it under the lock. False when the remote is unreachable. */
  private async fetchAndIntegrate(local: Locked): Promise<boolean> {
    const { repo, sync } = this.context
    if (!(await sync.fetch())) return false
    await local(async () => {
      const before = await repo.head()
      await sync.integrate()
      const after = await repo.head()
      if (after !== before) this.emit({ type: 'pull', head: after })
    })
    return true
  }

  /** Pushes the head; when the remote moved first, integrates it and tries again. */
  private async pushPending(local: Locked): Promise<PushResult> {
    const { repo, sync } = this.context
    for (let attempt = 1; attempt <= 3; attempt++) {
      const commit = await local(() => sync.unpushed())
      if (commit === null) return { pushed: true, head: await local(() => repo.head()) }
      if (await sync.pushCommit(commit, attempt)) return { pushed: true, head: commit }
      if (!(await this.fetchAndIntegrate(local))) break
    }
    return { pushed: false, head: await local(() => repo.head()) }
  }

  /** Emits the push outcome; a failure is retried later unless `retry` is false. */
  private report<T extends PushResult>(result: T, retry = true): T {
    this.emit(result.pushed ? { type: 'push-success', head: result.head } : { type: 'push-failed', head: result.head, error: PUSH_FAILED })
    if (result.pushed) this.failures = 0
    else if (retry && !this.inline) this.retryLater()
    return result
  }

  private schedulePush(): void {
    const now = Date.now()
    this.pendingSince ??= now
    const deadline = this.pendingSince + this.timing.maxPushDelayMs - now
    this.startPushTimer(Math.max(0, Math.min(this.timing.pushDebounceMs, deadline)))
  }

  private retryLater(): void {
    this.failures += 1
    const delay = Math.min(this.timing.pushDebounceMs * 2 ** this.failures, this.timing.maxPushRetryMs)
    this.context.log(`background push failed; retrying in ${delay} ms`)
    // A commit made meanwhile has already scheduled a sooner push.
    if (this.pushTimer === null) this.startPushTimer(delay)
  }

  private startPushTimer(delay: number): void {
    if (this.stopped) return
    this.cancelPushTimer()
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      this.pendingSince = null
      this.backgroundPush()
    }, delay)
  }

  private cancelPushTimer(): void {
    if (this.pushTimer !== null) clearTimeout(this.pushTimer)
    this.pushTimer = null
  }

  private backgroundPush(): void {
    this.remote(async (local) => this.report(await this.pushPending(local))).catch(async (error: unknown) => {
      this.context.log(`background push error: ${describe(error)}`)
      const head = await this.context.repo.head().catch(() => '')
      this.emit({ type: 'push-failed', head, error: describe(error) })
      this.retryLater()
    })
  }

  private backgroundFetch(): void {
    if (this.fetching) return
    this.fetching = true
    this.remote((local) => this.fetchAndIntegrate(local))
      .catch((error: unknown) => this.context.log(`background fetch error: ${describe(error)}`))
      .finally(() => {
        this.fetching = false
      })
  }
}
