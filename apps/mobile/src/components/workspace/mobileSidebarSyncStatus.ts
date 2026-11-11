import type { ContextType } from 'react'
import type { MobileVaultControlsContext, MobileVaultDisplayContext } from '../../workspace/MobileVaultContext'
import type { VaultSyncState } from '../../workspace/syncLedgerModel'
import { mobileText } from '../../i18n/mobileText'

type Controls = NonNullable<ContextType<typeof MobileVaultControlsContext>>
type Display = ContextType<typeof MobileVaultDisplayContext>
type Connection = 'github' | 'folder' | 'local'
type Status = VaultSyncState | 'unlinked' | 'unavailable' | 'syncing'

export function sidebarSyncPresentation(controls: Controls | null, display: Display, autoGit: boolean, now = Date.now()) {
  if (!controls?.rootUri) return null
  if (!matchesDisplayedVault(controls.rootUri, display)) return null
  const connection = syncConnection(controls)
  const status = presentationStatus(controls, connection)
  const label = connection === 'folder' ? folderLabels[status] : stateLabels[status]
  const state = syncStateLabel(controls, label)
  const lastSync = lastKnownSync(controls, connection, now)
  return { destination: mobileText(destinationLabels[connection]), state, lastSync,
    detail: visibleDetail({ status, state, lastSync, controls, now }), problem: ['failed', 'saveFailed', 'diverged'].includes(status),
    pendingLocalChanges: pendingLocalChanges(controls, connection),
    action: syncAction(controls, status, autoGit), disabled: controls.busy, busy: controls.busy }
}

function pendingLocalChanges(controls: Controls, connection: Connection) {
  return controls.historyAvailable === true && connection !== 'local' && controls.status === 'pending'
}

function syncStateLabel(controls: Controls, label: Parameters<typeof mobileText>[0]) {
  if (!controls.busy || !controls.phase) return mobileText(label)
  return mobileText(controls.phase === 'clone' ? 'mobile.vaults.cloning' : `mobile.vaults.${controls.phase}`)
}

function visibleDetail({ status, state, lastSync, controls, now }: {
  status: Status; state: string; lastSync: string | null; controls: Controls; now: number
}) {
  if (['failed', 'saveFailed'].includes(status) && controls.lastFailureAt != null) {
    return mobileText('mobile.sync.failedAt').replace('{time}', lastSyncLabel(controls.lastFailureAt, now))
  }
  if (['syncing', 'failed', 'saveFailed', 'diverged', 'unavailable'].includes(status)) return state
  return lastSync ?? state
}

function matchesDisplayedVault(rootUri: string, display: Display) {
  return display?.source === 'native' && display.rootUri === rootUri
}

function syncConnection(controls: Controls): Connection {
  if (controls.git) return 'github'
  return controls.linked ? 'folder' : 'local'
}

function presentationStatus(controls: Controls, connection: Connection): Status {
  if (controls.busy) return 'syncing'
  if (connection === 'local') return 'unlinked'
  return controls.historyAvailable ? controls.status : 'unavailable'
}

function lastKnownSync(controls: Controls, connection: Connection, now: number) {
  if (connection === 'local' || !controls.historyAvailable) return null
  return lastSyncLabel(controls.lastSuccessAt, now)
}

function syncAction(controls: Controls, status: Status, autoGit: boolean): 'sync' | 'manage' {
  if (['unlinked', 'diverged'].includes(status)) return 'manage'
  if (controls.git && !autoGit && controls.status === 'pending') return 'manage'
  return 'sync'
}

const destinationLabels = { github: 'mobile.vaults.github', folder: 'mobile.sync.folderDestination', local: 'mobile.vaults.localOnly' } as const
const stateLabels = {
  local: 'status.sync.notSynced', pending: 'mobile.sync.pendingShort', committed: 'mobile.sync.pendingShort',
  synced: 'status.sync.synced', failed: 'status.sync.failed', saveFailed: 'mobile.vaults.saveFailed', diverged: 'status.sync.conflict',
  unlinked: 'mobile.sync.notLinked', unavailable: 'mobile.sync.unavailable', syncing: 'status.sync.syncing',
} as const satisfies Record<Status, Parameters<typeof mobileText>[0]>
const folderLabels = { ...stateLabels, synced: 'mobile.vaults.folderSaved' } as const

function lastSyncLabel(timestamp: number | null | undefined, now: number) {
  if (timestamp == null || !Number.isFinite(timestamp)) return mobileText('mobile.sync.never')
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes === 0) return mobileText('mobile.status.now')
  if (minutes < 60) return mobileText('mobile.status.minutesAgo').replace('{minutes}', String(minutes))
  if (minutes < 1_440) return mobileText('mobile.status.hoursAgo').replace('{hours}', String(Math.floor(minutes / 60)))
  return mobileText('mobile.status.daysAgo').replace('{days}', String(Math.floor(minutes / 1_440)))
}
