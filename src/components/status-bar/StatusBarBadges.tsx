import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  Cpu,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import { GitDiff, Pulse } from '@phosphor-icons/react'
import { ActionTooltip, type ActionTooltipCopy } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClaudeCodeStatus } from '../../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../../hooks/useMcpStatus'
import type { GitRemoteStatus, LastCommitInfo, SyncStatus } from '../../types'
import { openExternalUrl } from '../../utils/url'
import { useDismissibleLayer } from './useDismissibleLayer'
import { ICON_STYLE, SEP_STYLE } from './styles'

const SYNC_ICON_MAP: Record<string, typeof RefreshCw> = {
  syncing: Loader2,
  conflict: AlertTriangle,
  pull_required: ArrowDown,
}

const SYNC_LABELS: Record<string, string> = {
  syncing: 'Syncing…',
  conflict: 'Conflict',
  error: 'Sync failed',
  pull_required: 'Pull required',
}

const SYNC_COLORS: Record<string, string> = {
  conflict: 'var(--accent-orange)',
  error: 'var(--muted-foreground)',
  pull_required: 'var(--accent-orange)',
}

const MCP_TOOLTIPS: Partial<Record<McpStatus, string>> = {
  not_installed: 'External AI tools not connected — click to set up',
}

const CLAUDE_INSTALL_URL = 'https://docs.anthropic.com/en/docs/claude-code'

function formatElapsedSync(lastSyncTime: number | null): string {
  if (!lastSyncTime) return 'Not synced'
  const secs = Math.round((Date.now() - lastSyncTime) / 1000)
  return secs < 60 ? 'Synced just now' : `Synced ${Math.floor(secs / 60)}m ago`
}

function formatSyncLabel(status: SyncStatus, lastSyncTime: number | null): string {
  return SYNC_LABELS[status] ?? formatElapsedSync(lastSyncTime)
}

function syncIconColor(status: SyncStatus): string {
  return SYNC_COLORS[status] ?? 'var(--accent-green)'
}

function syncBadgeTooltipCopy(status: SyncStatus): ActionTooltipCopy {
  if (status === 'conflict') return { label: 'Resolve merge conflicts' }
  if (status === 'syncing') return { label: 'Sync in progress' }
  if (status === 'pull_required') return { label: 'Pull from remote and push' }
  if (status === 'error') return { label: 'Retry sync' }
  return { label: 'Sync now' }
}

function syncStatusText(status: SyncStatus): string {
  if (status === 'idle') return 'Synced'
  if (status === 'pull_required') return 'Pull required'
  if (status === 'conflict') return 'Conflicts'
  if (status === 'error') return 'Error'
  if (status === 'syncing') return 'Syncing…'
  return status
}

function hasRemote(remoteStatus: GitRemoteStatus | null): boolean {
  return remoteStatus?.hasRemote ?? false
}

function isRemoteMissing(remoteStatus: GitRemoteStatus | null | undefined): boolean {
  return remoteStatus?.hasRemote === false
}

function commitButtonTooltipCopy(remoteStatus: GitRemoteStatus | null | undefined): ActionTooltipCopy {
  return {
    label: isRemoteMissing(remoteStatus)
      ? 'Commit changes locally'
      : 'Commit and push changes',
  }
}

function getMcpBadgeConfig(status: McpStatus, onInstall?: () => void) {
  if (status === 'installed' || status === 'checking') return null
  const clickable = status === 'not_installed' && Boolean(onInstall)
  return {
    clickable,
    tooltip: MCP_TOOLTIPS[status] ?? 'MCP status unknown',
    onClick: clickable ? onInstall : undefined,
  }
}

function getClaudeCodeBadgeConfig(status: ClaudeCodeStatus, version?: string | null) {
  if (status === 'checking') return null
  const missing = status === 'missing'
  return {
    missing,
    label: missing ? 'Claude Code missing' : 'Claude Code',
    tooltip: missing ? 'Claude Code not found — click to install' : `Claude Code${version ? ` ${version}` : ''}`,
    onActivate: missing ? () => openExternalUrl(CLAUDE_INSTALL_URL) : undefined,
  }
}

function handleStatusBarActionKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  onClick?: () => void,
) {
  if (!onClick) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onClick()
}

function StatusBarAction({
  copy,
  children,
  onClick,
  testId,
  ariaLabel,
  className,
  style,
  disabled = false,
  compact = false,
}: {
  copy: ActionTooltipCopy
  children: ReactNode
  onClick?: () => void
  testId?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <ActionTooltip copy={copy} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(
          'h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground',
          compact && 'h-6 gap-0.5 px-0.5',
          disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
          className,
        )}
        style={style}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(event) => handleStatusBarActionKeyDown(event, disabled ? undefined : onClick)}
        aria-label={ariaLabel ?? copy.label}
        aria-disabled={disabled || undefined}
        data-testid={testId}
      >
        {children}
      </Button>
    </ActionTooltip>
  )
}

function StatusBarSeparator({ show = true }: { show?: boolean }) {
  if (!show) return null
  return <span style={SEP_STYLE}>|</span>
}

function RemoteStatusSummary({ remoteStatus }: { remoteStatus: GitRemoteStatus | null }) {
  if (!hasRemote(remoteStatus)) {
    return <div style={{ color: 'var(--muted-foreground)', marginBottom: 6 }}>No remote configured</div>
  }

  const ahead = remoteStatus?.ahead ?? 0
  const behind = remoteStatus?.behind ?? 0

  if (ahead === 0 && behind === 0) {
    return <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>In sync with remote</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>
      {ahead > 0 && <span title={`${ahead} commit${ahead > 1 ? 's' : ''} ahead of remote`}>↑ {ahead} ahead</span>}
      {behind > 0 && (
        <span title={`${behind} commit${behind > 1 ? 's' : ''} behind remote`} style={{ color: 'var(--accent-orange)' }}>
          ↓ {behind} behind
        </span>
      )}
    </div>
  )
}

function PullAction({
  remoteStatus,
  onPull,
  onClose,
}: {
  remoteStatus: GitRemoteStatus | null
  onPull?: () => void
  onClose: () => void
}) {
  if (!hasRemote(remoteStatus)) return null

  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
      <button
        onClick={() => {
          onPull?.()
          onClose()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 11,
          color: 'var(--foreground)',
          cursor: 'pointer',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
        data-testid="git-status-pull-btn"
      >
        <ArrowDown size={11} />Pull
      </button>
    </div>
  )
}

function GitStatusPopup({
  status,
  remoteStatus,
  onPull,
  onClose,
}: {
  status: SyncStatus
  remoteStatus: GitRemoteStatus | null
  onPull?: () => void
  onClose: () => void
}) {
  return (
    <div
      data-testid="git-status-popup"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        background: 'var(--sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 8,
        minWidth: 220,
        boxShadow: '0 4px 12px var(--shadow-dialog)',
        zIndex: 1000,
        fontSize: 12,
        color: 'var(--foreground)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <GitBranch size={13} style={{ color: 'var(--muted-foreground)' }} />
        <span style={{ fontWeight: 500 }}>{remoteStatus?.branch || '—'}</span>
      </div>
      <RemoteStatusSummary remoteStatus={remoteStatus} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        Status: {syncStatusText(status)}
      </div>
      <PullAction remoteStatus={remoteStatus} onPull={onPull} onClose={onClose} />
    </div>
  )
}

export function CommitBadge({ info }: { info: LastCommitInfo }) {
  const commitUrl = info.commitUrl

  if (commitUrl) {
    return (
      <span
        role="button"
        onClick={() => openExternalUrl(commitUrl)}
        style={{ ...ICON_STYLE, color: 'var(--muted-foreground)', textDecoration: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
        title={`Open commit ${info.shortHash} on GitHub`}
        data-testid="status-commit-link"
        onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--foreground)' }}
        onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--muted-foreground)' }}
      >
        <GitCommitHorizontal size={13} />
        {info.shortHash}
      </span>
    )
  }

  return (
    <span style={ICON_STYLE} data-testid="status-commit-hash">
      <GitCommitHorizontal size={13} />
      {info.shortHash}
    </span>
  )
}

export function OfflineBadge({
  isOffline,
  showSeparator = true,
  compact = false,
}: {
  isOffline?: boolean
  showSeparator?: boolean
  compact?: boolean
}) {
  if (!isOffline) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--destructive)',
          background: 'var(--feedback-error-bg)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title="No internet connection"
        data-testid="status-offline"
      >
        <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>
          ●
        </span>
        {compact ? null : 'Offline'}
      </span>
    </>
  )
}

export function NoRemoteBadge({
  remoteStatus,
  onAddRemote,
  showSeparator = true,
  compact = false,
}: {
  remoteStatus?: GitRemoteStatus | null
  onAddRemote?: () => void
  showSeparator?: boolean
  compact?: boolean
}) {
  if (!isRemoteMissing(remoteStatus)) return null

  if (onAddRemote) {
    return (
      <>
        <StatusBarSeparator show={showSeparator} />
        <StatusBarAction
          copy={{ label: 'Add a remote to this vault' }}
          onClick={onAddRemote}
          testId="status-no-remote"
          compact={compact}
        >
          <span style={ICON_STYLE}>
            <GitBranch size={12} />
            {compact ? null : 'No remote'}
          </span>
        </StatusBarAction>
      </>
    )
  }

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--muted-foreground)',
          background: 'var(--hover)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title="This git vault has no remote configured. Commits stay local until you add one."
        data-testid="status-no-remote"
      >
        <GitBranch size={12} />
        {compact ? null : 'No remote'}
      </span>
    </>
  )
}

export function SyncBadge({
  status,
  lastSyncTime,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  compact = false,
}: {
  status: SyncStatus
  lastSyncTime: number | null
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  compact?: boolean
}) {
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const SyncIcon = SYNC_ICON_MAP[status] ?? RefreshCw
  const isSyncing = status === 'syncing'

  useDismissibleLayer(showPopup, popupRef, () => setShowPopup(false))

  const handleClick = () => {
    if (status === 'conflict') {
      onOpenConflictResolver?.()
      return
    }

    if (status === 'pull_required') {
      onPullAndPush?.()
      return
    }

    setShowPopup((value) => !value)
  }

  return (
    <div ref={popupRef} style={{ position: 'relative' }}>
      <StatusBarAction copy={syncBadgeTooltipCopy(status)} onClick={handleClick} testId="status-sync" compact={compact}>
        <span style={ICON_STYLE}>
          <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />
          {compact ? null : formatSyncLabel(status, lastSyncTime)}
        </span>
      </StatusBarAction>
      {showPopup && (
        <GitStatusPopup
          status={status}
          remoteStatus={remoteStatus ?? null}
          onPull={onTriggerSync}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}

export function ConflictBadge({
  count,
  onClick,
  showSeparator = true,
  compact = false,
}: {
  count: number
  onClick?: () => void
  showSeparator?: boolean
  compact?: boolean
}) {
  if (count <= 0) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction
        copy={{ label: 'Resolve merge conflicts' }}
        onClick={onClick}
        testId="status-conflict-count"
        className="text-[var(--destructive)]"
        compact={compact}
      >
        <span style={ICON_STYLE}>
          <AlertTriangle size={13} />
          {compact ? null : `${count} conflict${count > 1 ? 's' : ''}`}
        </span>
      </StatusBarAction>
    </>
  )
}

export function ChangesBadge({
  count,
  onClick,
  showSeparator = true,
  compact = false,
}: {
  count: number
  onClick?: () => void
  showSeparator?: boolean
  compact?: boolean
}) {
  if (count <= 0) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction copy={{ label: 'View pending changes' }} onClick={onClick} testId="status-modified-count" compact={compact}>
        <span style={ICON_STYLE}>
          <GitDiff size={13} style={{ color: 'var(--accent-orange)' }} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-orange)',
              color: 'var(--text-inverse)',
              borderRadius: 9,
              padding: '0 5px',
              fontSize: 10,
              fontWeight: 600,
              minWidth: 16,
              lineHeight: '16px',
            }}
          >
            {count}
          </span>
          {compact ? null : 'Changes'}
        </span>
      </StatusBarAction>
    </>
  )
}

export function CommitButton({
  onClick,
  remoteStatus,
  showSeparator = true,
  compact = false,
}: {
  onClick?: () => void
  remoteStatus?: GitRemoteStatus | null
  showSeparator?: boolean
  compact?: boolean
}) {
  if (!onClick) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction copy={commitButtonTooltipCopy(remoteStatus)} onClick={onClick} testId="status-commit-push" compact={compact}>
        <span style={ICON_STYLE}>
          <GitCommitHorizontal size={13} />
          {compact ? null : 'Commit'}
        </span>
      </StatusBarAction>
    </>
  )
}

export function PulseBadge({
  onClick,
  disabled,
  showSeparator = true,
  compact = false,
}: {
  onClick?: () => void
  disabled?: boolean
  showSeparator?: boolean
  compact?: boolean
}) {
  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction
        copy={{ label: disabled ? 'History is only available for git-enabled vaults' : 'Open change history' }}
        onClick={disabled ? undefined : onClick}
        testId="status-pulse"
        disabled={Boolean(disabled)}
        compact={compact}
      >
        <span style={ICON_STYLE}>
          <Pulse size={13} />
          {compact ? null : 'History'}
        </span>
      </StatusBarAction>
    </>
  )
}

export function McpBadge({
  status,
  onInstall,
  showSeparator = true,
  compact = false,
}: {
  status: McpStatus
  onInstall?: () => void
  showSeparator?: boolean
  compact?: boolean
}) {
  const config = getMcpBadgeConfig(status, onInstall)
  if (!config) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onClick}
        testId="status-mcp"
        className="text-[var(--accent-orange)]"
        compact={compact}
      >
        <span style={ICON_STYLE}>
          <Cpu size={13} />
          {compact ? null : 'MCP'}
          <AlertTriangle size={10} style={{ marginLeft: 2 }} />
        </span>
      </StatusBarAction>
    </>
  )
}

export function ClaudeCodeBadge({
  status,
  version,
  showSeparator = true,
  compact = false,
}: {
  status: ClaudeCodeStatus
  version?: string | null
  showSeparator?: boolean
  compact?: boolean
}) {
  const config = getClaudeCodeBadgeConfig(status, version)
  if (!config) return null

  return (
    <>
      <StatusBarSeparator show={showSeparator} />
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onActivate}
        testId="status-claude-code"
        className={config.missing ? 'text-[var(--accent-orange)]' : undefined}
        compact={compact}
      >
        <span style={ICON_STYLE}>
          <Terminal size={13} />
          {compact ? null : config.label}
          {config.missing && <AlertTriangle size={10} style={{ marginLeft: 2 }} />}
        </span>
      </StatusBarAction>
    </>
  )
}
