import type { AiAgentId, AiAgentsStatus } from '../lib/aiAgents'
import type { VaultAiGuidanceStatus } from '../lib/vaultAiGuidance'
import { useEffect, useState } from 'react'
import type { ClaudeCodeStatus } from '../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../hooks/useMcpStatus'
import type { ThemeMode } from '../lib/themeMode'
import type { GitRemoteStatus, SyncStatus } from '../types'
import { TooltipProvider } from '@/components/ui/tooltip'
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
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onClickPending?: () => void
  onClickPulse?: () => void
  onCommitPush?: () => void
  isOffline?: boolean
  isGitVault?: boolean
  syncStatus?: SyncStatus
  lastSyncTime?: number | null
  conflictCount?: number
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  zoomLevel?: number
  themeMode?: ThemeMode
  onZoomReset?: () => void
  onToggleThemeMode?: () => void
  onOpenFeedback?: () => void
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

export function StatusBar({
  noteCount,
  modifiedCount = 0,
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenSettings,
  onOpenLocalFolder,
  onCreateEmptyVault,
  onCloneVault,
  onCloneGettingStarted,
  onClickPending,
  onClickPulse,
  onCommitPush,
  isOffline = false,
  isGitVault = false,
  syncStatus = 'idle',
  lastSyncTime = null,
  conflictCount = 0,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  zoomLevel = 100,
  themeMode = 'light',
  onZoomReset,
  onToggleThemeMode,
  onOpenFeedback,
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
}: StatusBarProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <TooltipProvider>
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
          onCreateEmptyVault={onCreateEmptyVault}
          onCloneVault={onCloneVault}
          onCloneGettingStarted={onCloneGettingStarted}
          onClickPending={onClickPending}
          onClickPulse={onClickPulse}
          onCommitPush={onCommitPush}
          isOffline={isOffline}
          isGitVault={isGitVault}
          syncStatus={syncStatus}
          lastSyncTime={lastSyncTime}
          conflictCount={conflictCount}
          remoteStatus={remoteStatus}
          onTriggerSync={onTriggerSync}
          onPullAndPush={onPullAndPush}
          onOpenConflictResolver={onOpenConflictResolver}
          buildNumber={buildNumber}
          onCheckForUpdates={onCheckForUpdates}
          onRemoveVault={onRemoveVault}
          mcpStatus={mcpStatus}
          onInstallMcp={onInstallMcp}
          aiAgentsStatus={aiAgentsStatus}
          vaultAiGuidanceStatus={vaultAiGuidanceStatus}
          defaultAiAgent={defaultAiAgent}
          onSetDefaultAiAgent={onSetDefaultAiAgent}
          onRestoreVaultAiGuidance={onRestoreVaultAiGuidance}
          claudeCodeStatus={claudeCodeStatus}
          claudeCodeVersion={claudeCodeVersion}
        />
        <StatusBarSecondarySection
          noteCount={noteCount}
          zoomLevel={zoomLevel}
          themeMode={themeMode}
          onZoomReset={onZoomReset}
          onToggleThemeMode={onToggleThemeMode}
          onOpenFeedback={onOpenFeedback}
          onOpenSettings={onOpenSettings}
        />
      </footer>
    </TooltipProvider>
  )
}
