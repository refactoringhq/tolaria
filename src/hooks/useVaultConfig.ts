import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export interface VaultConfig {
  label: string
  path: string
}

function tauriCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

export function useVaultConfig() {
  const [vaults, setVaults] = useState<VaultConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load vault list on mount
  useEffect(() => {
    tauriCall<VaultConfig[]>('get_vaults')
      .then((v) => { setVaults(v); setLoading(false) })
      .catch((err) => { console.warn('Failed to load vaults:', err); setLoading(false) })
  }, [])

  const addVault = useCallback(async (path: string): Promise<VaultConfig> => {
    setError(null)
    try {
      const vault = await tauriCall<VaultConfig>('add_vault', { path })
      setVaults((prev) => {
        // Deduplicate by path
        if (prev.some((v) => v.path === vault.path)) return prev
        return [...prev, vault]
      })
      return vault
    } catch (err) {
      const msg = String(err)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const removeVault = useCallback(async (path: string) => {
    setError(null)
    try {
      await tauriCall<void>('remove_vault', { path })
      setVaults((prev) => prev.filter((v) => v.path !== path))
    } catch (err) {
      const msg = String(err)
      setError(msg)
    }
  }, [])

  const initVault = useCallback(async (path: string) => {
    setError(null)
    try {
      await tauriCall<void>('init_vault', { path })
    } catch (err) {
      const msg = String(err)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { vaults, loading, error, addVault, removeVault, initVault, clearError }
}
