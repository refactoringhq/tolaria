import { useEffect, useState } from 'react'
import type { ClaudeCodeStatus } from '../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../hooks/useMcpStatus'
import type { GitRemoteStatus, LastCommitInfo, SyncStatus } from '../types'
import {
  StatusBarPrimarySection,
  StatusBarSecondarySection,
} from './status-bar/StatusBarSections'
import type { VaultOption } from './status-bar/types'

export type { VaultOption } from './status-bar/types'

interface StatusBarProps {
  noteCount: number
  modifiedCount?: number
  vaultPath: string
  vaults: VaultOption[]
  onSwitchVault: (path: string) => void
  onOpenSettings?: () => void
  onOpenLocalFolder?: () => void
  onConnectGitHub?: () => void
  onClickPending?: () => void
  onClickPulse?: () => void
  onCommitPush?: () => void
  isGitVault?: boolean
  hasGitHub?: boolean
  syncStatus?: SyncStatus
  lastSyncTime?: number | null
  conflictCount?: number
  lastCommitInfo?: LastCommitInfo | null
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  zoomLevel?: number
  onZoomReset?: () => void
  onOpenFeedback?: () => void
  buildNumber?: string
  onCheckForUpdates?: () => void
  onRemoveVault?: (path: string) => void
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  claudeCodeStatus?: ClaudeCodeStatus
  claudeCodeVersion?: string | null
}

export function StatusBar({
  noteCount,
  modifiedCount = 0,
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenSettings,
  onOpenLocalFolder,
  onConnectGitHub,
  onClickPending,
  onClickPulse,
  onCommitPush,
  isGitVault = false,
  hasGitHub,
  syncStatus = 'idle',
  lastSyncTime = null,
  conflictCount = 0,
  lastCommitInfo,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  zoomLevel = 100,
  onZoomReset,
  onOpenFeedback,
  buildNumber,
  onCheckForUpdates,
  onRemoveVault,
  mcpStatus,
  onInstallMcp,
  claudeCodeStatus,
  claudeCodeVersion,
}: StatusBarProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer
      style={{
        height: 30,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--sidebar)',
        borderTop: '1px solid var(--border)',
        padding: '0 8px',
        fontSize: 11,
        color: 'var(--muted-foreground)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <StatusBarPrimarySection
        modifiedCount={modifiedCount}
        vaultPath={vaultPath}
        vaults={vaults}
        onSwitchVault={onSwitchVault}
        onOpenLocalFolder={onOpenLocalFolder}
        onConnectGitHub={onConnectGitHub}
        hasGitHub={hasGitHub}
        onClickPending={onClickPending}
        onClickPulse={onClickPulse}
        onCommitPush={onCommitPush}
        isGitVault={isGitVault}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        conflictCount={conflictCount}
        lastCommitInfo={lastCommitInfo}
        remoteStatus={remoteStatus}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        buildNumber={buildNumber}
        onCheckForUpdates={onCheckForUpdates}
        onRemoveVault={onRemoveVault}
        mcpStatus={mcpStatus}
        onInstallMcp={onInstallMcp}
        claudeCodeStatus={claudeCodeStatus}
        claudeCodeVersion={claudeCodeVersion}
      />
      <StatusBarSecondarySection
        noteCount={noteCount}
        zoomLevel={zoomLevel}
        onZoomReset={onZoomReset}
        onOpenFeedback={onOpenFeedback}
        onOpenSettings={onOpenSettings}
      />
    </footer>
  )
}
