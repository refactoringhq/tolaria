import { useMemo, useState } from 'react'
import { useMobileVaultEvents } from '../../analytics/useMobileDiscoveryEvents'
import type { ActiveVault, useManagedVaultCatalog } from './useManagedVaultCatalog'

export function useMobileVaultSelection(catalog: ReturnType<typeof useManagedVaultCatalog>) {
  const [override, setOverride] = useState<ActiveVault | null>(null)
  const active = useMemo(
    () => override ?? catalog.restored ?? { selection: null, git: null },
    [catalog.restored, override],
  )
  useMobileVaultEvents(active.selection?.vaultRootUri)
  return { active, setOverride }
}
