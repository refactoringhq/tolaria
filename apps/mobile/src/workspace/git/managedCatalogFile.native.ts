import { File, Paths } from 'expo-file-system'
import { parseManagedGitVaultCatalog, type ManagedGitVaultCatalog } from './managedGitVaults'

function catalogFile(suffix = '') { return new File(Paths.document, '.tolaria-mobile-config', `git-vaults.json${suffix}`) }

export async function readManagedCatalogFile(): Promise<ManagedGitVaultCatalog> {
  const current = catalogFile()
  const backup = catalogFile('.backup')
  try {
    if (current.exists) return parseManagedGitVaultCatalog(await current.text())
    if (backup.exists) return parseManagedGitVaultCatalog(await backup.text())
    return parseManagedGitVaultCatalog(null)
  } catch (error) {
    if (backup.exists) return parseManagedGitVaultCatalog(await backup.text())
    throw error
  }
}

export async function writeManagedCatalogFile(catalog: ManagedGitVaultCatalog) {
  // Publish a complete file by rename, retaining the last catalog for recovery.
  const current = catalogFile()
  const pending = catalogFile('.pending')
  pending.parentDirectory.create({ intermediates: true, idempotent: true })
  pending.write(JSON.stringify(catalog))
  parseManagedGitVaultCatalog(await pending.text())
  if (current.exists) await preserveCurrentCatalog(current)
  pending.move(catalogFile())
}

async function preserveCurrentCatalog(current: File) {
  const backup = catalogFile('.backup')
  let valid = false
  try { parseManagedGitVaultCatalog(await current.text()); valid = true } catch { /* Keep a previously valid backup. */ }
  if (!valid) {
    // Refuse to replace an unrecoverable catalog with silently lost entries.
    parseManagedGitVaultCatalog(await backup.text())
    current.delete()
    return
  }
  if (backup.exists) backup.delete()
  current.move(backup)
}
