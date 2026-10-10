import fs from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { createExpoGitFileSystem } from './expoGitFileSystem'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'tolaria-native-git-fs-'))
  roots.push(root)
  const counts = { files: 0, lists: 0, directoryNames: 0 }
  const module = {
    File: class {
      constructor(readonly uri: string) { counts.files++ }
      bytes = async () => fs.readFileSync(fileURLToPath(this.uri))
      write = (content: string | Uint8Array) => fs.writeFileSync(fileURLToPath(this.uri), content)
      delete = () => fs.unlinkSync(fileURLToPath(this.uri))
      info = () => {
        const stat = fs.statSync(fileURLToPath(this.uri))
        return { exists: true, size: stat.size, modificationTime: stat.mtimeMs, creationTime: stat.ctimeMs }
      }
    },
    Directory: class {
      constructor(readonly uri: string) {}
      create = () => fs.mkdirSync(fileURLToPath(this.uri))
      delete = () => fs.rmdirSync(fileURLToPath(this.uri))
      list = () => { counts.lists++; return fs.readdirSync(fileURLToPath(this.uri)).map((name) => ({ name })) }
    },
    Paths: { info: (uri: string) => {
      const stat = fs.statSync(fileURLToPath(uri), { throwIfNoEntry: false })
      return { exists: Boolean(stat), isDirectory: stat?.isDirectory() ?? null }
    } },
  }
  const readDirectory = async (uri: string) => {
    counts.directoryNames++
    return fs.readdirSync(fileURLToPath(uri))
  }
  const adapter = createExpoGitFileSystem(pathToFileURL(root).href, module, readDirectory).promises
  return { adapter, counts, root }
}

it('reuses native handles but always reads fresh bytes and metadata', async () => {
  const { adapter, counts } = await fixture()
  await adapter.writeFile('/vault/note.md', 'first')
  expect(await adapter.readFile('/vault/note.md', 'utf8')).toBe('first')
  expect((await adapter.stat('/vault/note.md')).size).toBe(5)
  await adapter.writeFile('/vault/note.md', 'updated content')
  expect(await adapter.readFile('/vault/note.md', 'utf8')).toBe('updated content')
  expect((await adapter.stat('/vault/note.md')).size).toBe(15)
  expect(counts.files).toBe(1)
})

it('enumerates names without constructing a native File for every child', async () => {
  const { adapter, counts } = await fixture()
  await adapter.writeFile('/vault/a.md', 'A')
  await adapter.writeFile('/vault/b.md', 'B')
  expect((await adapter.readdir('/vault')).sort()).toEqual(['a.md', 'b.md'])
  expect(counts.lists).toBe(0)
  expect(counts.directoryNames).toBe(1)
})

it('preserves byte views, encoded names, and filesystem error semantics', async () => {
  const { adapter } = await fixture()
  const bytes = new Uint8Array([99, 0, 255, 128, 88])
  await adapter.mkdir('/vault/a folder')
  await adapter.writeFile('/vault/a folder/100%.bin', bytes.subarray(1, 4))
  expect(await adapter.readFile('/vault/a folder/100%.bin')).toEqual(Buffer.from([0, 255, 128]))
  await expect(adapter.readFile('/vault/a folder')).rejects.toMatchObject({ code: 'EISDIR' })
  await expect(adapter.readdir('/vault/a folder/100%.bin')).rejects.toMatchObject({ code: 'ENOTDIR' })
  await expect(adapter.rmdir('/vault/a folder')).rejects.toMatchObject({ code: 'ENOTEMPTY' })
  await adapter.unlink('/vault/a folder/100%.bin')
  await expect(adapter.stat('/vault/a folder/100%.bin')).rejects.toMatchObject({ code: 'ENOENT' })
  await adapter.rmdir('/vault/a folder')
  await expect(adapter.writeFile('/vault/missing/a.md', 'no')).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(adapter.writeFile('/vault/../escape.md', 'no')).rejects.toThrow('outsideGitVault')
})
