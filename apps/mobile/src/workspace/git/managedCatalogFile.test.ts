import { beforeEach, expect, it, vi } from 'vitest'
import { readManagedCatalogFile, writeManagedCatalogFile } from './managedCatalogFile.native'

const disk = vi.hoisted(() => ({ files: new Map<string, string>(), failPublish: false }))
vi.mock('expo-file-system', () => ({
  Paths: { document: '/documents' },
  File: class {
    uri: string
    constructor(...parts: string[]) { this.uri = parts.join('/') }
    get exists() { return disk.files.has(this.uri) }
    get parentDirectory() { return { create: () => {} } }
    async text() { return disk.files.get(this.uri) ?? '' }
    write(value: string) { disk.files.set(this.uri, value) }
    delete() { disk.files.delete(this.uri) }
    move(target: { uri: string }) {
      if (disk.failPublish && this.uri.endsWith('.pending')) throw new Error('interrupted')
      disk.files.set(target.uri, disk.files.get(this.uri)!)
      disk.files.delete(this.uri)
      this.uri = target.uri
    }
  },
}))

const catalog = { vaults: [{ id: 'vault-1', label: 'Notes', repositoryUrl: 'https://github.com/team/notes.git' }], activeId: 'vault-1' }
beforeEach(() => { disk.files.clear(); disk.failPublish = false })

it('recovers the last complete catalog if publication is interrupted', async () => {
  await writeManagedCatalogFile(catalog)
  disk.failPublish = true
  await expect(writeManagedCatalogFile({ ...catalog, activeId: null })).rejects.toThrow('interrupted')
  expect(await readManagedCatalogFile()).toEqual(catalog)
  disk.failPublish = false
  await writeManagedCatalogFile({ ...catalog, activeId: null })
  expect((await readManagedCatalogFile()).activeId).toBeNull()
})

it('never silently resets a corrupt catalog that has no valid backup', async () => {
  disk.files.set('/documents/.tolaria-mobile-config/git-vaults.json', 'broken')
  await expect(readManagedCatalogFile()).rejects.toThrow('vaultCatalogInvalid')
})
