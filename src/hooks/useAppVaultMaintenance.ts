import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'
import { isTauri, mockInvoke } from '../mock-tauri'

interface VaultMaintenanceOptions {
  resolvedPath: string
  reloadVault: () => Promise<unknown>
  refreshVaultAiGuidance: () => Promise<unknown>
  setToastMessage: (message: string) => void
}

export function useAppVaultMaintenance({
  resolvedPath, reloadVault, refreshVaultAiGuidance, setToastMessage,
}: VaultMaintenanceOptions) {
  const handleRepairVault = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('repair_vault', { vaultPath: resolvedPath })
      await reloadVault()
      await refreshVaultAiGuidance()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to repair vault: ${err}`)
    }
  }, [refreshVaultAiGuidance, reloadVault, resolvedPath, setToastMessage])

  const restoreVaultAiGuidance = useCallback(async (successToast: string | null = 'Tolaria AI guidance restored') => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      await tauriInvoke('restore_vault_ai_guidance', { vaultPath: resolvedPath })
      await reloadVault()
      await refreshVaultAiGuidance()
      if (successToast) setToastMessage(successToast)
    } catch (err) {
      setToastMessage(`Failed to restore Tolaria AI guidance: ${err}`)
    }
  }, [refreshVaultAiGuidance, reloadVault, resolvedPath, setToastMessage])

  return { handleRepairVault, restoreVaultAiGuidance }
}
