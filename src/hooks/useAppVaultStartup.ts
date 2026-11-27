import { useCallback } from 'react'
import type { NoteWindowParams } from '../utils/windowMode'
import { shouldPreferOnboardingVaultPath } from '../utils/appOrchestration'
import { useGettingStartedClone } from './useGettingStartedClone'
import { useOnboarding } from './useOnboarding'
import { useVaultSwitcher } from './useVaultSwitcher'

type VaultSwitcher = ReturnType<typeof useVaultSwitcher>

function useRememberVaultChoice({ allVaults, switchVault, syncVaultSelection }: VaultSwitcher) {
  return useCallback((vaultPath: string) => {
    if (!vaultPath) return
    if (allVaults.some((vault) => vault.path === vaultPath)) {
      switchVault(vaultPath)
      return
    }
    const label = vaultPath.split('/').filter(Boolean).pop() || 'Local Vault'
    syncVaultSelection(vaultPath, label)
  }, [allVaults, switchVault, syncVaultSelection])
}

function useVaultOnboarding(vaultSwitcher: VaultSwitcher, onToast: (message: string) => void) {
  const rememberVaultChoice = useRememberVaultChoice(vaultSwitcher)
  const showCloned = useCallback((vaultPath: string) => {
    onToast(`Getting Started vault cloned and opened at ${vaultPath}`)
  }, [onToast])
  const handleCloneReady = useCallback((vaultPath: string) => {
    rememberVaultChoice(vaultPath)
    showCloned(vaultPath)
  }, [rememberVaultChoice, showCloned])
  const handleVaultReady = useCallback((vaultPath: string, source: 'template' | 'empty' | 'existing') => {
    rememberVaultChoice(vaultPath)
    if (source === 'template') showCloned(vaultPath)
  }, [rememberVaultChoice, showCloned])
  const cloneGettingStartedVault = useGettingStartedClone({ onError: onToast, onSuccess: handleCloneReady })
  const onboarding = useOnboarding(vaultSwitcher.vaultPath, {
    onVaultReady: handleVaultReady,
    registerVault: vaultSwitcher.registerVaultSelection,
  }, vaultSwitcher.loaded)

  return { onboarding, cloneGettingStartedVault }
}

interface AppVaultStartupOptions {
  noteWindowParams: NoteWindowParams | null
  onSwitch: () => void
  onToast: (message: string) => void
}

export function useAppVaultStartup({ noteWindowParams, onSwitch, onToast }: AppVaultStartupOptions) {
  const vaultSwitcher = useVaultSwitcher({ onSwitch, onToast })
  const { onboarding, cloneGettingStartedVault } = useVaultOnboarding(vaultSwitcher, onToast)
  const selectedVaultPath = shouldPreferOnboardingVaultPath(onboarding.state, vaultSwitcher.allVaults)
    ? onboarding.state.vaultPath
    : vaultSwitcher.vaultPath

  return { vaultSwitcher, onboarding, cloneGettingStartedVault, resolvedPath: noteWindowParams?.vaultPath ?? selectedVaultPath }
}
