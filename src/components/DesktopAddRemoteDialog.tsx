import { useStatusBarAddRemote } from '../hooks/useStatusBarAddRemote'
import { AddRemoteModal } from './AddRemoteModal'

interface DesktopAddRemoteDialogProps {
  vaultPath: string
  isGitVault: boolean
  refreshRemote: (vaultPath: string) => Promise<unknown>
}

export function DesktopAddRemoteDialog({ vaultPath, isGitVault, refreshRemote }: DesktopAddRemoteDialogProps) {
  const { showAddRemote, closeAddRemote } = useStatusBarAddRemote({ vaultPath, isGitVault })

  return (
    <AddRemoteModal
      open={showAddRemote}
      vaultPath={vaultPath}
      onClose={closeAddRemote}
      onRemoteConnected={async () => { await refreshRemote(vaultPath) }}
    />
  )
}
