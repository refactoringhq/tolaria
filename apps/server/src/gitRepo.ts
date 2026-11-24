import { existsSync } from 'node:fs'
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type CoAuthor, coAuthorTrailers } from './coAuthors.ts'
import { VaultError } from './errors.ts'
import { type GitOptions, type GitResult, git } from './git.ts'
import type { VaultPath } from './paths.ts'

export interface Committer {
  name: string
  email: string
}

export interface RepoOptions {
  /** Directory of the server's working clone. Created by cloning `remoteUrl` when missing. */
  dir: string
  remoteUrl?: string
  branch?: string
  committer?: Committer
}

const DEFAULT_COMMITTER: Committer = { name: 'Tolaria Remote', email: 'remote@tolaria.invalid' }
/** Name of the vault's git remote inside the server's clone. */
export const REMOTE = 'upstream'
const UNREADABLE_AS_FILE = new Set(['ENOENT', 'EISDIR', 'ENOTDIR'])
const PARENT_IS_A_FILE = new Set(['EEXIST', 'ENOTDIR'])
const NOTHING_THERE = new Set(['ENOENT', 'ENOTDIR'])
/**
 * Commands that never move HEAD; any other one forgets the head `head()` remembered. A fetch
 * or a push only moves remote refs, and runs for seconds while saves go on.
 */
const KEEP_HEAD = new Set(['rev-parse', 'rev-list', 'ls-tree', 'diff', 'log', 'merge-base', 'cat-file', 'show', 'fetch', 'push'])

function messageArgs(message: string, coAuthors: readonly CoAuthor[]): string[] {
  const trailers = coAuthorTrailers(coAuthors)
  return ['-m', message, ...(trailers ? ['-m', trailers] : [])]
}

/** The git command in `args`, after any leading `-c <setting>` pairs. */
function subcommand(args: readonly string[]): string | undefined {
  let index = 0
  while (args[index] === '-c') index += 2
  return args[index]
}

type PathKind = 'file' | 'folder' | 'missing'

function committerEnv(committer: Committer): Record<string, string> {
  return {
    GIT_AUTHOR_NAME: committer.name,
    GIT_AUTHOR_EMAIL: committer.email,
    GIT_COMMITTER_NAME: committer.name,
    GIT_COMMITTER_EMAIL: committer.email,
  }
}

async function cloneVault(options: RepoOptions, remoteUrl: string): Promise<void> {
  const parent = dirname(options.dir)
  await mkdir(parent, { recursive: true })
  // Persisted in the clone's own config; bytes are stored as they arrive.
  const safety = ['-c', 'core.symlinks=false', '-c', 'core.autocrlf=false']
  const branch = options.branch ? ['--branch', options.branch] : []
  await git(parent, ['clone', '-q', '-o', REMOTE, ...safety, ...branch, '--', remoteUrl, options.dir])
}

async function ensureClone(options: RepoOptions): Promise<void> {
  if (existsSync(join(options.dir, '.git'))) {
    if (options.remoteUrl) await git(options.dir, ['remote', 'set-url', REMOTE, options.remoteUrl])
    return
  }
  if (!options.remoteUrl) throw new Error('no vault clone yet: a remote URL is required')
  await cloneVault(options, options.remoteUrl)
}

/** The server's git working clone of one vault: files, index and commits. No network. */
export class GitRepo {
  readonly dir: string
  readonly branch: string
  private readonly env: Record<string, string>
  private tempFiles = 0
  /** HEAD as last read, while no command that may move it has run or is running. */
  private knownHead: string | null = null
  private changing = 0
  private generation = 0

  private constructor(dir: string, branch: string, committer: Committer) {
    this.dir = dir
    this.branch = branch
    this.env = committerEnv(committer)
  }

  static async open(options: RepoOptions): Promise<GitRepo> {
    await ensureClone(options)
    const head = await git(options.dir, ['symbolic-ref', '--short', 'HEAD'])
    const repo = new GitRepo(options.dir, head.stdout.trim(), options.committer ?? DEFAULT_COMMITTER)
    const hasCommit = await repo.run(['rev-parse', '-q', '--verify', 'HEAD'], { okCodes: [1] })
    if (hasCommit.code !== 0) throw new Error('the remote has no commits; seed it with a vault')
    await repo.restoreCleanTree()
    return repo
  }

  get upstream(): string {
    return `refs/remotes/${REMOTE}/${this.branch}`
  }

  run(args: readonly string[], options: GitOptions = {}): Promise<GitResult> {
    if (KEEP_HEAD.has(subcommand(args) ?? '')) return git(this.dir, args, { ...options, env: this.env })
    return this.change(args, options)
  }

  /** The current commit. Read once per change: a save asks for it several times. */
  async head(): Promise<string> {
    if (this.knownHead !== null) return this.knownHead
    const generation = this.generation
    const head = (await this.run(['rev-parse', 'HEAD'])).stdout.trim()
    if (this.changing === 0 && generation === this.generation) this.knownHead = head
    return head
  }

  private async change(args: readonly string[], options: GitOptions): Promise<GitResult> {
    this.changing += 1
    this.knownHead = null
    try {
      return await git(this.dir, args, { ...options, env: this.env })
    } finally {
      this.changing -= 1
      this.generation += 1
      this.knownHead = null
    }
  }

  abs(path: VaultPath): string {
    return join(this.dir, path)
  }

  exists(path: VaultPath): boolean {
    return existsSync(this.abs(path))
  }

  async readIfExists(path: VaultPath): Promise<Buffer | null> {
    try {
      return await readFile(this.abs(path))
    } catch (error) {
      if (UNREADABLE_AS_FILE.has((error as NodeJS.ErrnoException).code ?? '')) return null
      throw error
    }
  }

  /**
   * What stops `path` from holding a file: an ancestor that is a file, or `path` itself
   * when it is a folder. Null when the path is free or already a file.
   */
  async blocker(path: VaultPath): Promise<VaultPath | null> {
    const segments = path.split('/')
    for (let depth = 1; depth < segments.length; depth++) {
      const ancestor = segments.slice(0, depth).join('/') as VaultPath
      if ((await this.kind(ancestor)) === 'file') return ancestor
    }
    if ((await this.kind(path)) === 'folder') return path
    return null
  }

  /** Creates the folders above `path`. A file where a folder is needed is the client's mistake. */
  async makeParent(path: VaultPath): Promise<void> {
    try {
      await mkdir(dirname(this.abs(path)), { recursive: true })
    } catch (error) {
      if (!PARENT_IS_A_FILE.has((error as NodeJS.ErrnoException).code ?? '')) throw error
      throw new VaultError(409, 'destination_exists', `a parent of ${path} is a file`)
    }
  }

  /** Readers never see a half-written file: write beside the index, then rename into place. */
  async writeAtomic(path: VaultPath, bytes: Uint8Array): Promise<void> {
    const temp = join(this.dir, '.git', `tolaria-write-${this.tempFiles++}`)
    await this.makeParent(path)
    await writeFile(temp, bytes)
    await rename(temp, this.abs(path))
  }

  private async kind(path: VaultPath): Promise<PathKind> {
    try {
      const stats = await lstat(this.abs(path))
      if (stats.isDirectory()) return 'folder'
      return 'file'
    } catch (error) {
      if (NOTHING_THERE.has((error as NodeJS.ErrnoException).code ?? '')) return 'missing'
      throw error
    }
  }

  async commitFile(path: VaultPath, bytes: Uint8Array, message: string, coAuthors: readonly CoAuthor[] = []): Promise<void> {
    const existed = this.exists(path)
    await this.writeAtomic(path, bytes)
    // The usual save edits a file git tracks: one command stages and commits it. Git refuses
    // (exit 1) a path it does not track, which is then added first.
    if (existed && (await this.run(['commit', '-q', ...messageArgs(message, coAuthors), '--', path], { okCodes: [1] })).code === 0) return
    await this.run(['add', '-f', '--', path])
    await this.commitStaged(message, coAuthors)
  }

  /** Commits what is staged, if anything. Co-authors become trailers in a paragraph of their own. */
  async commitStaged(message: string, coAuthors: readonly CoAuthor[] = []): Promise<void> {
    const staged = await this.run(['diff', '--cached', '--quiet'], { okCodes: [1] })
    if (staged.code !== 1) return
    await this.run(['commit', '-q', ...messageArgs(message, coAuthors)])
  }

  async restoreCleanTree(): Promise<void> {
    await this.run(['reset', '-q', '--hard', 'HEAD'])
    await this.run(['clean', '-q', '-fd'])
  }
}
