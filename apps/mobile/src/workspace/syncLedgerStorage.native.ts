import { File, Paths } from 'expo-file-system'
import { parseSyncLedger } from './syncLedgerModel'

function ledgerFile(suffix = '') { return new File(Paths.document, '.tolaria-mobile-config', `sync-history.json${suffix}`) }

async function validated(file: File) {
  const content = await file.text()
  parseSyncLedger(content)
  return content
}

export async function readSyncLedger() {
  const current = ledgerFile()
  const backup = ledgerFile('.backup')
  try {
    if (current.exists) return await validated(current)
    return backup.exists ? await validated(backup) : null
  } catch (error) {
    if (backup.exists) return validated(backup)
    throw error
  }
}

export async function writeSyncLedger(content: string) {
  parseSyncLedger(content)
  const current = ledgerFile()
  const pending = ledgerFile('.pending')
  pending.parentDirectory.create({ intermediates: true, idempotent: true })
  pending.write(content)
  await validated(pending)
  if (current.exists) await preserveCurrent(current)
  await pending.move(ledgerFile())
}

async function preserveCurrent(current: File) {
  const backup = ledgerFile('.backup')
  let valid = false
  try { await validated(current); valid = true } catch { /* Retain the last readable history. */ }
  if (!valid) { await validated(backup); current.delete(); return }
  if (backup.exists) backup.delete()
  await current.move(backup)
}
