import { useContext } from 'react'
import { mobileText } from '../../i18n/mobileText'
import { mobileColors } from '../../ui/tokens'
import { MobileVaultControlsContext, MobileVaultDisplayContext } from '../../workspace/MobileVaultContext'
import type { MobileSyncStatus } from '../../workspace/mobileWorkspaceModel'
import type { VaultSyncState } from '../../workspace/git/useMobileVaults'

export function useVaultSyncPresentation(sync: MobileSyncStatus) {
  const controls = useContext(MobileVaultControlsContext)
  const display = useContext(MobileVaultDisplayContext)
  if (!controls || display?.source !== 'native') return null
  const git = controls.git && display.rootUri === controls.rootUri
  const status = sync.kind === 'writeFailed' ? 'failed' : controls.status
  const label = controls.busy ? mobileText('status.sync.syncing') : statusLabel(git, status)
  const color = statusColor(status)
  return { label, color, open: controls.open, sync: git ? controls.sync : undefined, busy: controls.busy }
}

function statusColor(status: VaultSyncState) {
  return status === 'failed' || status === 'diverged' ? mobileColors.danger : mobileColors.textMuted
}

function statusLabel(git: boolean, status: VaultSyncState) {
  if (!git) return mobileText('mobile.vaults.localOnly')
  const labels = {
    local: 'mobile.vaults.localOnly', pending: 'status.sync.notSynced', synced: 'status.sync.synced',
    diverged: 'status.sync.conflict', failed: 'status.sync.failed',
  } as const
  return mobileText(labels[status])
}
