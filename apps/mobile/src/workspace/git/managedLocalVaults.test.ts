import { expect, it } from 'vitest'
import { parseManagedGitVaultCatalog } from './managedGitVaults'

const local = { id: 'local-one', label: 'One', directory: 'Local Vaults/local-one' }

it('restores multiple local copies independently of Git vaults', () => {
  const catalog = { vaults: [], activeId: null, localVaults: [local, { ...local, id: 'local-two', directory: 'Local Vaults/local-two' }], activeLocalId: local.id }
  expect(parseManagedGitVaultCatalog(JSON.stringify(catalog))).toEqual(catalog)
})

it('persists a validated local vault alias', () => {
  const catalog = { vaults: [], activeId: null, localVaults: [{ ...local, alias: 'local-notes' }], activeLocalId: local.id }
  expect(parseManagedGitVaultCatalog(JSON.stringify(catalog)).localVaults?.[0].alias).toBe('local-notes')
})

it.each(['../private', '/private', 'Local Vaults/../../private', 'file:///private', '.tolaria-mobile-config'])('rejects local directories outside imported copies: %s', (directory) => {
  expect(() => parseManagedGitVaultCatalog(JSON.stringify({ vaults: [], localVaults: [{ ...local, directory }] }))).toThrow('vaultCatalogInvalid')
})

it('migrates the original imported folder without relocating or deleting it', () => {
  const catalog = { vaults: [], activeId: null, localVaults: [{ ...local, directory: 'Tolaria Vault' }], activeLocalId: local.id }
  expect(parseManagedGitVaultCatalog(JSON.stringify(catalog))).toEqual(catalog)
})

it('rejects duplicate local identifiers and simultaneous active vaults', () => {
  const base = { vaults: [{ id: 'git-one', label: 'Git', repositoryUrl: 'https://github.com/team/notes.git' }], localVaults: [local] }
  expect(() => parseManagedGitVaultCatalog(JSON.stringify({ ...base, localVaults: [local, local] }))).toThrow()
  expect(() => parseManagedGitVaultCatalog(JSON.stringify({ ...base, activeId: 'git-one', activeLocalId: local.id }))).toThrow()
})
