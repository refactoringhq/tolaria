import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitError, git } from '../src/git.ts'
import { GitRepo } from '../src/gitRepo.ts'

describe('git', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tolaria-git-test-'))
    await git(dir, ['init', '-q', '-b', 'main'])
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(dir, { recursive: true, force: true })
  })

  it('returns stdout of a successful command', async () => {
    expect(await git(dir, ['rev-parse', '--is-inside-work-tree'])).toEqual({ stdout: 'true\n', code: 0 })
  })

  it('rejects with the exit code and stderr of a failed command', async () => {
    const failure = await git(dir, ['rev-parse', '--verify', 'no-such-ref']).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(GitError)
    expect(failure).toMatchObject({ name: 'GitError', code: 128 })
    expect((failure as GitError).message).toContain('git rev-parse --verify no-such-ref failed (128)')
  })

  it('treats listed exit codes as answers', async () => {
    const result = await git(dir, ['rev-parse', '-q', '--verify', 'no-such-ref'], { okCodes: [1] })
    expect(result.code).toBe(1)
  })

  it('reports a command that could not run at all', async () => {
    const failure = await git(join(dir, 'missing'), ['status']).catch((error: unknown) => error)
    expect(failure).toMatchObject({ name: 'GitError', code: -1 })
  })

  it('ignores a repository inherited from the environment, as inside a git hook', async () => {
    vi.stubEnv('GIT_DIR', '/nonexistent/.git')
    vi.stubEnv('GIT_WORK_TREE', '/nonexistent')
    expect((await git(dir, ['rev-parse', '--is-inside-work-tree'])).stdout).toBe('true\n')
  })

  it('treats paths as data, not as pathspec patterns', async () => {
    const result = await git(dir, ['ls-files', '--', ':(glob)*.md'])
    expect(result.stdout).toBe('')
  })
})

describe('GitRepo.open', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tolaria-repo-test-'))
  })

  afterEach(() => rm(root, { recursive: true, force: true }))

  it('needs a remote URL when there is no clone yet', async () => {
    await expect(GitRepo.open({ dir: join(root, 'vault') })).rejects.toThrowError(/a remote URL is required/)
  })

  it('refuses an empty remote instead of inventing a first commit', async () => {
    const remote = join(root, 'empty.git')
    await git(root, ['init', '-q', '--bare', '-b', 'main', remote])
    await expect(GitRepo.open({ dir: join(root, 'vault'), remoteUrl: remote })).rejects.toThrowError(
      /the remote has no commits/,
    )
  })
})
