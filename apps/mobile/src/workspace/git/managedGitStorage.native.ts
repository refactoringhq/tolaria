import { Directory, Paths } from 'expo-file-system'
import type { HttpClient } from 'isomorphic-git'
import type { NativeWorkspaceSelection } from '../nativeWorkspacePicker'
import { createExpoGitFileSystem } from './expoGitFileSystem'
import { gitVirtualRoot } from './gitFileSystemPaths'
import { githubRepositoryUrl } from './githubRepositoryUrl'
import { isManagedVaultId, type ManagedGitVault } from './managedGitVaults'
import { readManagedCatalogFile, writeManagedCatalogFile } from './managedCatalogFile.native'
import { withWorkspaceOperation } from './workspaceOperationQueue'

const catalogKey = 'managed-git-catalog'

export const readManagedGitCatalog = readManagedCatalogFile

export function activateManagedGitVault(id: string | null) {
  return withWorkspaceOperation(catalogKey, async () => {
    const catalog = await readManagedGitCatalog()
    if (id !== null && !catalog.vaults.some((vault) => vault.id === id)) throw new Error('vaultNotFound')
    await writeManagedCatalogFile({ ...catalog, activeId: id })
  })
}

export async function cloneManagedGitVault(repositoryUrl: string, http: HttpClient, token?: string): Promise<ManagedGitVault> {
  const url = githubRepositoryUrl(repositoryUrl)
  const vault = { id: `vault-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, repositoryUrl: url, label: url.split('/').at(-1)!.replace(/\.git$/u, '') }
  const directory = managedDirectory(vault)
  directory.parentDirectory.create({ intermediates: true, idempotent: true })
  directory.create()
  try {
    const { cloneGitVault } = await import('./gitRemote')
    await cloneGitVault({ ...managedGitConnection(vault), http, token }, url)
    await withWorkspaceOperation(catalogKey, async () => {
      const catalog = await readManagedGitCatalog()
      await writeManagedCatalogFile({ ...catalog, vaults: [...catalog.vaults, vault] })
    })
    return vault
  } catch (error) {
    if (directory.exists) directory.delete()
    throw error
  }
}

export function managedGitSelection(vault: ManagedGitVault): NativeWorkspaceSelection {
  const directory = managedDirectory(vault)
  if (!directory.exists || !new Directory(directory, '.git').exists) throw new Error('vaultNotFound')
  return { vaultAlias: vault.id, vaultLabel: vault.label, vaultRootUri: directory.uri }
}

export function managedGitConnection(vault: ManagedGitVault) {
  const rootUri = managedDirectory(vault).uri
  return { fs: createExpoGitFileSystem(rootUri), dir: gitVirtualRoot, operationKey: rootUri }
}

function managedDirectory(vault: ManagedGitVault) {
  if (!isManagedVaultId(vault.id)) throw new Error('vaultNotFound')
  return new Directory(Paths.document, 'Git Vaults', vault.id)
}
