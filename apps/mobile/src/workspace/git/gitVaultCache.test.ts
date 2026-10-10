import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { expect, it, vi } from 'vitest'
import { createGitVault } from './gitVault'
import { gitTestEnvironment } from './gitTestServer'

it('reads an immutable pack once across checkpoint and integration in one operation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tolaria-git-cache-'))
  const author = { name: 'Test', email: 'qa@example.invalid' }
  try {
    await git.init({ fs, dir, defaultBranch: 'main' })
    await writeFile(join(dir, 'note.md'), '# Packed note\n')
    await git.add({ fs, dir, filepath: 'note.md' })
    await git.commit({ fs, dir, author, message: 'Fixture' })
    execFileSync('git', ['-C', dir, 'repack', '-ad'], { env: gitTestEnvironment() })
    const read = vi.spyOn(fs.promises, 'readFile')
    const vault = createGitVault({ fs, dir })
    const first = await vault.checkpoint(author)
    expect(await vault.integrate(first.oid)).toBe('equal')
    expect((await vault.checkpoint(author)).changedFiles).toBe(0)
    const packReads = read.mock.calls.filter(([path]) => String(path).endsWith('.pack'))
    expect(packReads).toHaveLength(1)
  } finally {
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  }
})
