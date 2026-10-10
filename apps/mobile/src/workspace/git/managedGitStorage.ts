import type { HttpClient } from 'isomorphic-git'
import type { NativeWorkspaceSelection } from '../nativeWorkspacePicker'
import type { ManagedGitVault, ManagedGitVaultCatalog } from './managedGitVaults'
import type { GitRemoteOptions } from './gitRemote'

export async function readManagedGitCatalog(): Promise<ManagedGitVaultCatalog> {
  return { vaults: [], activeId: null }
}
export async function activateManagedGitVault(id: string | null) { void id; throw new Error('nativeOnly') }
export async function cloneManagedGitVault(url: string, http: HttpClient, token?: string): Promise<ManagedGitVault> {
  void url; void http; void token; throw new Error('nativeOnly')
}
export function managedGitSelection(vault: ManagedGitVault): NativeWorkspaceSelection { void vault; throw new Error('nativeOnly') }
export function managedGitConnection(vault: ManagedGitVault): Omit<GitRemoteOptions, 'http'> { void vault; throw new Error('nativeOnly') }
