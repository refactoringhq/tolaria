import { Moon, Package, Settings, Sun } from 'lucide-react'
import { Megaphone } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('statusBar')
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

  const updateTooltip = { label: t('Check for updates') } as const

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
      <ActionTooltip copy={updateTooltip} side="top">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onCheckForUpdates}
          aria-label={updateTooltip.label}
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
  const { t } = useTranslation('statusBar')
  void noteCount
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon
  const themeTooltip = themeMode === 'dark'
    ? { label: t('Switch to light mode') } as const
    : { label: t('Switch to dark mode') } as const
  const zoomResetTooltip = {
    label: t('Reset the zoom level'),
    shortcut: formatShortcutDisplay({ display: '⌘0' }),
  } as const
  const settingsTooltip = {
    label: t('Open settings'),
    shortcut: formatShortcutDisplay({ display: '⌘,' }),
  } as const
  const feedbackTooltip = { label: t('Contribute to Tolaria') } as const

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      {zoomLevel === 100 ? null : (
        <ActionTooltip copy={zoomResetTooltip} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
            onClick={onZoomReset}
            aria-label={zoomResetTooltip.label}
            data-testid="status-zoom"
          >
            <span style={ICON_STYLE}>{zoomLevel}%</span>
          </Button>
        </ActionTooltip>
      )}
      {onOpenFeedback && (
        <ActionTooltip copy={feedbackTooltip} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              rememberFeedbackDialogOpener(event.currentTarget)
              onOpenFeedback()
            }}
            aria-label={feedbackTooltip.label}
            data-testid="status-feedback"
          >
            <Megaphone size={14} />
            {t('Contribute to Tolaria')}
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
      <ActionTooltip copy={settingsTooltip} side="top" align="end">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onOpenSettings}
          aria-label={settingsTooltip.label}
          data-testid="status-settings"
        >
          <Settings size={14} />
        </Button>
      </ActionTooltip>
    </div>
  )
}
