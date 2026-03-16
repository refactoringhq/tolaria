import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

interface HealthReport {
  stray_files: string[]
  title_mismatches: { path: string; filename: string; title: string; expected_filename: string }[]
}

interface FlatVaultMigration {
  /** True if stray files were detected in non-protected subfolders. */
  needsMigration: boolean
  /** List of stray file paths (relative to vault root). */
  strayFiles: string[]
  /** Dismiss the migration prompt without migrating. */
  dismiss: () => void
  /** Run flatten_vault and reload. Returns the count of files moved. */
  migrate: () => Promise<number>
  /** True while migration is running. */
  isMigrating: boolean
}

/**
 * Detects if the vault has files in non-protected subfolders and offers
 * to flatten them to the vault root. Runs once on vault load.
 */
export function useFlatVaultMigration(
  vaultPath: string,
  entriesLoaded: boolean,
  reloadVault: () => Promise<unknown>,
): FlatVaultMigration {
  const [strayFiles, setStrayFiles] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    if (!entriesLoaded || !vaultPath || !isTauri()) return
    let cancelled = false
    invoke<HealthReport>('vault_health_check', { vaultPath })
      .then((report) => {
        if (!cancelled && report.stray_files.length > 0) {
          setStrayFiles(report.stray_files)
        }
      })
      .catch(() => { /* non-critical */ })
    return () => { cancelled = true }
  }, [vaultPath, entriesLoaded])

  const dismiss = useCallback(() => setDismissed(true), [])

  const migrate = useCallback(async () => {
    setIsMigrating(true)
    try {
      const count = await invoke<number>('flatten_vault', { vaultPath })
      setStrayFiles([])
      setDismissed(true)
      await reloadVault()
      return count
    } finally {
      setIsMigrating(false)
    }
  }, [vaultPath, reloadVault])

  return {
    needsMigration: strayFiles.length > 0 && !dismissed,
    strayFiles,
    dismiss,
    migrate,
    isMigrating,
  }
}
