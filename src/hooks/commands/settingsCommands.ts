import type { CommandAction } from './types'

interface SettingsCommandsConfig {
  mcpStatus?: string
  vaultCount?: number
  isGettingStartedHidden?: boolean
  onOpenSettings: () => void
  onOpenFeedback?: () => void
  onOpenVault?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onCheckForUpdates?: () => void
  onInstallMcp?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
}

export function buildSettingsCommands(config: SettingsCommandsConfig): CommandAction[] {
  const {
    mcpStatus, vaultCount, isGettingStartedHidden,
    onOpenSettings, onOpenFeedback, onOpenVault, onRemoveActiveVault, onRestoreGettingStarted,
    onCheckForUpdates, onInstallMcp, onReloadVault, onRepairVault,
  } = config

  return [
    { id: 'open-settings', label: 'Open Settings', group: 'Settings', shortcut: '⌘,', keywords: ['preferences', 'config'], enabled: true, execute: onOpenSettings },
    { id: 'give-feedback', label: 'Give Feedback', group: 'Settings', keywords: ['feedback', 'issue', 'bug', 'github', 'report'], enabled: !!onOpenFeedback, execute: () => onOpenFeedback?.() },
    { id: 'open-vault', label: 'Open Vault…', group: 'Settings', keywords: ['vault', 'folder', 'switch', 'open', 'workspace'], enabled: true, execute: () => onOpenVault?.() },
    { id: 'remove-vault', label: 'Remove Vault from List', group: 'Settings', keywords: ['vault', 'remove', 'disconnect', 'hide'], enabled: (vaultCount ?? 0) > 1 && !!onRemoveActiveVault, execute: () => onRemoveActiveVault?.() },
    { id: 'restore-getting-started', label: 'Restore Getting Started Vault', group: 'Settings', keywords: ['vault', 'restore', 'demo', 'getting started', 'reset'], enabled: !!isGettingStartedHidden && !!onRestoreGettingStarted, execute: () => onRestoreGettingStarted?.() },
    { id: 'check-updates', label: 'Check for Updates', group: 'Settings', keywords: ['update', 'version', 'upgrade', 'release'], enabled: true, execute: () => onCheckForUpdates?.() },
    { id: 'install-mcp', label: mcpStatus === 'installed' ? 'Restore MCP Server' : 'Install MCP Server', group: 'Settings', keywords: ['mcp', 'claude', 'ai', 'tools', 'install', 'restore', 'fix', 'repair'], enabled: true, execute: () => onInstallMcp?.() },
    { id: 'reload-vault', label: 'Reload Vault', group: 'Settings', keywords: ['reload', 'refresh', 'rescan', 'sync', 'filesystem', 'cache'], enabled: !!onReloadVault, execute: () => onReloadVault?.() },
    { id: 'repair-vault', label: 'Repair Vault', group: 'Settings', keywords: ['repair', 'fix', 'restore', 'config', 'agents', 'themes', 'missing', 'reset', 'flatten', 'structure'], enabled: !!onRepairVault, execute: () => onRepairVault?.() },
  ]
}
