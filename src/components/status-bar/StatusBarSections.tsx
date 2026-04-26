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
  stacked?: boolean
  compact?: boolean
}

interface StatusBarSecondarySectionProps {
  noteCount: number
  zoomLevel: number
  themeMode?: ThemeMode
  onZoomReset?: () => void
  onToggleThemeMode?: () => void
  onOpenFeedback?: () => void
  onOpenSettings?: () => void
  stacked?: boolean
  compact?: boolean
}

function BuildNumberButton({
  buildNumber,
  onCheckForUpdates,
  compact,
}: {
  buildNumber?: string
  onCheckForUpdates?: () => void
  compact: boolean
}) {
  const className = compact
    ? 'h-6 min-w-0 gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'

  return (
    <ActionTooltip copy={UPDATE_TOOLTIP} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={className}
        onClick={onCheckForUpdates}
        aria-label={UPDATE_TOOLTIP.label}
        aria-disabled={onCheckForUpdates ? undefined : true}
        data-testid="status-build-number"
      >
        <span style={ICON_STYLE}>
          <Package size={13} />
          {compact ? null : buildNumber ?? 'b?'}
        </span>
      </Button>
    </ActionTooltip>
  )
}

function StatusBarAiBadge({
  aiAgentsStatus,
  vaultAiGuidanceStatus,
  defaultAiAgent,
  onSetDefaultAiAgent,
  onRestoreVaultAiGuidance,
  claudeCodeStatus,
  claudeCodeVersion,
  compact,
}: Pick<
  StatusBarPrimarySectionProps,
  | 'aiAgentsStatus'
  | 'vaultAiGuidanceStatus'
  | 'defaultAiAgent'
  | 'onSetDefaultAiAgent'
  | 'onRestoreVaultAiGuidance'
  | 'claudeCodeStatus'
  | 'claudeCodeVersion'
  | 'compact'
>) {
  if (aiAgentsStatus && defaultAiAgent) {
    return (
      <AiAgentsBadge
        statuses={aiAgentsStatus}
        guidanceStatus={vaultAiGuidanceStatus}
        defaultAgent={defaultAiAgent}
        onSetDefaultAgent={onSetDefaultAiAgent}
        onRestoreGuidance={onRestoreVaultAiGuidance}
        compact={compact}
      />
    )
  }

  if (!claudeCodeStatus) return null

  return <ClaudeCodeBadge status={claudeCodeStatus} version={claudeCodeVersion} showSeparator={!compact} compact={compact} />
}

function StatusBarPrimaryBadges({
  modifiedCount,
  visibleRemoteStatus,
  onAddRemote,
  onClickPending,
  onCommitPush,
  syncStatus,
  lastSyncTime,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  conflictCount,
  onClickPulse,
  isGitVault,
  mcpStatus,
  onInstallMcp,
  aiAgentsStatus,
  vaultAiGuidanceStatus,
  defaultAiAgent,
  onSetDefaultAiAgent,
  onRestoreVaultAiGuidance,
  claudeCodeStatus,
  claudeCodeVersion,
  isOffline,
  compact,
}: {
  modifiedCount: number
  visibleRemoteStatus: GitRemoteStatus | null
  onAddRemote: () => void
  onClickPending?: () => void
  onCommitPush?: () => void
  syncStatus: SyncStatus
  lastSyncTime: number | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  conflictCount: number
  onClickPulse?: () => void
  isGitVault: boolean
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  aiAgentsStatus?: AiAgentsStatus
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  defaultAiAgent?: AiAgentId
  onSetDefaultAiAgent?: (agent: AiAgentId) => void
  onRestoreVaultAiGuidance?: () => void
  claudeCodeStatus?: ClaudeCodeStatus
  claudeCodeVersion?: string | null
  isOffline: boolean
  compact: boolean
}) {
  return (
    <>
      <OfflineBadge isOffline={isOffline} showSeparator={!compact} compact={compact} />
      <NoRemoteBadge remoteStatus={visibleRemoteStatus} onAddRemote={onAddRemote} showSeparator={!compact} compact={compact} />
      <ChangesBadge count={modifiedCount} onClick={onClickPending} showSeparator={!compact} compact={compact} />
      <CommitButton onClick={onCommitPush} remoteStatus={visibleRemoteStatus} showSeparator={!compact} compact={compact} />
      <SyncBadge
        status={syncStatus}
        lastSyncTime={lastSyncTime}
        remoteStatus={visibleRemoteStatus}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        compact={compact}
      />
      <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} showSeparator={!compact} compact={compact} />
      <PulseBadge onClick={onClickPulse} disabled={isGitVault === false} showSeparator={!compact} compact={compact} />
      {mcpStatus && <McpBadge status={mcpStatus} onInstall={onInstallMcp} showSeparator={!compact} compact={compact} />}
      <StatusBarAiBadge
        aiAgentsStatus={aiAgentsStatus}
        vaultAiGuidanceStatus={vaultAiGuidanceStatus}
        defaultAiAgent={defaultAiAgent}
        onSetDefaultAiAgent={onSetDefaultAiAgent}
        onRestoreVaultAiGuidance={onRestoreVaultAiGuidance}
        claudeCodeStatus={claudeCodeStatus}
        claudeCodeVersion={claudeCodeVersion}
        compact={compact}
      />
    </>
  )
}

function FeedbackButton({
  compact,
  onOpenFeedback,
}: {
  compact: boolean
  onOpenFeedback: () => void
}) {
  const className = compact
    ? 'h-6 w-6 rounded-sm p-0 text-muted-foreground hover:text-foreground'
    : 'h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground'

  return (
    <ActionTooltip copy={FEEDBACK_TOOLTIP} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={className}
        onClick={(event) => {
          rememberFeedbackDialogOpener(event.currentTarget)
          onOpenFeedback()
        }}
        aria-label={FEEDBACK_TOOLTIP.label}
        data-testid="status-feedback"
      >
        <Megaphone size={14} />
        {compact ? null : 'Contribute'}
      </Button>
    </ActionTooltip>
  )
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
  stacked = false,
  compact = false,
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 12,
        rowGap: stacked ? 4 : 0,
        flex: 1,
        minWidth: 0,
        width: stacked ? '100%' : 'auto',
        flexBasis: stacked ? '100%' : 'auto',
        flexWrap: stacked ? 'wrap' : 'nowrap',
      }}
    >
      <VaultMenu
        vaults={vaults}
        vaultPath={vaultPath}
        onSwitchVault={onSwitchVault}
        onOpenLocalFolder={onOpenLocalFolder}
        onCreateEmptyVault={onCreateEmptyVault}
        onCloneVault={onCloneVault}
        onCloneGettingStarted={onCloneGettingStarted}
        onRemoveVault={onRemoveVault}
        compact={compact}
      />
      {compact ? null : <span style={SEP_STYLE}>|</span>}
      <BuildNumberButton buildNumber={buildNumber} onCheckForUpdates={onCheckForUpdates} compact={compact} />
      <StatusBarPrimaryBadges
        modifiedCount={modifiedCount}
        visibleRemoteStatus={visibleRemoteStatus}
        onAddRemote={() => {
          void openAddRemote()
        }}
        onClickPending={onClickPending}
        onCommitPush={onCommitPush}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        conflictCount={conflictCount}
        onClickPulse={onClickPulse}
        isGitVault={isGitVault}
        mcpStatus={mcpStatus}
        onInstallMcp={onInstallMcp}
        aiAgentsStatus={aiAgentsStatus}
        vaultAiGuidanceStatus={vaultAiGuidanceStatus}
        defaultAiAgent={defaultAiAgent}
        onSetDefaultAiAgent={onSetDefaultAiAgent}
        onRestoreVaultAiGuidance={onRestoreVaultAiGuidance}
        claudeCodeStatus={claudeCodeStatus}
        claudeCodeVersion={claudeCodeVersion}
        isOffline={isOffline}
        compact={compact}
      />
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
  stacked = false,
  compact = false,
}: StatusBarSecondarySectionProps) {
  void noteCount
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon
  const themeTooltip = themeMode === 'dark' ? LIGHT_MODE_TOOLTIP : DARK_MODE_TOOLTIP

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: stacked ? 'flex-end' : 'flex-start',
        gap: compact ? 8 : 12,
        flexShrink: 0,
        width: stacked ? '100%' : 'auto',
      }}
    >
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
      {onOpenFeedback && <FeedbackButton compact={compact} onOpenFeedback={onOpenFeedback} />}
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
