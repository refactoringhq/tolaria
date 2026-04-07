import type { VaultConfig } from '../types'

type SaveFn = (config: VaultConfig) => void
type Listener = () => void

const DEFAULT_CONFIG: VaultConfig = {
  zoom: null, view_mode: null, editor_mode: null,
  tag_colors: null, status_colors: null, property_display_modes: null,
  inbox: null,
}

let config: VaultConfig = DEFAULT_CONFIG
let saveFn: SaveFn | null = null
const listeners: Set<Listener> = new Set()

export function getVaultConfig(): VaultConfig {
  return config
}

export function bindVaultConfigStore(initial: VaultConfig, save: SaveFn): void {
  config = initial
  saveFn = save
  notify()
}

export function resetVaultConfigStore(): void {
  config = DEFAULT_CONFIG
  saveFn = null
}

export function updateVaultConfigField<K extends keyof VaultConfig>(key: K, value: VaultConfig[K]): void {
  config = { ...config, [key]: value }
  saveFn?.(config)
  notify()
}

export function subscribeVaultConfig(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notify(): void {
  for (const fn of listeners) fn()
}
