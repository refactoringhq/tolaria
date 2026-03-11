/**
 * Vault API detection and proxy for browser dev mode.
 * When a local vault API server is running, routes read and write commands
 * through it instead of returning hardcoded mock data.
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

interface VaultApiRequest {
  url: string
  method?: string
  body?: unknown
}

/** Tracks last vault path for commands that don't receive it as an argument. */
let lastVaultPath: string | null = null

const VAULT_API_COMMANDS: Record<string, (args: Record<string, unknown>) => VaultApiRequest | null> = {
  list_vault: (args) => {
    if (args.path) lastVaultPath = args.path as string
    return args.path ? { url: `/api/vault/list?path=${encodeURIComponent(args.path as string)}` } : null
  },
  reload_vault: (args) => {
    if (args.path) lastVaultPath = args.path as string
    return args.path ? { url: `/api/vault/list?path=${encodeURIComponent(args.path as string)}&reload=1` } : null
  },
  reload_vault_entry: (args) =>
    args.path ? { url: `/api/vault/entry?path=${encodeURIComponent(args.path as string)}` } : null,
  get_note_content: (args) =>
    args.path ? { url: `/api/vault/content?path=${encodeURIComponent(args.path as string)}` } : null,
  get_all_content: (args) =>
    args.path ? { url: `/api/vault/all-content?path=${encodeURIComponent(args.path as string)}` } : null,
  save_note_content: (args) =>
    args.path ? { url: '/api/vault/save', method: 'POST', body: { path: args.path, content: args.content } } : null,
  rename_note: (args) =>
    args.old_path ? { url: '/api/vault/rename', method: 'POST', body: { vault_path: args.vault_path, old_path: args.old_path, new_title: args.new_title } } : null,
  delete_note: (args) =>
    args.path ? { url: '/api/vault/delete', method: 'POST', body: { path: args.path } } : null,
  search_vault: (args) => {
    const q = args.query as string
    if (!q || !lastVaultPath) return null
    return { url: `/api/vault/search?vault_path=${encodeURIComponent(lastVaultPath)}&query=${encodeURIComponent(q)}&mode=${encodeURIComponent((args.mode as string) || 'all')}` }
  },
}

export async function tryVaultApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const available = await checkVaultApi()
  if (!available) return undefined

  const requestBuilder = VAULT_API_COMMANDS[cmd]
  if (!requestBuilder || !args) return undefined

  const request = requestBuilder(args)
  if (!request) return undefined

  try {
    const fetchOpts: RequestInit = { method: request.method || 'GET' }
    if (request.body) {
      fetchOpts.headers = { 'Content-Type': 'application/json' }
      fetchOpts.body = JSON.stringify(request.body)
    }
    const res = await fetch(request.url, fetchOpts)
    if (!res.ok) return undefined
    const data = await res.json()
    return (cmd === 'get_note_content' ? data.content : data) as T
  } catch (err) {
    console.warn(`[mock-tauri] Vault API call failed for ${cmd}, falling back to mock:`, err)
    return undefined
  }
}
