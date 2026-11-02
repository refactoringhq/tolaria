import { pickNativeWorkspaceDirectory } from '../nativeWorkspacePicker'
import { prepareNativeWorkspace } from '../prepareNativeWorkspace'
import { requireActiveSync } from '../syncCancellation'
import { folderOpenStep, FolderOpenFailure } from '../folderOpenFailure'
import { activateManagedGitVault, cloneManagedGitVault, forgetManagedVault, managedGitSelection } from './managedGitStorage'
import { activateManagedLocalVault, rememberLocalVault } from './managedLocalStorage'
import { nativeGitHttp } from './nativeGitHttp'
import type { MobileAnalyticsEvent } from '../../analytics/mobileAnalytics'
import type { GitHubSession } from './githubAuth'
import type { ManagedGitVault } from './managedGitVaults'
import type { ManagedLocalVault } from './managedLocalVaults'
import type { GitCloneControl } from './useGitCloneProgress'
import type { ActiveVault } from './useManagedVaultCatalog'

export type VaultTask = () => Promise<ActiveVault | null | 'cancelled' | 'unchanged'>
type CatalogActionsContext<Result> = {
  active: ActiveVault
  catalog: { vaults: readonly ManagedGitVault[]; reload: () => Promise<void> }
  perform: (task: VaultTask) => Promise<Result>
  currentSession: () => Promise<GitHubSession | null>
  runClone: <T>(task: (control: GitCloneControl) => Promise<T>) => Promise<T>
  startClone: () => void
  capture: (event: MobileAnalyticsEvent) => void
}

export function createMobileVaultCatalogActions<Result>(context: CatalogActionsContext<Result>) {
  const { active, catalog, perform, capture } = context
  const openFolder = () => perform(() => openLocalFolder(context))
  const select = (vault: ManagedGitVault) => perform(async () => {
    const next = await activateGit(vault)
    capture({ name: 'mobile_vault_catalog_used', action: 'switch', kind: 'git' })
    return next
  })
  const selectLocal = (vault: ManagedLocalVault) => perform(async () => {
    const selection = await activateManagedLocalVault(vault)
    capture({ name: 'mobile_vault_catalog_used', action: 'switch', kind: 'local' })
    return { selection: await prepareNativeWorkspace(selection), git: null }
  })
  const forget = (id: string) => perform(async () => {
    const kind = catalog.vaults.some(vault => vault.id === id) ? 'git' : 'local'
    const isActive = active.git?.id === id
      || active.selection?.catalogVaultId === id
      || active.selection?.vaultAlias === id
    await forgetManagedVault(id)
    await catalog.reload()
    capture({ name: 'mobile_vault_catalog_used', action: 'forget', kind })
    return isActive ? { selection: null, git: null } : 'unchanged'
  })
  const clone = async (url: string) => {
    await perform(() => context.runClone(control => cloneVault(context, url, control)))
  }
  return { openFolder, select, selectLocal, forget, clone }
}

async function openLocalFolder<Result>(context: CatalogActionsContext<Result>) {
  try {
    const selection = await folderOpenStep('picker', () => pickNativeWorkspaceDirectory(context.active.selection?.vaultRootUri))
    if (!selection) return 'cancelled' as const
    const vault = await folderOpenStep('catalog', () => rememberLocalVault(selection))
    await folderOpenStep('catalog', () => context.catalog.reload())
    const prepared = await folderOpenStep('prepare', async () => prepareNativeWorkspace(await activateManagedLocalVault(vault)))
    context.capture({ name: 'mobile_vault_catalog_used', action: 'add', kind: 'local' })
    return { selection: prepared, git: null }
  } catch (failure) {
    if (failure instanceof FolderOpenFailure) context.capture({ name: 'mobile_folder_open_failed', stage: failure.stage })
    throw failure
  }
}

async function activateGit(vault: ManagedGitVault): Promise<ActiveVault> {
  const selection = await managedGitSelection(vault)
  await activateManagedGitVault(vault.id)
  return { git: vault, selection: await prepareNativeWorkspace(selection) }
}

async function cloneVault<Result>(context: CatalogActionsContext<Result>, url: string, control: GitCloneControl) {
  context.startClone()
  let vault: ManagedGitVault
  try {
    const session = await context.currentSession()
    requireActiveSync(control.signal)
    vault = await cloneManagedGitVault(url, nativeGitHttp, session?.accessToken, control)
  } catch (failure) {
    if (control.signal.aborted) return 'cancelled' as const
    throw failure
  }
  await context.catalog.reload()
  context.capture({ name: 'mobile_vault_catalog_used', action: 'add', kind: 'git' })
  return activateGit(vault)
}
