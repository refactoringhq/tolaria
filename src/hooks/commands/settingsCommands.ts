import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../appCommandCatalog'
import type { CommandAction } from './types'
import { rememberFeedbackDialogOpener } from '../../lib/feedbackDialogOpener'

interface SettingsCommandsConfig {
  mcpStatus?: string
  vaultCount?: number
  isGettingStartedHidden?: boolean
  onOpenSettings: () => void
  onOpenFeedback?: () => void
  onOpenVault?: () => void
  onCreateEmptyVault?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onCheckForUpdates?: () => void
  onInstallMcp?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
}

function buildPrimarySettingsCommands({
  onOpenSettings,
  onOpenFeedback,
  onCheckForUpdates,
}: Pick<SettingsCommandsConfig, 'onOpenSettings' | 'onOpenFeedback' | 'onCheckForUpdates'>): CommandAction[] {
  return [
    { id: 'open-settings', label: 'Open Settings', group: 'Settings', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.appSettings), keywords: ['preferences', 'config'], enabled: true, execute: onOpenSettings },
    {
      id: 'open-h1-auto-rename-setting',
      label: 'Open H1 Auto-Rename Setting',
      group: 'Settings',
      keywords: ['h1', 'title', 'filename', 'rename', 'auto', 'untitled', 'sync', 'preference'],
      enabled: true,
      execute: onOpenSettings,
    },
    {
      id: 'open-contribute',
      label: 'Contribute',
      group: 'Settings',
      keywords: ['contribute', 'feedback', 'feature', 'canny', 'discussion', 'github', 'bug', 'report'],
      enabled: !!onOpenFeedback,
      execute: () => {
        rememberFeedbackDialogOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null)
        onOpenFeedback?.()
      },
    },
    { id: 'check-updates', label: 'Check for Updates', group: 'Settings', keywords: ['update', 'version', 'upgrade', 'release'], enabled: true, execute: () => onCheckForUpdates?.() },
  ]
}

function buildVaultSettingsCommands({
  vaultCount,
  isGettingStartedHidden,
  onOpenVault,
  onCreateEmptyVault,
  onRemoveActiveVault,
  onRestoreGettingStarted,
}: Pick<SettingsCommandsConfig, 'vaultCount' | 'isGettingStartedHidden' | 'onOpenVault' | 'onCreateEmptyVault' | 'onRemoveActiveVault' | 'onRestoreGettingStarted'>): CommandAction[] {
  return [
    { id: 'create-empty-vault', label: 'Create Empty Vault…', group: 'Settings', keywords: ['vault', 'create', 'new', 'empty', 'folder'], enabled: !!onCreateEmptyVault, execute: () => onCreateEmptyVault?.() },
    { id: 'open-vault', label: 'Open Vault…', group: 'Settings', keywords: ['vault', 'folder', 'switch', 'open', 'workspace'], enabled: true, execute: () => onOpenVault?.() },
    { id: 'remove-vault', label: 'Remove Vault from List', group: 'Settings', keywords: ['vault', 'remove', 'disconnect', 'hide'], enabled: (vaultCount ?? 0) > 1 && !!onRemoveActiveVault, execute: () => onRemoveActiveVault?.() },
    { id: 'restore-getting-started', label: 'Restore Getting Started Vault', group: 'Settings', keywords: ['vault', 'restore', 'demo', 'getting started', 'reset'], enabled: !!isGettingStartedHidden && !!onRestoreGettingStarted, execute: () => onRestoreGettingStarted?.() },
  ]
}

function buildMaintenanceCommands({
  mcpStatus,
  onInstallMcp,
  onReloadVault,
  onRepairVault,
}: Pick<SettingsCommandsConfig, 'mcpStatus' | 'onInstallMcp' | 'onReloadVault' | 'onRepairVault'>): CommandAction[] {
  return [
    {
      id: 'install-mcp',
      label: mcpStatus === 'installed' ? 'Manage External AI Tools…' : 'Set Up External AI Tools…',
      group: 'Settings',
      keywords: ['mcp', 'ai', 'tools', 'external', 'setup', 'connect', 'disconnect', 'claude', 'codex', 'cursor', 'consent'],
      enabled: true,
      execute: () => onInstallMcp?.(),
    },
    { id: 'reload-vault', label: 'Reload Vault', group: 'Settings', keywords: ['reload', 'refresh', 'rescan', 'sync', 'filesystem', 'cache'], enabled: !!onReloadVault, execute: () => onReloadVault?.() },
    { id: 'repair-vault', label: 'Repair Vault', group: 'Settings', keywords: ['repair', 'fix', 'restore', 'config', 'agents', 'themes', 'missing', 'reset', 'flatten', 'structure'], enabled: !!onRepairVault, execute: () => onRepairVault?.() },
  ]
}

export function buildSettingsCommands(config: SettingsCommandsConfig): CommandAction[] {
  const {
    mcpStatus, vaultCount, isGettingStartedHidden,
    onOpenSettings, onOpenFeedback, onOpenVault, onCreateEmptyVault, onRemoveActiveVault, onRestoreGettingStarted,
    onCheckForUpdates, onInstallMcp, onReloadVault, onRepairVault,
  } = config

  return [
    ...buildPrimarySettingsCommands({ onOpenSettings, onOpenFeedback, onCheckForUpdates }),
    ...buildVaultSettingsCommands({
      vaultCount,
      isGettingStartedHidden,
      onOpenVault,
      onCreateEmptyVault,
      onRemoveActiveVault,
      onRestoreGettingStarted,
    }),
    ...buildMaintenanceCommands({ mcpStatus, onInstallMcp, onReloadVault, onRepairVault }),
  ]
}
