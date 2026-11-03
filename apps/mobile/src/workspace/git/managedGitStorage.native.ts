import { Directory, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import type { HttpClient } from 'isomorphic-git'
import type { NativeWorkspaceSelection } from '../nativeWorkspacePicker'
import { gitFileSystemSession } from './gitFileSystemSessions'
import { gitVirtualRoot } from './gitFileSystemPaths'
import { githubRepositoryUrl } from './githubRepositoryUrl'
import { mobileWorkspaceAlias } from '../mobileWorkspaceAlias'
import { isManagedVaultId, type ManagedGitVault, type ManagedGitVaultCatalog } from './managedGitVaults'
import { readManagedCatalogFile, writeManagedCatalogFile } from './managedCatalogFile.native'
import { withWorkspaceOperation } from './workspaceOperationQueue'
import type { GitRemoteOptions } from './gitRemote'

const catalogOperation = 'managed-git-catalog'

export const readManagedGitCatalog = readManagedCatalogFile

export function updateManagedGitCatalog(update: (catalog: ManagedGitVaultCatalog) => ManagedGitVaultCatalog) {
  return withWorkspaceOperation(catalogOperation, async () => {
    const next = update(await readManagedGitCatalog())
    await writeManagedCatalogFile(next)
    return next
  })
}

export function forgetManagedVault(id: string) {
  return updateManagedGitCatalog(catalog => ({
    ...catalog,
    vaults: catalog.vaults.filter(vault => vault.id !== id),
    localVaults: catalog.localVaults?.filter(vault => vault.id !== id),
    activeId: catalog.activeId === id ? null : catalog.activeId,
    activeLocalId: catalog.activeLocalId === id ? null : catalog.activeLocalId,
  }))
}

export function activateManagedGitVault(id: string | null) {
  return updateManagedGitCatalog(catalog => {
    if (id !== null && !catalog.vaults.some((vault) => vault.id === id)) throw new Error('vaultNotFound')
    return { ...catalog, activeId: id, activeLocalId: null }
  })
}

export async function cloneManagedGitVault(repositoryUrl: string, http: HttpClient, token?: string,
  control: Pick<GitRemoteOptions, 'signal' | 'onProgress'> & { onPublish?: () => void } = {}): Promise<ManagedGitVault> {
  const url = githubRepositoryUrl(repositoryUrl)
  const vault = { id: `vault-${randomUUID()}`, repositoryUrl: url, label: (url.split('/').at(-1) ?? 'GitHub').replace(/\.git$/u, '') }
  const directory = managedDirectory(vault)
  directory.parentDirectory.create({ intermediates: true, idempotent: true })
  directory.create()
  try {
    const { cloneGitVault } = await import('./gitRemote')
    await cloneGitVault({ ...managedGitConnection(vault), http, token, ...control }, url)
  } catch (error) {
    if (directory.exists) directory.delete()
    throw error
  }
  // Once publication starts, retain the completed clone even if catalog IO fails.
  control.onPublish?.()
  await updateManagedGitCatalog(catalog => ({ ...catalog, vaults: [...catalog.vaults, vault] }))
  return vault
}

export async function managedGitSelection(vault: ManagedGitVault): Promise<NativeWorkspaceSelection> {
  const directory = managedDirectory(vault)
  if (!directory.exists || !new Directory(directory, '.git').exists) throw new Error('vaultNotFound')
  const connection = managedGitConnection(vault)
  const { createGitVault } = await import('./gitVault')
  await withWorkspaceOperation(connection.operationKey, () => createGitVault(connection).recover())
  return { catalogVaultId: vault.id, vaultAlias: mobileWorkspaceAlias({ alias: vault.alias, label: vault.label }),
    vaultLabel: vault.label, vaultRootUri: directory.uri }
}

export function managedGitConnection(vault: ManagedGitVault) {
  const rootUri = managedDirectory(vault).uri
  return { fs: gitFileSystemSession(rootUri), dir: gitVirtualRoot, operationKey: rootUri }
}

function managedDirectory(vault: ManagedGitVault) {
  if (!isManagedVaultId(vault.id)) throw new Error('vaultNotFound')
  return new Directory(Paths.document, 'Git Vaults', vault.id)
}
