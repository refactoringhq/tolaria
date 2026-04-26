import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

const VAULT_CHANGED_EVENT = 'vault-changed'
const FRONT_DEBOUNCE_MS = 1000

interface VaultChangedPayload {
  vault_path: string
  paths: string[]
}

type Unlisten = () => void

function safeUnlisten(unlisten: Unlisten | null) {
  if (!unlisten) return
  try { unlisten() } catch (err) { console.warn('Failed to unlisten vault-changed:', err) }
}

async function startBackendWatcher(path: string): Promise<void> {
  try { await invoke('start_vault_watcher', { path }) }
  catch (err) { console.warn('start_vault_watcher failed:', err) }
}

async function stopBackendWatcher(): Promise<void> {
  try { await invoke('stop_vault_watcher') }
  catch (err) { console.warn('stop_vault_watcher failed:', err) }
}

export function useVaultWatcher(vaultPath: string, onVaultChanged: () => void) {
  const handlerRef = useRef(onVaultChanged)
  useEffect(() => { handlerRef.current = onVaultChanged }, [onVaultChanged])

  useEffect(() => {
    if (!isTauri() || !vaultPath) return

    let disposed = false
    let unlisten: Unlisten | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    void startBackendWatcher(vaultPath)

    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const teardown = await listen<VaultChangedPayload>(VAULT_CHANGED_EVENT, (event) => {
          if (event.payload.vault_path !== vaultPath) return
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => { handlerRef.current() }, FRONT_DEBOUNCE_MS)
        })
        if (disposed) { safeUnlisten(teardown); return }
        unlisten = teardown
      })
      .catch((err) => { console.warn('listen vault-changed failed:', err) })

    return () => {
      disposed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      safeUnlisten(unlisten)
      void stopBackendWatcher()
    }
  }, [vaultPath])
}
