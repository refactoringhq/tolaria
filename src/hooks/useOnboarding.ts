import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { pickFolder } from '../utils/vault-dialog'

type OnboardingState =
  | { status: 'loading' }
  | { status: 'welcome'; defaultPath: string }
  | { status: 'vault-missing'; vaultPath: string; defaultPath: string }
  | { status: 'ready'; vaultPath: string }

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

const DISMISSED_KEY = 'laputa_welcome_dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function useOnboarding(initialVaultPath: string) {
  const [state, setState] = useState<OnboardingState>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const defaultPath = await tauriCall<string>('get_default_vault_path', {})
        const exists = await tauriCall<boolean>('check_vault_exists', { path: initialVaultPath })

        if (cancelled) return

        if (exists) {
          setState({ status: 'ready', vaultPath: initialVaultPath })
        } else if (wasDismissed()) {
          // User previously dismissed — show vault-missing instead of welcome
          setState({ status: 'vault-missing', vaultPath: initialVaultPath, defaultPath })
        } else {
          setState({ status: 'welcome', defaultPath })
        }
      } catch {
        // If commands fail (e.g. mock mode), just proceed
        if (!cancelled) setState({ status: 'ready', vaultPath: initialVaultPath })
      }
    }

    check()
    return () => { cancelled = true }
  }, [initialVaultPath])

  const handleCreateVault = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const vaultPath = await tauriCall<string>('create_getting_started_vault', { targetPath: null })
      markDismissed()
      setState({ status: 'ready', vaultPath })
    } catch (err) {
      setError(typeof err === 'string' ? err : `Failed to create vault: ${err}`)
    } finally {
      setCreating(false)
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    try {
      const path = await pickFolder('Open vault folder')
      if (!path) return
      markDismissed()
      setState({ status: 'ready', vaultPath: path })
    } catch (err) {
      setError(`Failed to open folder: ${err}`)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    markDismissed()
    setState({ status: 'ready', vaultPath: initialVaultPath })
  }, [initialVaultPath])

  return { state, creating, error, handleCreateVault, handleOpenFolder, handleDismiss }
}
