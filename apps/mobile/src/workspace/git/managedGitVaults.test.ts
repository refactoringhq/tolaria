import { expect, it } from 'vitest'
import { parseManagedGitVaultCatalog } from './managedGitVaults'

it('restores only validated app-owned vault identifiers and credential-free repository URLs', () => {
  const vault = { id: 'vault-123', repositoryUrl: 'https://github.com/team/notes', label: 'Notes' }
  expect(parseManagedGitVaultCatalog(JSON.stringify({ vaults: [vault], activeId: vault.id }))).toEqual({
    vaults: [{ ...vault, repositoryUrl: 'https://github.com/team/notes.git' }], activeId: vault.id,
  })
  expect(() => parseManagedGitVaultCatalog(JSON.stringify({ vaults: [{ ...vault, id: '../private' }] }))).toThrow()
  expect(() => parseManagedGitVaultCatalog(JSON.stringify({ vaults: [{ ...vault, repositoryUrl: 'https://secret@github.com/team/notes' }] }))).toThrow()
})

it('does not invent an active vault or overwrite a corrupt catalog with an empty one', () => {
  expect(parseManagedGitVaultCatalog(null)).toEqual({ vaults: [], activeId: null })
  expect(parseManagedGitVaultCatalog('{"vaults":[],"activeId":"missing"}').activeId).toBeNull()
  expect(() => parseManagedGitVaultCatalog('broken')).toThrow('vaultCatalogInvalid')
  expect(() => parseManagedGitVaultCatalog('{"vaults":[{}]}')).toThrow('vaultCatalogInvalid')
})
