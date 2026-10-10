import { createContext } from 'react'
import type { VaultSyncState } from './git/useMobileVaults'

export const MobileVaultControlsContext = createContext<{
  rootUri?: string
  git: boolean
  busy: boolean
  status: VaultSyncState
  open: () => Promise<void>
  sync: () => Promise<void>
} | null>(null)

export const MobileVaultDisplayContext = createContext<{ source: string; rootUri?: string | null } | null>(null)
