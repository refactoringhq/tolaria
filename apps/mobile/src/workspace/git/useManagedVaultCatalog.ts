import { useCallback, useEffect, useState } from 'react'
import { managedGitSelection, readManagedGitCatalog } from './managedGitStorage'
import type { ManagedGitVault } from './managedGitVaults'
import type { NativeWorkspaceSelection } from '../nativeWorkspacePicker'

export type ActiveVault = { selection: NativeWorkspaceSelection | null; git: ManagedGitVault | null }

export function useManagedVaultCatalog() {
  const [vaults, setVaults] = useState<ManagedGitVault[]>([])
  const [restored, setRestored] = useState<ActiveVault | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void readManagedGitCatalog().then(async (catalog) => {
      if (!active) return
      setVaults(catalog.vaults)
      const git = catalog.vaults.find((vault) => vault.id === catalog.activeId)
      if (!git) return
      const selection = await managedGitSelection(git)
      if (active) setRestored({ git, selection })
    }).catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setPending(false) })
    return () => { active = false }
  }, [])
  const reload = useCallback(async () => {
    const catalog = await readManagedGitCatalog()
    setVaults(catalog.vaults)
    setError(false)
  }, [])
  return { vaults, restored, pending, error, reload }
}
