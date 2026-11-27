import { useState } from 'react'
import type { ActiveVault } from './useManagedVaultCatalog'
import { prepareNativeWorkspace } from '../prepareNativeWorkspace'
import { optionalNativeWorkspaceAccessModule } from '../nativeWorkspaceAccess'
import { hasPreparedWorkspaceSnapshot } from '../preparedWorkspaceSnapshot'
import { refreshedVault } from './mobileVaultSelection'

type RefreshFailure = { root?: string; selectedNoteId?: string }

export function usePreparedVaultRefresh(publish: (value: ActiveVault) => void) {
  const [failure, setFailure] = useState<RefreshFailure | null>(null)
  const refresh = async (next: ActiveVault, previous: ActiveVault, selectedNoteId?: string) => {
    const requested = selectedNoteId ?? (next.selection?.vaultRootUri === failure?.root ? failure?.selectedNoteId : undefined)
    try {
      const prepared = await prepareRefresh(next)
      publish(refreshedVault(prepared, previous, requested))
      setFailure(null)
    } catch (error) {
      setFailure({ root: next.selection?.vaultRootUri, selectedNoteId: requested })
      throw error
    }
  }
  return { refresh, failed: failure !== null }
}

async function prepareRefresh(next: ActiveVault): Promise<ActiveVault> {
  if (!next.selection || hasPreparedWorkspaceSnapshot(next.selection.index)) return next
  // A consumed launch index predates checkout. Re-read through the native queue,
  // then cooperatively parse before React can mount the replacement workspace.
  const selection = await prepareNativeWorkspace({ ...next.selection, index: undefined })
  if (!selection) throw new Error('workspacePreparationMissing')
  // shortcut: Android has no TolariaWorkspaceAccess module, hence no native index; keep the selection and let the JS filesystem path load it. Upgrade when an Android module exists.
  if (!hasPreparedWorkspaceSnapshot(selection.index) && optionalNativeWorkspaceAccessModule()) throw new Error('workspacePreparationMissing')
  return { ...next, selection }
}
