import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isTauri } from '../mock-tauri'
import { pickFolder } from '../utils/vault-dialog'
import type { VaultOption } from '../components/StatusBar'

export const DEFAULT_VAULTS: VaultOption[] = isTauri()
  ? [
      { label: 'Demo v2', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
      { label: 'Laputa', path: '/Users/luca/Laputa' },
    ]
  : [
      { label: 'Demo v2', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
    ]

interface UseVaultSwitcherOptions {
  onSwitch: () => void
  onToast: (msg: string) => void
}

/** Manages vault path, extra vaults, switching, cloning, and local folder opening. */
export function useVaultSwitcher({ onSwitch, onToast }: UseVaultSwitcherOptions) {
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULTS[0].path)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])
  const allVaults = useMemo(() => [...DEFAULT_VAULTS, ...extraVaults], [extraVaults])

  // Refs ensure stable callbacks that always invoke the latest closures,
  // breaking the circular dependency between useVaultSwitcher and downstream hooks.
  const onSwitchRef = useRef(onSwitch)
  const onToastRef = useRef(onToast)
  useEffect(() => { onSwitchRef.current = onSwitch; onToastRef.current = onToast })

  const addVault = useCallback((path: string, label: string) => {
    setExtraVaults(prev => prev.some(v => v.path === path) ? prev : [...prev, { label, path }])
  }, [])

  const switchVault = useCallback((path: string) => {
    setVaultPath(path)
    onSwitchRef.current()
  }, [])

  const handleVaultCloned = useCallback((path: string, label: string) => {
    addVault(path, label)
    switchVault(path)
    onToastRef.current(`Vault "${label}" cloned and opened`)
  }, [addVault, switchVault])

  const handleOpenLocalFolder = useCallback(async () => {
    try {
      const path = await pickFolder('Open vault folder')
      if (!path) return
      const label = path.split('/').pop() || 'Local Vault'
      addVault(path, label)
      switchVault(path)
      onToastRef.current(`Vault "${label}" opened`)
    } catch (err) {
      console.error('Failed to open local folder:', err)
      onToastRef.current(`Failed to open folder: ${err}`)
    }
  }, [addVault, switchVault])

  return { vaultPath, allVaults, switchVault, handleVaultCloned, handleOpenLocalFolder }
}
