import type { HttpClient } from 'isomorphic-git'
import type { NativeWorkspaceSelection } from '../nativeWorkspacePicker'
import type { ManagedGitVault, ManagedGitVaultCatalog } from './managedGitVaults'
import type { GitRemoteOptions } from './gitRemote'

export async function readManagedGitCatalog(): Promise<ManagedGitVaultCatalog> {
  return { vaults: [], activeId: null }
}
export async function updateManagedGitCatalog(update: (catalog: ManagedGitVaultCatalog) => ManagedGitVaultCatalog): Promise<ManagedGitVaultCatalog> { void update; throw new Error('nativeOnly') }
export async function activateManagedGitVault(id: string | null) { void id; throw new Error('nativeOnly') }
export async function forgetManagedVault(id: string) { void id; throw new Error('nativeOnly') }
export async function cloneManagedGitVault(url: string, http: HttpClient, token?: string,
  control: Pick<GitRemoteOptions, 'signal' | 'onProgress'> & { onPublish?: () => void } = {}): Promise<ManagedGitVault> {
  void url; void http; void token; void control; throw new Error('nativeOnly')
}
export async function managedGitSelection(vault: ManagedGitVault): Promise<NativeWorkspaceSelection> { void vault; throw new Error('nativeOnly') }
export function managedGitConnection(vault: ManagedGitVault): Omit<GitRemoteOptions, 'http'> { void vault; throw new Error('nativeOnly') }
