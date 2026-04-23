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
import { t } from '../../lib/i18n'
import { useDismissibleLayer } from './useDismissibleLayer'
import { ICON_STYLE, SEP_STYLE } from './styles'

const SYNC_ICON_MAP: Record<string, typeof RefreshCw> = {
  syncing: Loader2,
  conflict: AlertTriangle,
  pull_required: ArrowDown,
}

const SYNC_LABELS: Record<string, string> = {
  syncing: t('Syncing…'),
  conflict: t('Conflict'),
  error: t('Sync failed'),
  pull_required: t('Pull required'),
}

const SYNC_COLORS: Record<string, string> = {
  conflict: 'var(--accent-orange)',
  error: 'var(--muted-foreground)',
  pull_required: 'var(--accent-orange)',
}

const MCP_TOOLTIPS: Partial<Record<McpStatus, string>> = {
  not_installed: t('External AI tools not connected — click to set up'),
}

const CLAUDE_INSTALL_URL = 'https://docs.anthropic.com/en/docs/claude-code'

function formatElapsedSync(lastSyncTime: number | null): string {
  if (!lastSyncTime) return t('Not synced')
  const secs = Math.round((Date.now() - lastSyncTime) / 1000)
  return secs < 60 ? t('Synced just now') : t('Synced {minutes}m ago', { minutes: Math.floor(secs / 60) })
}

function formatSyncLabel(status: SyncStatus, lastSyncTime: number | null): string {
  return SYNC_LABELS[status] ?? formatElapsedSync(lastSyncTime)
}

function syncIconColor(status: SyncStatus): string {
  return SYNC_COLORS[status] ?? 'var(--accent-green)'
}

function syncBadgeTooltipCopy(status: SyncStatus): ActionTooltipCopy {
  if (status === 'conflict') return { label: t('Resolve merge conflicts') }
  if (status === 'syncing') return { label: t('Sync in progress') }
  if (status === 'pull_required') return { label: t('Pull from remote and push') }
  if (status === 'error') return { label: t('Retry sync') }
  return { label: t('Sync now') }
}

function syncStatusText(status: SyncStatus): string {
  if (status === 'idle') return t('Synced')
  if (status === 'pull_required') return t('Pull required')
  if (status === 'conflict') return t('Conflicts')
  if (status === 'error') return t('Error')
  if (status === 'syncing') return t('Syncing…')
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
      ? t('Commit changes locally')
      : t('Commit and push changes'),
  }
}

function getMcpBadgeConfig(status: McpStatus, onInstall?: () => void) {
  if (status === 'installed' || status === 'checking') return null
  const clickable = status === 'not_installed' && Boolean(onInstall)
  return {
    clickable,
    tooltip: MCP_TOOLTIPS[status] ?? t('MCP status unknown'),
    onClick: clickable ? onInstall : undefined,
  }
}

function getClaudeCodeBadgeConfig(status: ClaudeCodeStatus, version?: string | null) {
  if (status === 'checking') return null
  const missing = status === 'missing'
  return {
    missing,
    label: missing ? t('Claude Code missing') : 'Claude Code',
    tooltip: missing ? t('Claude Code not found — click to install') : `Claude Code${version ? ` ${version}` : ''}`,
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
}: {
  copy: ActionTooltipCopy
  children: ReactNode
  onClick?: () => void
  testId?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
}) {
  return (
    <ActionTooltip copy={copy} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(
          'h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground',
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

function RemoteStatusSummary({ remoteStatus }: { remoteStatus: GitRemoteStatus | null }) {
  if (!hasRemote(remoteStatus)) {
    return <div style={{ color: 'var(--muted-foreground)', marginBottom: 6 }}>{t('No remote configured')}</div>
  }

  const ahead = remoteStatus?.ahead ?? 0
  const behind = remoteStatus?.behind ?? 0

  if (ahead === 0 && behind === 0) {
    return <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>{t('In sync with remote')}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>
      {ahead > 0 && (
        <span title={t(ahead > 1 ? '{count} commits ahead of remote' : '{count} commit ahead of remote', { count: ahead })}>
          {t('↑ {count} ahead', { count: ahead })}
        </span>
      )}
      {behind > 0 && (
        <span title={t(behind > 1 ? '{count} commits behind remote' : '{count} commit behind remote', { count: behind })} style={{ color: 'var(--accent-orange)' }}>
          {t('↓ {count} behind', { count: behind })}
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
        <ArrowDown size={11} />{t('Pull')}
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
        {t('Status: {status}', { status: syncStatusText(status) })}
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
        title={t('Open commit {shortHash} on GitHub', { shortHash: info.shortHash })}
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

export function OfflineBadge({ isOffline }: { isOffline?: boolean }) {
  if (!isOffline) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--destructive, #e03e3e)',
          background: 'rgba(224, 62, 62, 0.12)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title={t('No internet connection')}
        data-testid="status-offline"
      >
        <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>
          ●
        </span>
        {t('Offline')}
      </span>
    </>
  )
}

export function NoRemoteBadge({
  remoteStatus,
  onAddRemote,
}: {
  remoteStatus?: GitRemoteStatus | null
  onAddRemote?: () => void
}) {
  if (!isRemoteMissing(remoteStatus)) return null

  if (onAddRemote) {
    return (
      <>
        <span style={SEP_STYLE}>|</span>
        <StatusBarAction
          copy={{ label: t('Add a remote to this vault') }}
          onClick={onAddRemote}
          testId="status-no-remote"
        >
          <span style={ICON_STYLE}>
            <GitBranch size={12} />
            {t('No remote')}
          </span>
        </StatusBarAction>
      </>
    )
  }

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--muted-foreground)',
          background: 'var(--hover)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title={t('This git vault has no remote configured. Commits stay local until you add one.')}
        data-testid="status-no-remote"
      >
        <GitBranch size={12} />
        {t('No remote')}
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
      <StatusBarAction copy={syncBadgeTooltipCopy(status)} onClick={handleClick} testId="status-sync">
        <span style={ICON_STYLE}>
          <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />
          {formatSyncLabel(status, lastSyncTime)}
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

export function ConflictBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: t('Resolve merge conflicts') }}
        onClick={onClick}
        testId="status-conflict-count"
        className="text-[var(--destructive,#e03e3e)]"
      >
        <span style={ICON_STYLE}>
          <AlertTriangle size={13} />
          {t(count > 1 ? '{count} conflicts' : '{count} conflict', { count })}
        </span>
      </StatusBarAction>
    </>
  )
}

export function ChangesBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction copy={{ label: t('View pending changes') }} onClick={onClick} testId="status-modified-count">
        <span style={ICON_STYLE}>
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
          {t('Changes')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function CommitButton({
  onClick,
  remoteStatus,
}: {
  onClick?: () => void
  remoteStatus?: GitRemoteStatus | null
}) {
  if (!onClick) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction copy={commitButtonTooltipCopy(remoteStatus)} onClick={onClick} testId="status-commit-push">
        <span style={ICON_STYLE}>
          <GitCommitHorizontal size={13} />
          {t('Commit')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function PulseBadge({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: disabled ? t('History is only available for git-enabled vaults') : t('Open change history') }}
        onClick={disabled ? undefined : onClick}
        testId="status-pulse"
        disabled={Boolean(disabled)}
      >
        <span style={ICON_STYLE}>
          <Pulse size={13} />
          {t('History')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function McpBadge({ status, onInstall }: { status: McpStatus; onInstall?: () => void }) {
  const config = getMcpBadgeConfig(status, onInstall)
  if (!config) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onClick}
        testId="status-mcp"
        className="text-[var(--accent-orange)]"
      >
        <span style={ICON_STYLE}>
          <Cpu size={13} />
          MCP
          <AlertTriangle size={10} style={{ marginLeft: 2 }} />
        </span>
      </StatusBarAction>
    </>
  )
}

export function ClaudeCodeBadge({ status, version }: { status: ClaudeCodeStatus; version?: string | null }) {
  const config = getClaudeCodeBadgeConfig(status, version)
  if (!config) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onActivate}
        testId="status-claude-code"
        className={config.missing ? 'text-[var(--accent-orange)]' : undefined}
      >
        <span style={ICON_STYLE}>
          <Terminal size={13} />
          {config.label}
          {config.missing && <AlertTriangle size={10} style={{ marginLeft: 2 }} />}
        </span>
      </StatusBarAction>
    </>
  )
}
