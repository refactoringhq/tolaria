import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { afterEach, expect, it } from 'vitest'
import { cloneGitVault, syncGitVault } from './gitRemote'
import { createGitVault } from './gitVault'
import { gitTestEnvironment, startGitTestServer } from './gitTestServer'

const author = { name: 'Tablet QA', email: 'qa@example.invalid' }
const cleanup: (() => Promise<void>)[] = []
const gitProcessOptions = { env: gitTestEnvironment(), stdio: 'pipe' as const }
afterEach(async () => { for (const action of cleanup.splice(0).reverse()) await action() })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'tolaria-sync-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const remote = join(root, 'team', 'vault.git')
  await mkdir(remote, { recursive: true })
  execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], gitProcessOptions)
  const seed = join(root, 'seed')
  await mkdir(seed)
  await git.init({ fs, dir: seed, defaultBranch: 'main' })
  await writeFile(join(seed, 'note.md'), '---\nstatus: draft\n---\n# Initial\n')
  await createGitVault({ fs, dir: seed }).checkpoint(author)
  execFileSync('git', ['-C', seed, 'push', remote, 'main'], gitProcessOptions)
  const server = await startGitTestServer(root)
  cleanup.push(server.close)
  const first = { fs, http: server.http, dir: join(root, 'first') }
  const second = { fs, http: server.http, dir: join(root, 'second') }
  await cloneGitVault(first, 'https://github.com/team/vault')
  await cloneGitVault(second, 'https://github.com/team/vault')
  return { first, second, remote }
}

it('clones, checkpoints, pushes, and pulls real Git objects through HTTP', { timeout: 20_000 }, async () => {
  const { first, second } = await fixture()
  const content = '---\nstatus: draft\ncustom: unchanged\n---\n# Tablet change\n'
  await writeFile(join(first.dir, 'note.md'), content)
  expect(await syncGitVault(first, author)).toMatchObject({ kind: 'synced', changedFiles: 1 })
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'synced', changedFiles: 0 })
  expect(await readFile(join(second.dir, 'note.md'), 'utf8')).toBe(content)
})

it('stops on divergence while preserving both copies and commits', { timeout: 20_000 }, async () => {
  const { first, second } = await fixture()
  await writeFile(join(first.dir, 'note.md'), '# First device\n')
  await writeFile(join(second.dir, 'note.md'), '# Second device\n')
  await syncGitVault(first, author)
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'diverged' })
  expect(await readFile(join(second.dir, 'note.md'), 'utf8')).toBe('# Second device\n')
  expect(await readFile(join(first.dir, 'note.md'), 'utf8')).toBe('# First device\n')
  expect(await git.log(second)).toHaveLength(2)
})

it('keeps a rejected push as a recoverable local commit and retries without duplicating it', { timeout: 20_000 }, async () => {
  const { first, second, remote } = await fixture()
  execFileSync('git', ['--git-dir', remote, 'config', 'http.receivepack', 'false'], gitProcessOptions)
  await writeFile(join(first.dir, 'note.md'), '# Offline-safe\n')
  await expect(syncGitVault(first, author)).rejects.toThrow()
  expect(await git.log(first)).toHaveLength(2)
  execFileSync('git', ['--git-dir', remote, 'config', 'http.receivepack', 'true'], gitProcessOptions)
  expect(await syncGitVault(first, author)).toMatchObject({ kind: 'synced', changedFiles: 0 })
  await syncGitVault(second, author)
  expect(await readFile(join(second.dir, 'note.md'), 'utf8')).toBe('# Offline-safe\n')
  expect(await git.log(first)).toHaveLength(2)
})
