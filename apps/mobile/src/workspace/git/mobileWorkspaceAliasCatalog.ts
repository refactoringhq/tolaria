import { mobileWorkspaceDeepLinkSlug, slugifyMobileWorkspaceAlias } from '../mobileWorkspaceAlias'
import { updateManagedGitCatalog } from './managedGitStorage'
import type { CatalogState, UpdateCatalog } from './useManagedVaultCatalog'

export async function updateCatalogAlias(id: string, value: string, setState: UpdateCatalog): Promise<string> {
  const alias = slugifyMobileWorkspaceAlias(value)
  if (!alias) throw new Error('workspaceSlugInvalid')
  const catalog = await persistCatalogAlias(id, alias)
  const entries = [...catalog.vaults, ...(catalog.localVaults ?? [])]
  const savedVault = entries.find(vault => vault.id === id)
  const effectiveSlug = savedVault ? mobileWorkspaceDeepLinkSlug(savedVault, entries) : alias
  setState(previous => updatedAliasState({ state: previous, catalog, id, effectiveSlug, alias }))
  return savedVault?.alias ?? alias
}

async function persistCatalogAlias(id: string, alias: string) {
  return updateManagedGitCatalog(catalog => {
    if (!catalogContainsVault(catalog, id)) throw new Error('vaultNotFound')
    return {
      ...catalog,
      vaults: catalog.vaults.map(vault => vault.id === id ? { ...vault, alias } : vault),
      localVaults: catalog.localVaults?.map(vault => vault.id === id ? { ...vault, alias } : vault),
    }
  })
}

function catalogContainsVault(catalog: Awaited<ReturnType<typeof updateManagedGitCatalog>>, id: string) {
  return [...catalog.vaults, ...(catalog.localVaults ?? [])].some(vault => vault.id === id)
}

function updatedAliasState({ state, catalog, id, effectiveSlug, alias }: {
  state: CatalogState
  catalog: Awaited<ReturnType<typeof updateManagedGitCatalog>>
  id: string
  effectiveSlug: string
  alias: string
}): CatalogState {
  const nextState = { ...state, ...catalogLists(catalog) }
  if (state.restored?.selection?.catalogVaultId !== id) return nextState
  return {
    ...nextState,
    restored: {
      ...state.restored,
      selection: { ...state.restored.selection, vaultAlias: effectiveSlug },
      git: state.restored.git ? { ...state.restored.git, alias } : null,
    },
  }
}

function catalogLists(catalog: Awaited<ReturnType<typeof updateManagedGitCatalog>>) {
  return { vaults: catalog.vaults, localVaults: catalog.localVaults ?? [] }
}
