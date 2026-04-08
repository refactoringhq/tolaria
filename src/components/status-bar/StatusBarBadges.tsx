import { useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'
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
  not_installed: 'MCP server not installed — click to install',
  no_claude_cli: 'Claude CLI not found — install it first',
}

const CLAUDE_INSTALL_URL = 'https://docs.anthropic.com/en/docs/claude-code'

type HoverHandlers = {
  onMouseEnter?: (event: ReactMouseEvent<HTMLSpanElement>) => void
  onMouseLeave?: (event: ReactMouseEvent<HTMLSpanElement>) => void
}

interface ClaudeCodeRenderState extends HoverHandlers {
  role?: 'button'
  tabIndex?: number
  onKeyDown?: (event: ReactKeyboardEvent<HTMLSpanElement>) => void
  color: string
  cursor: string
  warningIcon: ReactNode
}

function createHoverHandlers(interactive: boolean): HoverHandlers {
  if (!interactive) {
    return {
      onMouseEnter: undefined,
      onMouseLeave: undefined,
    }
  }

  return {
    onMouseEnter: (event) => {
      event.currentTarget.style.background = 'var(--hover)'
    },
    onMouseLeave: (event) => {
      event.currentTarget.style.background = 'transparent'
    },
  }
}

function createEnterKeyHandler(onActivate?: () => void) {
  return (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter') {
      onActivate?.()
    }
  }
}

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

function syncBadgeTitle(status: SyncStatus): string {
  if (status === 'conflict') return 'Click to resolve conflicts'
  if (status === 'syncing') return 'Syncing…'
  if (status === 'pull_required') return 'Click to pull from remote and push'
  return 'Click to sync now'
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

function createClaudeCodeRenderState(
  config: NonNullable<ReturnType<typeof getClaudeCodeBadgeConfig>>,
): ClaudeCodeRenderState {
  if (!config.missing) {
    return {
      role: undefined,
      tabIndex: undefined,
      onKeyDown: undefined,
      color: 'var(--muted-foreground)',
      cursor: 'default',
      warningIcon: null,
      ...createHoverHandlers(false),
    }
  }

  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: createEnterKeyHandler(config.onActivate),
    color: 'var(--accent-orange)',
    cursor: 'pointer',
    warningIcon: <AlertTriangle size={10} style={{ marginLeft: 2 }} />,
    ...createHoverHandlers(true),
  }
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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

export function SyncBadge({
  status,
  lastSyncTime,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
}: {
  status: SyncStatus
  lastSyncTime: number | null
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
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
      <span
        role="button"
        onClick={handleClick}
        style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
        title={syncBadgeTitle(status)}
        data-testid="status-sync"
      >
        <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />
        {formatSyncLabel(status, lastSyncTime)}
      </span>
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

export function ConflictBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onClick}
        style={{
          ...ICON_STYLE,
          color: 'var(--destructive, #e03e3e)',
          cursor: onClick ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 3,
          background: 'transparent',
        }}
        title="Resolve merge conflicts"
        onMouseEnter={onClick ? (event) => { event.currentTarget.style.background = 'var(--hover)' } : undefined}
        onMouseLeave={onClick ? (event) => { event.currentTarget.style.background = 'transparent' } : undefined}
        data-testid="status-conflict-count"
      >
        <AlertTriangle size={13} />
        {count} conflict{count > 1 ? 's' : ''}
      </span>
    </>
  )
}

export function ChangesBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onClick}
        style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="View pending changes"
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
        data-testid="status-modified-count"
      >
        <GitDiff size={13} style={{ color: 'var(--accent-orange)' }} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-orange)',
            color: '#fff',
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
        Changes
      </span>
    </>
  )
}

export function CommitButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onClick}
        style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="Commit & Push"
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
        data-testid="status-commit-push"
      >
        <GitCommitHorizontal size={13} />
        Commit
      </span>
    </>
  )
}

export function PulseBadge({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role={disabled ? undefined : 'button'}
        onClick={disabled ? undefined : onClick}
        style={{
          ...ICON_STYLE,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '2px 4px',
          borderRadius: 3,
          background: 'transparent',
          opacity: disabled ? 0.4 : 1,
        }}
        title={disabled ? 'Pulse is only available for git-enabled vaults' : 'View pulse'}
        onMouseEnter={disabled ? undefined : (event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={disabled ? undefined : (event) => { event.currentTarget.style.background = 'transparent' }}
        data-testid="status-pulse"
      >
        <Pulse size={13} />
        Pulse
      </span>
    </>
  )
}

export function McpBadge({ status, onInstall }: { status: McpStatus; onInstall?: () => void }) {
  const config = getMcpBadgeConfig(status, onInstall)
  if (!config) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role={config.clickable ? 'button' : undefined}
        onClick={config.onClick}
        style={{
          ...ICON_STYLE,
          color: 'var(--accent-orange)',
          cursor: config.clickable ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 3,
          background: 'transparent',
        }}
        title={config.tooltip}
        data-testid="status-mcp"
        onMouseEnter={config.clickable ? (event) => { event.currentTarget.style.background = 'var(--hover)' } : undefined}
        onMouseLeave={config.clickable ? (event) => { event.currentTarget.style.background = 'transparent' } : undefined}
      >
        <Cpu size={13} />
        MCP
        <AlertTriangle size={10} style={{ marginLeft: 2 }} />
      </span>
    </>
  )
}

export function ClaudeCodeBadge({ status, version }: { status: ClaudeCodeStatus; version?: string | null }) {
  const config = getClaudeCodeBadgeConfig(status, version)
  if (!config) return null

  const renderState = createClaudeCodeRenderState(config)

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role={renderState.role}
        tabIndex={renderState.tabIndex}
        onClick={config.onActivate}
        onKeyDown={renderState.onKeyDown}
        style={{
          ...ICON_STYLE,
          color: renderState.color,
          cursor: renderState.cursor,
          padding: '2px 4px',
          borderRadius: 3,
          background: 'transparent',
        }}
        title={config.tooltip}
        data-testid="status-claude-code"
        onMouseEnter={renderState.onMouseEnter}
        onMouseLeave={renderState.onMouseLeave}
      >
        <Terminal size={13} />
        {config.label}
        {renderState.warningIcon}
      </span>
    </>
  )
}
