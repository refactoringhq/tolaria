import { rm } from 'node:fs/promises'
import { CO_AUTHOR_LOG_FORMAT, type CoAuthor, CoAuthors, parseCoAuthor } from './coAuthors.ts'
import { GitError, type GitResult } from './git.ts'
import { type GitRepo, REMOTE } from './gitRepo.ts'
import type { VaultPath } from './paths.ts'
import type { LinkRewrites } from './renameLinks.ts'

export type VaultChange =
  /** `links` is set when a rename rewrote the wikilinks in the file, and nothing else. */
  | { kind: 'upsert'; path: VaultPath; links?: LinkRewrites }
  | { kind: 'delete'; path: VaultPath }
  | { kind: 'rename'; from: VaultPath; to: VaultPath }

export interface SyncHooks {
  log(message: string): void
  /** A free conflict-copy path next to `path`. */
  conflictPath(path: VaultPath): VaultPath
  /** Files that changed because upstream moved (never the server's own writes). */
  onChanges(changes: VaultChange[]): Promise<void>
}

interface PendingChange {
  path: VaultPath
  /** `null` is a local deletion. */
  bytes: Buffer | null
}

const MAX_PUSH_ATTEMPTS = 3

/** Splits NUL-separated git output, dropping the empty tail. Git only reports tracked paths. */
function fields({ stdout }: GitResult): VaultPath[] {
  return stdout.split('\0').filter((field) => field.length > 0) as VaultPath[]
}

function parseChanges(diff: GitResult): VaultChange[] {
  const parts = fields(diff)
  const changes: VaultChange[] = []
  let index = 0
  while (index + 1 < parts.length) {
    const status = parts[index]
    const path = parts[index + 1]
    index += 2
    if (status.startsWith('R')) {
      const to = parts[index++]
      changes.push({ kind: 'rename', from: path, to }, { kind: 'upsert', path: to })
    } else {
      changes.push({ kind: status === 'D' ? 'delete' : 'upsert', path })
    }
  }
  return changes
}

/** Keeps the working clone and the git remote in step: fetch and integrate, then push. */
export class GitSync {
  /** Paths whose local version was moved to a conflict copy by the last replay. */
  readonly relocated = new Map<VaultPath, VaultPath>()
  private readonly repo: GitRepo
  private readonly hooks: SyncHooks

  constructor(repo: GitRepo, hooks: SyncHooks) {
    this.repo = repo
    this.hooks = hooks
  }

  /** Fetches and integrates upstream. Returns false when the remote is unreachable. */
  async pull(): Promise<boolean> {
    const { repo } = this
    const before = await repo.head()
    if (!(await this.fetch())) return false
    const counts = await repo.run(['rev-list', '--left-right', '--count', `HEAD...${repo.upstream}`])
    const [ahead, behind] = counts.stdout.trim().split('\t').map(Number)
    if (behind === 0) return true
    if (ahead > 0) await this.replay()
    else await repo.run(['reset', '-q', '--hard', repo.upstream])
    const diff = await repo.run(['diff', '--name-status', '-M', '-z', before, await repo.head()])
    await this.hooks.onChanges(parseChanges(diff))
    return true
  }

  /** Pushes pending commits. Returns true when the remote has everything we have. */
  async push(): Promise<boolean> {
    const { repo } = this
    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
      const ahead = await repo.run(['rev-list', '--count', `${repo.upstream}..HEAD`])
      if (ahead.stdout.trim() === '0') return true
      if (await this.tryPush(attempt)) return true
      // Someone else pushed first: integrate their commits and try again.
      if (!(await this.pull())) return false
    }
    return false
  }

  private fetch(): Promise<boolean> {
    const { branch, upstream } = this.repo
    return this.reach(['fetch', '-q', REMOTE, `+refs/heads/${branch}:${upstream}`], 'fetch failed, continuing on local state')
  }

  private async tryPush(attempt: number): Promise<boolean> {
    const { repo } = this
    const pushed = await this.reach(['push', '-q', REMOTE, `HEAD:refs/heads/${repo.branch}`], `push failed (attempt ${attempt})`)
    if (pushed) await repo.run(['update-ref', repo.upstream, 'HEAD'])
    return pushed
  }

  /** Runs a command that talks to the remote. A git failure is logged and answered with false. */
  private async reach(args: string[], failure: string): Promise<boolean> {
    try {
      await this.repo.run(args)
      return true
    } catch (error) {
      if (!(error instanceof GitError)) throw error
      this.hooks.log(`${failure}: ${error.message}`)
      return false
    }
  }

  /**
   * Local commits that never reached the remote meet new upstream commits. Upstream becomes
   * the history; local changes are re-applied on top, one file at a time (last write wins),
   * and a local version of a file that upstream also changed becomes a conflict copy.
   */
  private async replay(): Promise<void> {
    const { repo } = this
    const base = (await repo.run(['merge-base', 'HEAD', repo.upstream])).stdout.trim()
    const theirs = await repo.run(['diff', '--name-only', '--no-renames', '-z', base, repo.upstream])
    const contested = new Set(fields(theirs))
    const pending = await this.localChanges(base, contested)
    const coAuthors = await this.localCoAuthors(base)
    const unpushed = await repo.head()
    try {
      await repo.run(['reset', '-q', '--hard', repo.upstream])
      this.relocated.clear()
      for (const change of pending) await this.reapply(change, contested)
      await repo.run(['add', '-A', '-f'])
      await repo.commitStaged(`Replay ${pending.length} local change(s) onto upstream`, coAuthors)
    } catch (error) {
      // The unpushed commits exist nowhere else: put them back before reporting the failure.
      await repo.run(['reset', '-q', '--hard', unpushed])
      throw error
    }
  }

  /** Who the unpushed local commits name: the replay that replaces them keeps naming them. */
  private async localCoAuthors(base: string): Promise<CoAuthor[]> {
    const log = await this.repo.run(['log', CO_AUTHOR_LOG_FORMAT, `${base}..HEAD`])
    const named = log.stdout.split('\n').map(parseCoAuthor)
    return new CoAuthors(named.filter((author) => author !== null)).list()
  }

  /** What the unpushed local commits changed. A deletion of a contested file is dropped. */
  private async localChanges(base: string, contested: Set<VaultPath>): Promise<PendingChange[]> {
    const mine = await this.repo.run(['diff', '--name-status', '--no-renames', '-z', base, 'HEAD'])
    const parts = fields(mine)
    const pending: PendingChange[] = []
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const path = parts[index + 1]
      if (parts[index] !== 'D') pending.push({ path, bytes: await this.repo.readIfExists(path) })
      else if (!contested.has(path)) pending.push({ path, bytes: null })
    }
    return pending
  }

  private async reapply({ path, bytes }: PendingChange, contested: Set<VaultPath>): Promise<void> {
    if (bytes === null) {
      await rm(this.repo.abs(path), { force: true })
      return
    }
    const existing = await this.repo.readIfExists(path)
    if (existing?.equals(bytes)) return
    const target = existing && contested.has(path) ? this.hooks.conflictPath(path) : await this.freePath(path)
    if (target !== path) this.relocated.set(path, target)
    await this.repo.writeAtomic(target, bytes)
  }

  /**
   * Upstream may have put a file where this path needs a folder, or a folder where it needs
   * a file. The local version then goes next to whatever is in the way, as a conflict copy.
   */
  private async freePath(path: VaultPath): Promise<VaultPath> {
    const blocker = await this.repo.blocker(path)
    if (!blocker) return path
    return `${this.hooks.conflictPath(blocker)}${path.slice(blocker.length)}` as VaultPath
  }
}
