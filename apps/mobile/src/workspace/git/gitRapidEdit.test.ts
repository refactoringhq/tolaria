import fs from 'node:fs'
import type { PathLike } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { expect, it } from 'vitest'
import { createGitVault } from './gitVault'

it('checkpoints equal-length edits even when filesystem timestamps have not advanced', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tolaria-git-rapid-edit-'))
  const author = { name: 'Test', email: 'qa@example.invalid' }
  const notePath = join(dir, 'note.md')
  const deviceFs = {
    promises: {
      ...fs.promises,
      lstat: async (path: PathLike) => {
        const stat = await fs.promises.lstat(path)
        if (String(path) !== notePath) return stat
        return Object.assign(stat, { ctimeMs: 1_000_000, mtimeMs: 1_000_000 })
      },
    },
  }
  const context = { fs: deviceFs, dir }
  try {
    await git.init({ ...context, defaultBranch: 'main' })
    await writeFile(notePath, '# Original\n')
    await git.add({ ...context, filepath: 'note.md' })
    await git.commit({ ...context, author, message: 'Fixture' })
    await writeFile(notePath, '# Modified\n')
    const result = await createGitVault(context).checkpoint(author)
    expect(result.changedFiles).toBe(1)
    const saved = await git.readBlob({ ...context, oid: result.oid, filepath: 'note.md' })
    expect(Buffer.from(saved.blob).toString()).toBe('# Modified\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
