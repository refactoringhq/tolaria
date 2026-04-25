import { Moon, Package, Settings, Sun } from 'lucide-react'
import { Megaphone } from '@phosphor-icons/react'
import type { AiAgentId, AiAgentsStatus } from '../../lib/aiAgents'
import type { VaultAiGuidanceStatus } from '../../lib/vaultAiGuidance'
import type { ClaudeCodeStatus } from '../../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../../hooks/useMcpStatus'
import type { ThemeMode } from '../../lib/themeMode'
import { useStatusBarAddRemote } from '../../hooks/useStatusBarAddRemote'
import type { GitRemoteStatus, SyncStatus } from '../../types'
import { rememberFeedbackDialogOpener } from '../../lib/feedbackDialogOpener'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { AiAgentsBadge } from './AiAgentsBadge'
import { AddRemoteModal } from '../AddRemoteModal'
import { Button } from '@/components/ui/button'
import {
  ClaudeCodeBadge,
  CommitButton,
  ConflictBadge,
  ChangesBadge,
  McpBadge,
  NoRemoteBadge,
  OfflineBadge,
  PulseBadge,
  SyncBadge,
} from './StatusBarBadges'
import { ICON_STYLE, SEP_STYLE } from './styles'
import type { VaultOption } from './types'
import { VaultMenu } from './VaultMenu'
import { formatShortcutDisplay } from '../../hooks/appCommandCatalog'

const UPDATE_TOOLTIP = { label: 'Check for updates' } as const
const ZOOM_RESET_TOOLTIP = {
  label: 'Reset the zoom level',
  shortcut: formatShortcutDisplay({ display: '⌘0' }),
} as const
const FEEDBACK_TOOLTIP = { label: 'Contribute to Tolaria' } as const
const LIGHT_MODE_TOOLTIP = { label: 'Switch to light mode' } as const
const DARK_MODE_TOOLTIP = { label: 'Switch to dark mode' } as const
const SETTINGS_TOOLTIP = {
  label: 'Open settings',
  shortcut: formatShortcutDisplay({ display: '⌘,' }),
} as const

interface StatusBarPrimarySectionProps {
  modifiedCount: number
  vaultPath: string
  vaults: VaultOption[]
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onAddRemote?: () => void
  onClickPending?: () => void
  onClickPulse?: () => void
  onCommitPush?: () => void
  isOffline?: boolean
  isGitVault?: boolean
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictCount: number
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  buildNumber?: string
  onCheckForUpdates?: () => void
  onRemoveVault?: (path: string) => void
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  aiAgentsStatus?: AiAgentsStatus
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  defaultAiAgent?: AiAgentId
  onSetDefaultAiAgent?: (agent: AiAgentId) => void
  onRestoreVaultAiGuidance?: () => void
  claudeCodeStatus?: ClaudeCodeStatus
  claudeCodeVersion?: string | null
}

interface StatusBarSecondarySectionProps {
  noteCount: number
  zoomLevel: number
  themeMode?: ThemeMode
  onZoomReset?: () => void
  onToggleThemeMode?: () => void
  onOpenFeedback?: () => void
  onOpenSettings?: () => void
}

export function StatusBarPrimarySection({
  modifiedCount,
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenLocalFolder,
  onCreateEmptyVault,
  onCloneVault,
  onCloneGettingStarted,
  onAddRemote,
  onClickPending,
  onClickPulse,
  onCommitPush,
  isOffline = false,
  isGitVault = false,
  syncStatus,
  lastSyncTime,
  conflictCount,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  buildNumber,
  onCheckForUpdates,
  onRemoveVault,
  mcpStatus,
  onInstallMcp,
  aiAgentsStatus,
  vaultAiGuidanceStatus,
  defaultAiAgent,
  onSetDefaultAiAgent,
  onRestoreVaultAiGuidance,
  claudeCodeStatus,
  claudeCodeVersion,
}: StatusBarPrimarySectionProps) {
  const {
    openAddRemote,
    closeAddRemote,
    showAddRemote,
    visibleRemoteStatus,
    handleRemoteConnected,
  } = useStatusBarAddRemote({
    vaultPath,
    isGitVault,
    remoteStatus,
    onAddRemote,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <VaultMenu
        vaults={vaults}
        vaultPath={vaultPath}
        onSwitchVault={onSwitchVault}
        onOpenLocalFolder={onOpenLocalFolder}
        onCreateEmptyVault={onCreateEmptyVault}
        onCloneVault={onCloneVault}
        onCloneGettingStarted={onCloneGettingStarted}
        onRemoveVault={onRemoveVault}
      />
      <span style={SEP_STYLE}>|</span>
      <ActionTooltip copy={UPDATE_TOOLTIP} side="top">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onCheckForUpdates}
          aria-label={UPDATE_TOOLTIP.label}
          aria-disabled={onCheckForUpdates ? undefined : true}
          data-testid="status-build-number"
        >
          <span style={ICON_STYLE}>
            <Package size={13} />
            {buildNumber ?? 'b?'}
          </span>
        </Button>
      </ActionTooltip>
      <OfflineBadge isOffline={isOffline} />
      <NoRemoteBadge
        remoteStatus={visibleRemoteStatus}
        onAddRemote={() => {
          void openAddRemote()
        }}
      />
      <ChangesBadge count={modifiedCount} onClick={onClickPending} />
      <CommitButton onClick={onCommitPush} remoteStatus={visibleRemoteStatus} />
      <SyncBadge
        status={syncStatus}
        lastSyncTime={lastSyncTime}
        remoteStatus={visibleRemoteStatus}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
      />
      <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} />
      <PulseBadge onClick={onClickPulse} disabled={isGitVault === false} />
      {mcpStatus && <McpBadge status={mcpStatus} onInstall={onInstallMcp} />}
      {aiAgentsStatus && defaultAiAgent
        ? (
          <AiAgentsBadge
            statuses={aiAgentsStatus}
            guidanceStatus={vaultAiGuidanceStatus}
            defaultAgent={defaultAiAgent}
            onSetDefaultAgent={onSetDefaultAiAgent}
            onRestoreGuidance={onRestoreVaultAiGuidance}
          />
        )
        : claudeCodeStatus && <ClaudeCodeBadge status={claudeCodeStatus} version={claudeCodeVersion} />}
      <AddRemoteModal
        open={showAddRemote}
        vaultPath={vaultPath}
        onClose={closeAddRemote}
        onRemoteConnected={handleRemoteConnected}
      />
    </div>
  )
}

export function StatusBarSecondarySection({
  noteCount,
  zoomLevel,
  themeMode = 'light',
  onZoomReset,
  onToggleThemeMode,
  onOpenFeedback,
  onOpenSettings,
}: StatusBarSecondarySectionProps) {
  void noteCount
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon
  const themeTooltip = themeMode === 'dark' ? LIGHT_MODE_TOOLTIP : DARK_MODE_TOOLTIP

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      {zoomLevel === 100 ? null : (
        <ActionTooltip copy={ZOOM_RESET_TOOLTIP} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
            onClick={onZoomReset}
            aria-label={ZOOM_RESET_TOOLTIP.label}
            data-testid="status-zoom"
          >
            <span style={ICON_STYLE}>{zoomLevel}%</span>
          </Button>
        </ActionTooltip>
      )}
      {onOpenFeedback && (
        <ActionTooltip copy={FEEDBACK_TOOLTIP} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              rememberFeedbackDialogOpener(event.currentTarget)
              onOpenFeedback()
            }}
            aria-label={FEEDBACK_TOOLTIP.label}
            data-testid="status-feedback"
          >
            <Megaphone size={14} />
            Contribute
          </Button>
        </ActionTooltip>
      )}
      <ActionTooltip copy={themeTooltip} side="top">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onToggleThemeMode}
          disabled={!onToggleThemeMode}
          aria-label={themeTooltip.label}
          data-testid="status-theme-mode"
        >
          <ThemeIcon size={14} />
        </Button>
      </ActionTooltip>
      <ActionTooltip copy={SETTINGS_TOOLTIP} side="top" align="end">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onOpenSettings}
          aria-label={SETTINGS_TOOLTIP.label}
          data-testid="status-settings"
        >
          <Settings size={14} />
        </Button>
      </ActionTooltip>
    </div>
  )
}
