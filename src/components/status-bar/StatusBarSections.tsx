import { Bell, FileText, Package, Settings } from 'lucide-react'
import { Megaphone } from '@phosphor-icons/react'
import type { ClaudeCodeStatus } from '../../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../../hooks/useMcpStatus'
import type { GitRemoteStatus, LastCommitInfo, SyncStatus } from '../../types'
import { Button } from '@/components/ui/button'
import {
  ClaudeCodeBadge,
  CommitBadge,
  CommitButton,
  ConflictBadge,
  ChangesBadge,
  McpBadge,
  PulseBadge,
  SyncBadge,
} from './StatusBarBadges'
import { DISABLED_STYLE, ICON_STYLE, SEP_STYLE } from './styles'
import type { VaultOption } from './types'
import { VaultMenu } from './VaultMenu'

interface StatusBarPrimarySectionProps {
  modifiedCount: number
  vaultPath: string
  vaults: VaultOption[]
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onConnectGitHub?: () => void
  hasGitHub?: boolean
  onClickPending?: () => void
  onClickPulse?: () => void
  onCommitPush?: () => void
  isGitVault?: boolean
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictCount: number
  lastCommitInfo?: LastCommitInfo | null
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  buildNumber?: string
  onCheckForUpdates?: () => void
  onRemoveVault?: (path: string) => void
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  claudeCodeStatus?: ClaudeCodeStatus
  claudeCodeVersion?: string | null
}

interface StatusBarSecondarySectionProps {
  noteCount: number
  zoomLevel: number
  onZoomReset?: () => void
  onOpenFeedback?: () => void
  onOpenSettings?: () => void
}

export function StatusBarPrimarySection({
  modifiedCount,
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenLocalFolder,
  onConnectGitHub,
  hasGitHub,
  onClickPending,
  onClickPulse,
  onCommitPush,
  isGitVault = false,
  syncStatus,
  lastSyncTime,
  conflictCount,
  lastCommitInfo,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  buildNumber,
  onCheckForUpdates,
  onRemoveVault,
  mcpStatus,
  onInstallMcp,
  claudeCodeStatus,
  claudeCodeVersion,
}: StatusBarPrimarySectionProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <VaultMenu
        vaults={vaults}
        vaultPath={vaultPath}
        onSwitchVault={onSwitchVault}
        onOpenLocalFolder={onOpenLocalFolder}
        onConnectGitHub={onConnectGitHub}
        hasGitHub={hasGitHub}
        onRemoveVault={onRemoveVault}
      />
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onCheckForUpdates}
        style={{ ...ICON_STYLE, cursor: onCheckForUpdates ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="Check for updates"
        data-testid="status-build-number"
        onMouseEnter={onCheckForUpdates ? (event) => { event.currentTarget.style.background = 'var(--hover)' } : undefined}
        onMouseLeave={onCheckForUpdates ? (event) => { event.currentTarget.style.background = 'transparent' } : undefined}
      >
        <Package size={13} />
        {buildNumber ?? 'b?'}
      </span>
      <ChangesBadge count={modifiedCount} onClick={onClickPending} />
      <CommitButton onClick={onCommitPush} />
      <SyncBadge
        status={syncStatus}
        lastSyncTime={lastSyncTime}
        remoteStatus={remoteStatus}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
      />
      {lastCommitInfo && <CommitBadge info={lastCommitInfo} />}
      <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} />
      <PulseBadge onClick={onClickPulse} disabled={isGitVault === false} />
      {mcpStatus && <McpBadge status={mcpStatus} onInstall={onInstallMcp} />}
      {claudeCodeStatus && <ClaudeCodeBadge status={claudeCodeStatus} version={claudeCodeVersion} />}
    </div>
  )
}

export function StatusBarSecondarySection({
  noteCount,
  zoomLevel,
  onZoomReset,
  onOpenFeedback,
  onOpenSettings,
}: StatusBarSecondarySectionProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <span style={ICON_STYLE}>
        <FileText size={13} />
        {noteCount.toLocaleString()} notes
      </span>
      {zoomLevel === 100 ? null : (
        <span
          role="button"
          onClick={onZoomReset}
          style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
          title="Reset zoom (⌘0)"
          onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
          onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
          data-testid="status-zoom"
        >
          {zoomLevel}%
        </span>
      )}
      {onOpenFeedback && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          onClick={onOpenFeedback}
          title="Share feedback"
          data-testid="status-feedback"
        >
          <Megaphone size={14} />
          Feedback
        </Button>
      )}
      <span style={DISABLED_STYLE} title="Coming soon">
        <Bell size={14} />
      </span>
      <span
        role="button"
        onClick={onOpenSettings}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="Settings (⌘,)"
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
      >
        <Settings size={14} />
      </span>
    </div>
  )
}
