import fs from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { afterEach, expect, it } from 'vitest'
import { createGitVault } from './gitVault'

const author = { name: 'Test', email: 'qa@example.invalid' }
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tolaria-checkout-recovery-'))
  roots.push(dir)
  const context = { fs, dir }
  await git.init({ ...context, defaultBranch: 'main' })
  await writeFile(join(dir, 'a.md'), '# Before A\n')
  await writeFile(join(dir, 'b.md'), '# Before B\n')
  await writeFile(join(dir, 'removed.md'), '# Removed remotely\n')
  const original = await createGitVault(context).checkpoint(author)
  await git.branch({ ...context, ref: 'remote' })
  await git.checkout({ ...context, ref: 'remote' })
  await writeFile(join(dir, 'a.md'), '# After A\n')
  await writeFile(join(dir, 'b.md'), '# After B\n')
  await writeFile(join(dir, 'added.md'), '# Added remotely\n')
  await rm(join(dir, 'removed.md'))
  const remote = await createGitVault(context).checkpoint(author)
  await git.checkout({ ...context, ref: 'main' })
  return { context, original: original.oid, remote: remote.oid }
}

function interruptedFileSystem(path: string) {
  return {
    promises: {
      ...fs.promises,
      writeFile: async (...args: Parameters<typeof fs.promises.writeFile>) => {
        if (String(args[0]) === path) throw new Error('simulatedDeviceWriteFailure')
        return fs.promises.writeFile(...args)
      },
    },
  }
}

it('does not advance HEAD before every checkout write succeeds', async () => {
  const { context, original, remote } = await fixture()
  const interrupted = { ...context, fs: interruptedFileSystem(join(context.dir, 'b.md')) }
  await expect(createGitVault(interrupted).integrate(remote)).rejects.toThrow()
  expect(await git.resolveRef({ ...context, ref: 'HEAD' })).toBe(original)
})

it('finishes an interrupted checkout before checkpointing after a restart', async () => {
  const { context, remote } = await fixture()
  const interrupted = { ...context, fs: interruptedFileSystem(join(context.dir, 'b.md')) }
  await expect(createGitVault(interrupted).integrate(remote)).rejects.toThrow()
  const result = await createGitVault(context).checkpoint(author)
  expect(result).toEqual({ changedFiles: 0, oid: remote })
  expect(await readFile(join(context.dir, 'a.md'), 'utf8')).toBe('# After A\n')
  expect(await readFile(join(context.dir, 'b.md'), 'utf8')).toBe('# After B\n')
  expect(await readFile(join(context.dir, 'added.md'), 'utf8')).toBe('# Added remotely\n')
  await expect(readFile(join(context.dir, 'removed.md'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('preserves an unexpected edit made after interrupted checkout', async () => {
  const { context, original, remote } = await fixture()
  const interrupted = { ...context, fs: interruptedFileSystem(join(context.dir, 'b.md')) }
  await expect(createGitVault(interrupted).integrate(remote)).rejects.toThrow()
  const unexpected = '# External change that must survive\n'
  await writeFile(join(context.dir, 'b.md'), unexpected)
  await expect(createGitVault(context).checkpoint(author)).rejects.toThrow()
  expect(await readFile(join(context.dir, 'b.md'), 'utf8')).toBe(unexpected)
  expect(await git.resolveRef({ ...context, ref: 'HEAD' })).toBe(original)
})

it('recovers when the files and HEAD were updated but clearing the journal failed', async () => {
  const { context, remote } = await fixture()
  const journalPath = join(context.dir, '.git', 'tolaria-checkout.json')
  const interrupted = {
    ...context,
    fs: { promises: { ...fs.promises, unlink: async (path: fs.PathLike) => {
      if (String(path) === journalPath) throw new Error('simulatedDeviceWriteFailure')
      return fs.promises.unlink(path)
    } } },
  }
  await expect(createGitVault(interrupted).integrate(remote)).rejects.toThrow()
  expect(await git.resolveRef({ ...context, ref: 'HEAD' })).toBe(remote)
  expect(await createGitVault(context).checkpoint(author)).toEqual({ changedFiles: 0, oid: remote })
  await expect(readFile(journalPath)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('does not change files if the recovery intent cannot be persisted', async () => {
  const { context, original, remote } = await fixture()
  const interrupted = { ...context, fs: interruptedFileSystem(join(context.dir, '.git', 'tolaria-checkout.json')) }
  await expect(createGitVault(interrupted).integrate(remote)).rejects.toThrow()
  expect(await git.resolveRef({ ...context, ref: 'HEAD' })).toBe(original)
  expect(await readFile(join(context.dir, 'a.md'), 'utf8')).toBe('# Before A\n')
})

it.each(['{', '{}', '{"version":2}'])('fails closed on an invalid journal: %s', async (journal) => {
  const { context, original } = await fixture()
  await writeFile(join(context.dir, '.git', 'tolaria-checkout.json'), journal)
  await expect(createGitVault(context).checkpoint(author)).rejects.toThrow()
  expect(await git.resolveRef({ ...context, ref: 'HEAD' })).toBe(original)
  expect(await readFile(join(context.dir, 'a.md'), 'utf8')).toBe('# Before A\n')
})
