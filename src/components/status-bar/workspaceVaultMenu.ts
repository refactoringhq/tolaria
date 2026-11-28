import type { useAppVaultStartup } from '../../hooks/useAppVaultStartup'
import type { AppLocale } from '../../lib/i18n'
import type { VaultMenuProps } from './vaultMenuTypes'

interface WorkspaceVaultMenuOptions {
  vaultPath: string
  vaultSwitcher: ReturnType<typeof useAppVaultStartup>['vaultSwitcher']
  multiWorkspaceEnabled: boolean
  locale: AppLocale
  onOpenVaultSettings: () => void
  onCloneVault: () => void
  onCloneGettingStarted: () => void
}

export function createWorkspaceVaultMenu({
  vaultPath,
  vaultSwitcher,
  multiWorkspaceEnabled,
  locale,
  onOpenVaultSettings,
  onCloneVault,
  onCloneGettingStarted,
}: WorkspaceVaultMenuOptions): VaultMenuProps {
  return {
    vaultPath,
    vaults: vaultSwitcher.allVaults,
    defaultWorkspacePath: vaultSwitcher.defaultWorkspacePath,
    multiWorkspaceEnabled,
    locale,
    onSwitchVault: vaultSwitcher.switchVault,
    onSetDefaultWorkspace: vaultSwitcher.setDefaultWorkspace,
    onOpenVaultSettings,
    onOpenLocalFolder: vaultSwitcher.handleOpenLocalFolder,
    onCreateEmptyVault: vaultSwitcher.handleCreateEmptyVault,
    onCloneVault,
    onCloneGettingStarted,
    onRemoveVault: vaultSwitcher.removeVault,
    onReorderVaults: vaultSwitcher.reorderVaults,
    onUpdateWorkspaceIdentity: vaultSwitcher.updateWorkspaceIdentity,
  }
}
