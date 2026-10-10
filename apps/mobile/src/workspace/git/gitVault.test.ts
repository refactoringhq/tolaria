import fs from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git from 'isomorphic-git'
import { afterEach, describe, expect, it } from 'vitest'
import { createGitVault, githubRepositoryUrl } from './gitVault'

const author = { name: 'Test Author', email: 'qa@example.invalid' }
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

async function repository() {
  const dir = await mkdtemp(join(tmpdir(), 'tolaria-git-'))
  roots.push(dir)
  await git.init({ fs, dir, defaultBranch: 'main' })
  await writeFile(join(dir, 'note.md'), '---\ntags: [work]\n---\n# Original\n')
  await git.add({ fs, dir, filepath: '.' })
  await git.commit({ fs, dir, author, message: 'Initial' })
  return dir
}

describe('GitHub vault URL policy', () => {
  it('normalizes only credential-free GitHub HTTPS repositories', () => {
    expect(githubRepositoryUrl('https://github.com/team/vault/')).toBe('https://github.com/team/vault.git')
    expect(githubRepositoryUrl('https://github.com/team/vault.git')).toBe('https://github.com/team/vault.git')
    for (const url of ['http://github.com/a/b', 'https://user:token@github.com/a/b', 'https://evil.test/a/b', 'https://github.com/a/b?token=x', 'https://github.com/a/b/tree/main']) {
      expect(() => githubRepositoryUrl(url)).toThrow()
    }
  })
})

describe('on-device Git checkpoints', () => {
  it('commits actual additions, edits, and removals without changing frontmatter or binary bytes', async () => {
    const dir = await repository()
    const content = '---\ntags: [work, mobile]\ncustom: yes\n---\n# Updated\n'
    await writeFile(join(dir, 'note.md'), content)
    const binary = new Uint8Array([0, 255, 10, 128])
    await writeFile(join(dir, 'attachment.bin'), binary)
    const vault = createGitVault({ fs, dir })
    const checkpoint = await vault.checkpoint(author)
    expect(checkpoint.changedFiles).toBe(2)
    expect((await git.log({ fs, dir }))).toHaveLength(2)
    expect(await readFile(join(dir, 'note.md'), 'utf8')).toBe(content)
    expect(await readFile(join(dir, 'attachment.bin'))).toEqual(Buffer.from(binary))
    expect((await vault.checkpoint(author)).changedFiles).toBe(0)
    await rm(join(dir, 'note.md'))
    expect((await vault.checkpoint(author)).changedFiles).toBe(1)
    expect(await git.listFiles({ fs, dir })).toEqual(['attachment.bin'])
  })

  it('compares real commit graphs and never discards divergent local edits', async () => {
    const dir = await repository()
    const initial = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    await git.branch({ fs, dir, ref: 'other' })
    await writeFile(join(dir, 'note.md'), '# Local\n')
    const vault = createGitVault({ fs, dir })
    const { oid: local } = await vault.checkpoint(author)
    expect(await vault.relationship(initial)).toBe('ahead')
    expect(await vault.relationship(local)).toBe('equal')
    await git.checkout({ fs, dir, ref: 'other' })
    await writeFile(join(dir, 'note.md'), '# Remote\n')
    const { oid: remote } = await vault.checkpoint(author)
    await git.checkout({ fs, dir, ref: 'main' })
    expect(await vault.relationship(remote)).toBe('diverged')
    expect(await vault.integrate(remote)).toBe('diverged')
    expect(await readFile(join(dir, 'note.md'), 'utf8')).toBe('# Local\n')
    expect(await git.resolveRef({ fs, dir, ref: 'HEAD' })).toBe(local)
    expect((await git.readCommit({ fs, dir, oid: remote })).commit.parent).toEqual([initial])
  })

  it('fast-forwards a clean working copy and updates the files', async () => {
    const dir = await repository()
    await git.branch({ fs, dir, ref: 'other' })
    await git.checkout({ fs, dir, ref: 'other' })
    await writeFile(join(dir, 'note.md'), '# Remote change\n')
    const vault = createGitVault({ fs, dir })
    const { oid } = await vault.checkpoint(author)
    await git.checkout({ fs, dir, ref: 'main' })
    expect(await vault.relationship(oid)).toBe('behind')
    expect(await vault.integrate(oid)).toBe('updated')
    expect(await readFile(join(dir, 'note.md'), 'utf8')).toBe('# Remote change\n')
  })

  it('refuses checkout over an uncommitted working copy', async () => {
    const dir = await repository()
    const vault = createGitVault({ fs, dir })
    const oid = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    await writeFile(join(dir, 'note.md'), '# Unsaved to Git\n')
    await expect(vault.integrate(oid)).rejects.toThrow('dirty')
    expect(await readFile(join(dir, 'note.md'), 'utf8')).toBe('# Unsaved to Git\n')
  })
})
