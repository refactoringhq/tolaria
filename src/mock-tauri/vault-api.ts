/**
 * Vault API detection and proxy for browser dev mode.
 * When a local vault API server is running, routes read commands through it
 * instead of returning hardcoded mock data.
 */

let vaultApiAvailable: boolean | null = null

async function checkVaultApi(): Promise<boolean> {
  if (vaultApiAvailable !== null) return vaultApiAvailable
  try {
    const res = await fetch('/api/vault/ping', { signal: AbortSignal.timeout(500) })
    vaultApiAvailable = res.ok
  } catch {
    vaultApiAvailable = false
  }
  console.info(`[mock-tauri] Vault API available: ${vaultApiAvailable}`)
  return vaultApiAvailable
}

const VAULT_API_COMMANDS: Record<string, (args: Record<string, unknown>) => string | null> = {
  list_vault: (args) => args.path ? `/api/vault/list?path=${encodeURIComponent(args.path as string)}` : null,
  get_note_content: (args) => args.path ? `/api/vault/content?path=${encodeURIComponent(args.path as string)}` : null,
  get_all_content: (args) => args.path ? `/api/vault/all-content?path=${encodeURIComponent(args.path as string)}` : null,
}

export async function tryVaultApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const available = await checkVaultApi()
  if (!available) return undefined

  const urlBuilder = VAULT_API_COMMANDS[cmd]
  if (!urlBuilder || !args) return undefined

  const url = urlBuilder(args)
  if (!url) return undefined

  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const data = await res.json()
    return (cmd === 'get_note_content' ? data.content : data) as T
  } catch (err) {
    console.warn(`[mock-tauri] Vault API call failed for ${cmd}, falling back to mock:`, err)
    return undefined
  }
}
