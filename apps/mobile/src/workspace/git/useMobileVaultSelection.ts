import { useMemo, useState } from 'react'
import { useMobileVaultEvents } from '../../analytics/useMobileDiscoveryEvents'
import { mobileWorkspaceDeepLinkSlug } from '../mobileWorkspaceAlias'
import type { ActiveVault, useManagedVaultCatalog } from './useManagedVaultCatalog'

export function useMobileVaultSelection(catalog: ReturnType<typeof useManagedVaultCatalog>) {
  const [override, setOverride] = useState<ActiveVault | null>(null)
  const active = useMemo(() => currentCatalogSelection(
    override ?? catalog.restored ?? { selection: null, git: null },
    catalog.vaults,
    catalog.localVaults,
  ), [catalog.localVaults, catalog.vaults, catalog.restored, override])
  useMobileVaultEvents(active.selection?.vaultRootUri)
  return { active, setOverride }
}

function currentCatalogSelection(
  selected: ActiveVault,
  gitVaults: ReturnType<typeof useManagedVaultCatalog>['vaults'],
  localVaults: ReturnType<typeof useManagedVaultCatalog>['localVaults'],
): ActiveVault {
  const selection = selected.selection
  const catalogVaultId = selection?.catalogVaultId
  if (!selection || !catalogVaultId) return selected
  const vaults = [...gitVaults, ...localVaults]
  const vault = vaults.find(entry => entry.id === catalogVaultId)
  if (!vault) return selected
  return {
    ...selected,
    selection: { ...selection, vaultAlias: mobileWorkspaceDeepLinkSlug(vault, vaults) },
    git: selected.git ? { ...selected.git, alias: vault.alias } : null,
  }
}
