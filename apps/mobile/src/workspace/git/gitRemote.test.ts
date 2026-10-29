import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { afterEach, expect, it, vi } from 'vitest'
import { cloneGitVault, syncGitVault, type GitRemoteOptions } from './gitRemote'
import { createExpoGitFileSystem, gitFileWriteFailurePath } from './expoGitFileSystem'
import { createGitVault } from './gitVault'
import { gitTestEnvironment, startGitTestServer } from './gitTestServer'
import { createGitEditorAccess } from './gitEditorAccess'
import { createWorkspaceSyncEditors } from '../workspaceSyncEditors'

const author = { name: 'Tablet QA', email: 'qa@example.invalid' }
const cleanup: (() => Promise<void>)[] = []
const gitProcessOptions = { env: gitTestEnvironment(), stdio: 'pipe' as const }
afterEach(async () => { for (const action of cleanup.splice(0).reverse()) await action() })

async function fixture({ includeSymlink = false }: { includeSymlink?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'tolaria-sync-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const remote = join(root, 'team', 'vault.git')
  await mkdir(remote, { recursive: true })
  execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], gitProcessOptions)
  const seed = join(root, 'seed')
  await mkdir(seed)
  await git.init({ fs, dir: seed, defaultBranch: 'main' })
  await writeFile(join(seed, 'note.md'), '---\nstatus: draft\n---\n# Initial\n')
  if (includeSymlink) await symlink('note.md', join(seed, 'linked.md'))
  await createGitVault({ fs, dir: seed }).checkpoint(author)
  execFileSync('git', ['-C', seed, 'push', remote, 'main'], gitProcessOptions)
  const server = await startGitTestServer(root)
  cleanup.push(server.close)
  const first = { fs, http: server.http, dir: join(root, 'first') }
  const second = { fs, http: server.http, dir: join(root, 'second') }
  await cloneGitVault(first, 'https://github.com/team/vault')
  await cloneGitVault(second, 'https://github.com/team/vault')
  return { first, second, remote, root }
}

function memoryExpoBytes(value: string | Uint8Array) {
  return typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
}

function createMemoryExpoFileSystem(rootUri: string) {
  const files = new Map<string, string | Uint8Array>()
  let failWrites = false
  const module = {
    File: class {
      constructor(private readonly uri: string) {}
      bytes = async () => memoryExpoBytes(files.get(this.uri) ?? '')
      write = (content: string | Uint8Array) => {
        if (failWrites && this.uri.endsWith('/write-failure.md')) throw new Error('disk full')
        files.set(this.uri, typeof content === 'string' ? content : new Uint8Array(content))
      }
      delete = () => { files.delete(this.uri) }
      info = () => ({ exists: true, size: memoryExpoBytes(files.get(this.uri) ?? '').byteLength, modificationTime: 1, creationTime: 1 })
    },
    Directory: class { create = () => {}; delete = () => {} },
    Paths: { info: (uri: string) => ({
      exists: uri === rootUri || files.has(uri),
      isDirectory: uri === rootUri ? true : files.has(uri) ? false : null,
    }) },
  }
  return {
    adapter: createExpoGitFileSystem(rootUri, module, async () => [], module.Paths.info).promises,
    setFailWrites: (value: boolean) => { failWrites = value },
  }
}

it('checks out Git symlinks as regular files containing their targets on Expo storage', { timeout: 20_000 }, async () => {
  const { first, root } = await fixture({ includeSymlink: true })
  const expoFs = createMemoryExpoFileSystem('file:///expo-client')
  const clientRoot = join(root, 'expo-client')
  await mkdir(clientRoot)
  const checkoutFs = Object.create(fs.promises) as typeof fs.promises
  checkoutFs.symlink = async (target, path) => {
    await expoFs.adapter.symlink(String(target), '/vault/linked.md')
    await writeFile(String(path), String(target))
  }

  await cloneGitVault({ fs: checkoutFs, dir: clientRoot, http: first.http }, 'https://github.com/team/vault')

  expect(await readFile(join(clientRoot, 'linked.md'), 'utf8')).toBe('note.md')
  expect(await expoFs.adapter.readFile('/vault/linked.md', 'utf8')).toBe('note.md')
  expect((await expoFs.adapter.stat('/vault/linked.md')).isFile()).toBe(true)
  expoFs.setFailWrites(true)
  const failure = await expoFs.adapter.writeFile('/vault/write-failure.md', 'data').catch(error => error)
  expect(gitFileWriteFailurePath(failure)).toBe('/vault/write-failure.md')
  expect(gitFileWriteFailurePath(Object.assign(new Error('checkout failed'), { errors: [failure] })))
    .toBe('/vault/write-failure.md')
})

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

it('merges independent edits, preserves both parents, and publishes the combined history', async () => {
  const { first, second, remote } = await fixture()
  await writeFile(join(first.dir, 'desktop.md'), '# Desktop\n')
  await writeFile(join(second.dir, 'tablet.md'), '# Tablet\n')
  await syncGitVault(first, author)
  const remoteParent = await git.resolveRef({ ...first, ref: 'HEAD' })
  const localParent = (await createGitVault(second).checkpoint(author)).oid
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'synced', workspaceChanged: true })
  const oid = await git.resolveRef({ ...second, ref: 'HEAD' })
  expect((await git.readCommit({ ...second, oid })).commit.parent).toEqual([localParent, remoteParent])
  expect(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], gitProcessOptions).toString().trim()).toBe(oid)
  expect(await readFile(join(second.dir, 'desktop.md'), 'utf8')).toBe('# Desktop\n')
  expect(await readFile(join(second.dir, 'tablet.md'), 'utf8')).toBe('# Tablet\n')
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'synced', workspaceChanged: false })
  expect(await git.resolveRef({ ...second, ref: 'HEAD' })).toBe(oid)
})

it('fetches and merges again if the remote advances immediately before push', async () => {
  const { first, second } = await fixture()
  await writeFile(join(first.dir, 'desktop.md'), '# Desktop\n')
  await writeFile(join(second.dir, 'tablet.md'), '# Tablet\n')
  let advanced = false
  const http = { request: async (request: Parameters<typeof first.http.request>[0]) => {
    if (!advanced && request.url.includes('git-receive-pack')) {
      advanced = true
      await syncGitVault(first, author)
    }
    return second.http.request(request)
  } }
  expect(await syncGitVault({ ...second, http }, author)).toMatchObject({ kind: 'synced', workspaceChanged: true })
  expect(advanced).toBe(true)
  await syncGitVault(first, author)
  expect(await readFile(join(first.dir, 'tablet.md'), 'utf8')).toBe('# Tablet\n')
  expect(await readFile(join(second.dir, 'desktop.md'), 'utf8')).toBe('# Desktop\n')
})

it('bounds retries when a remote keeps moving and retains the combined local history', async () => {
  const { first, second } = await fixture()
  await writeFile(join(second.dir, 'tablet.md'), '# Tablet\n')
  let attempts = 0
  const http = { request: async (request: Parameters<typeof first.http.request>[0]) => {
    if (request.url.includes('info/refs?service=git-receive-pack')) {
      attempts += 1
      await writeFile(join(first.dir, `desktop-${attempts}.md`), '# Desktop\n')
      await syncGitVault(first, author)
    }
    return second.http.request(request)
  } }
  await expect(syncGitVault({ ...second, http }, author)).rejects.toThrow('pushRejected')
  expect(attempts).toBe(3)
  expect(await readFile(join(second.dir, 'tablet.md'), 'utf8')).toBe('# Tablet\n')
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'synced' })
  await syncGitVault(first, author)
  expect(await readFile(join(first.dir, 'tablet.md'), 'utf8')).toBe('# Tablet\n')
})

it('checkpoints locally before refreshing credentials, even when refresh fails offline', async () => {
  const { first } = await fixture()
  await writeFile(join(first.dir, 'note.md'), '# Saved offline\n')
  await expect(syncGitVault({ ...first, getToken: async () => { throw new Error('offline') } }, author)).rejects.toThrow('offline')
  expect(await git.log(first)).toHaveLength(2)
  expect((await git.statusMatrix(first)).every(([, head, worktree, stage]) => head === worktree && head === stage)).toBe(true)
  expect(await syncGitVault(first, author)).toMatchObject({ kind: 'synced', changedFiles: 0 })
})

it('stops expired background work before network access and retains its checkpoint', async () => {
  const { first } = await fixture()
  await writeFile(join(first.dir, 'note.md'), '# Background draft\n')
  const controller = new AbortController()
  let requests = 0
  const http = { request: (request: Parameters<typeof first.http.request>[0]) => {
    requests += 1
    return first.http.request(request)
  } }
  await expect(syncGitVault({ ...first, http, signal: controller.signal,
    onPhase: phase => { if (phase === 'fetch') controller.abort() },
  }, author)).rejects.toThrow('syncDeferred')
  expect(requests).toBe(0)
  expect(await git.log(first)).toHaveLength(2)
  expect(await syncGitVault(first, author)).toMatchObject({ kind: 'synced', changedFiles: 0 })
})

it('carries cancellation to the HTTP adapter and stops before the next phase', async () => {
  const { first, second } = await fixture()
  await writeFile(join(first.dir, 'desktop.md'), '# Desktop\n')
  await syncGitVault(first, author)
  const controller = new AbortController()
  const http = { request: async (request: Parameters<typeof second.http.request>[0]) => {
    expect(request.signal).toBe(controller.signal)
    const response = await second.http.request(request)
    controller.abort()
    return response
  } }
  await expect(syncGitVault({ ...second, http, signal: controller.signal }, author)).rejects.toThrow()
  expect(await git.log(second)).toHaveLength(1)
  expect(await syncGitVault(second, author)).toMatchObject({ kind: 'synced' })
  expect(await readFile(join(second.dir, 'desktop.md'), 'utf8')).toBe('# Desktop\n')
})

it.each(['initial', 'after-fetch'])('refreshes editors after successful %s checkpoint recovery even when heads then match', async boundary => {
  const { first, second } = await fixture()
  const before = await git.resolveRef({ ...second, ref: 'HEAD' })
  const content = '# Recovered remote note\n'
  await writeFile(join(first.dir, 'note.md'), content)
  await syncGitVault(first, author)
  const target = await git.resolveRef({ ...first, ref: 'HEAD' })
  await git.fetch({ ...second, ref: 'main', singleBranch: true, tags: false })
  const journal = JSON.stringify({ version: 1, branch: 'main', before, target })
  const journalPath = join(second.dir, '.git', 'tolaria-checkout.json')
  if (boundary === 'initial') await writeFile(journalPath, journal)
  const editors = createWorkspaceSyncEditors()
  editors.register(async () => () => {}, 'note.md')
  const refresh = vi.fn()
  const access = createGitEditorAccess({ editors, refresh })
  let phase = ''
  const options: GitRemoteOptions = {
    ...second,
    withLocalAccess: async operation => {
      if (boundary === 'after-fetch' && phase === 'checkout') await writeFile(journalPath, journal)
      return access(operation)
    },
    onPhase: value => { phase = value },
  }
  expect(await syncGitVault(options, author)).toMatchObject({ kind: 'synced', workspaceChanged: true })
  expect(refresh).toHaveBeenCalledExactlyOnceWith('note.md')
  expect(await readFile(join(second.dir, 'note.md'), 'utf8')).toBe(content)
  expect(await git.resolveRef({ ...second, ref: 'HEAD' })).toBe(target)
  await expect(readFile(journalPath)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await syncGitVault({ ...second, withLocalAccess: access }, author))
    .toMatchObject({ kind: 'synced', workspaceChanged: false })
  expect(refresh).toHaveBeenCalledOnce()
})
