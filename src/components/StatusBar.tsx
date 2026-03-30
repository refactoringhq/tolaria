import { useState, useRef, useEffect } from 'react'
import { Package, RefreshCw, FileText, Bell, Settings, FolderOpen, Check, Github, AlertTriangle, Loader2, GitCommitHorizontal, X, Cpu, ArrowDown, GitBranch } from 'lucide-react'
import { GitDiff, Pulse } from '@phosphor-icons/react'
import type { GitRemoteStatus, LastCommitInfo, SyncStatus } from '../types'
import type { McpStatus } from '../hooks/useMcpStatus'
import { openExternalUrl } from '../utils/url'

export interface VaultOption {
  label: string
  path: string
  available?: boolean
}

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
  buildNumber?: string
  onCheckForUpdates?: () => void
  onRemoveVault?: (path: string) => void
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
}

function VaultMenuIcon({ isActive, unavailable }: { isActive: boolean; unavailable: boolean }) {
  if (isActive) return <Check size={12} />
  if (unavailable) return <AlertTriangle size={12} style={{ color: 'var(--muted-foreground)' }} />
  return <span style={{ width: 12 }} />
}

function vaultItemStyle(isActive: boolean, unavailable: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4,
    cursor: unavailable ? 'not-allowed' : 'pointer',
    background: isActive ? 'var(--hover)' : 'transparent',
    opacity: unavailable ? 0.45 : 1,
    color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', fontSize: 12,
  }
}

function VaultMenuItem({ vault, isActive, onSelect, onRemove, canRemove }: { vault: VaultOption; isActive: boolean; onSelect: () => void; onRemove?: () => void; canRemove?: boolean }) {
  const unavailable = vault.available === false
  const canHover = !isActive && !unavailable
  return (
    <div
      role="button"
      onClick={unavailable ? undefined : onSelect}
      style={{ ...vaultItemStyle(isActive, unavailable), justifyContent: 'space-between' }}
      title={unavailable ? `Vault not found: ${vault.path}` : vault.path}
      onMouseEnter={canHover ? (e) => { e.currentTarget.style.background = 'var(--hover)' } : undefined}
      onMouseLeave={canHover ? (e) => { e.currentTarget.style.background = 'transparent' } : undefined}
      data-testid={`vault-menu-item-${vault.label}`}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <VaultMenuIcon isActive={isActive} unavailable={unavailable} />
        {vault.label}
      </span>
      {canRemove && onRemove && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{ display: 'flex', alignItems: 'center', padding: 2, borderRadius: 3, cursor: 'pointer', opacity: 0.5 }}
          title="Remove from list"
          data-testid={`vault-menu-remove-${vault.label}`}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--hover)' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent' }}
        >
          <X size={10} />
        </span>
      )}
    </div>
  )
}

function VaultMenu({ vaults, vaultPath, onSwitchVault, onOpenLocalFolder, onConnectGitHub, hasGitHub, onRemoveVault }: { vaults: VaultOption[]; vaultPath: string; onSwitchVault: (path: string) => void; onOpenLocalFolder?: () => void; onConnectGitHub?: () => void; hasGitHub?: boolean; onRemoveVault?: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeVault = vaults.find((v) => v.path === vaultPath)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <span role="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: open ? 'var(--hover)' : 'transparent' }} title="Switch vault">
        <FolderOpen size={13} />
        {activeVault?.label ?? 'Vault'}
      </span>
      {open && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, background: 'var(--sidebar)', border: '1px solid var(--border)', borderRadius: 6, padding: 4, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000 }}>
          {vaults.map((v) => <VaultMenuItem key={v.path} vault={v} isActive={v.path === vaultPath} onSelect={() => { onSwitchVault(v.path); setOpen(false) }} onRemove={() => { onRemoveVault?.(v.path); setOpen(false) }} canRemove={!!onRemoveVault && vaults.length > 1} />)}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {onOpenLocalFolder && (
            <div
              role="button"
              onClick={() => { onOpenLocalFolder(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4,
                cursor: 'pointer', background: 'transparent',
                color: 'var(--muted-foreground)', fontSize: 12,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              data-testid="vault-menu-open-local"
            >
              <FolderOpen size={12} />
              Open local folder
            </div>
          )}
          {onConnectGitHub && (
            <div
              role="button"
              onClick={() => { onConnectGitHub(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4,
                cursor: 'pointer', background: 'transparent',
                color: hasGitHub ? 'var(--muted-foreground)' : 'var(--accent-blue)', fontSize: 12,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              data-testid="vault-menu-connect-github"
            >
              <Github size={12} />
              Connect GitHub repo
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ICON_STYLE = { display: 'flex', alignItems: 'center', gap: 4 } as const
const DISABLED_STYLE = { display: 'flex', alignItems: 'center', opacity: 0.4, cursor: 'not-allowed' } as const
const SEP_STYLE = { color: 'var(--border)' } as const
const SYNC_ICON_MAP: Record<string, typeof RefreshCw> = { syncing: Loader2, conflict: AlertTriangle, pull_required: ArrowDown }

const SYNC_LABELS: Record<string, string> = { syncing: 'Syncing…', conflict: 'Conflict', error: 'Sync failed', pull_required: 'Pull required' }
const SYNC_COLORS: Record<string, string> = { conflict: 'var(--accent-orange)', error: 'var(--muted-foreground)', pull_required: 'var(--accent-orange)' }

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

function CommitBadge({ info }: { info: LastCommitInfo }) {
  if (info.commitUrl) {
    return (
      <span
        role="button"
        onClick={() => openExternalUrl(info.commitUrl!)}
        style={{ ...ICON_STYLE, color: 'var(--muted-foreground)', textDecoration: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
        title={`Open commit ${info.shortHash} on GitHub`}
        data-testid="status-commit-link"
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)' }}
      >
        <GitCommitHorizontal size={13} />{info.shortHash}
      </span>
    )
  }
  return (
    <span style={ICON_STYLE} data-testid="status-commit-hash">
      <GitCommitHorizontal size={13} />{info.shortHash}
    </span>
  )
}

function syncBadgeTitle(status: SyncStatus): string {
  if (status === 'conflict') return 'Click to resolve conflicts'
  if (status === 'syncing') return 'Syncing…'
  if (status === 'pull_required') return 'Click to pull from remote and push'
  return 'Click to sync now'
}

function SyncBadge({ status, lastSyncTime, remoteStatus, onTriggerSync, onPullAndPush, onOpenConflictResolver }: { status: SyncStatus; lastSyncTime: number | null; remoteStatus?: GitRemoteStatus | null; onTriggerSync?: () => void; onPullAndPush?: () => void; onOpenConflictResolver?: () => void }) {
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const SyncIcon = SYNC_ICON_MAP[status] ?? RefreshCw
  const isSyncing = status === 'syncing'
  const isConflict = status === 'conflict'
  const isPullRequired = status === 'pull_required'

  const handleClick = () => {
    if (isConflict) { onOpenConflictResolver?.(); return }
    if (isPullRequired) { onPullAndPush?.(); return }
    setShowPopup(v => !v)
  }

  useEffect(() => {
    if (!showPopup) return
    const handleOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowPopup(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showPopup])

  return (
    <div ref={popupRef} style={{ position: 'relative' }}>
      <span
        role="button"
        onClick={handleClick}
        style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
        title={syncBadgeTitle(status)}
        data-testid="status-sync"
      >
        <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />{formatSyncLabel(status, lastSyncTime)}
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

function GitStatusPopup({ status, remoteStatus, onPull, onClose }: { status: SyncStatus; remoteStatus: GitRemoteStatus | null; onPull?: () => void; onClose: () => void }) {
  const branch = remoteStatus?.branch || '—'
  const ahead = remoteStatus?.ahead ?? 0
  const behind = remoteStatus?.behind ?? 0
  const hasRemote = remoteStatus?.hasRemote ?? false

  return (
    <div
      data-testid="git-status-popup"
      style={{
        position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
        background: 'var(--sidebar)', border: '1px solid var(--border)',
        borderRadius: 6, padding: 8, minWidth: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000, fontSize: 12, color: 'var(--foreground)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <GitBranch size={13} style={{ color: 'var(--muted-foreground)' }} />
        <span style={{ fontWeight: 500 }}>{branch}</span>
      </div>

      {hasRemote && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>
          {ahead > 0 && <span title={`${ahead} commit${ahead > 1 ? 's' : ''} ahead of remote`}>↑ {ahead} ahead</span>}
          {behind > 0 && <span title={`${behind} commit${behind > 1 ? 's' : ''} behind remote`} style={{ color: 'var(--accent-orange)' }}>↓ {behind} behind</span>}
          {ahead === 0 && behind === 0 && <span>In sync with remote</span>}
        </div>
      )}

      {!hasRemote && (
        <div style={{ color: 'var(--muted-foreground)', marginBottom: 6 }}>No remote configured</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        Status: {status === 'idle' ? 'Synced' : status === 'pull_required' ? 'Pull required' : status === 'conflict' ? 'Conflicts' : status === 'error' ? 'Error' : status === 'syncing' ? 'Syncing…' : status}
      </div>

      {hasRemote && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          <button
            onClick={() => { onPull?.(); onClose() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 11, color: 'var(--foreground)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            data-testid="git-status-pull-btn"
          >
            <ArrowDown size={11} />Pull
          </button>
        </div>
      )}
    </div>
  )
}

function ConflictBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null
  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onClick}
        style={{ ...ICON_STYLE, color: 'var(--destructive, #e03e3e)', cursor: onClick ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="Resolve merge conflicts"
        onMouseEnter={onClick ? (e) => { e.currentTarget.style.background = 'var(--hover)' } : undefined}
        onMouseLeave={onClick ? (e) => { e.currentTarget.style.background = 'transparent' } : undefined}
        data-testid="status-conflict-count"
      >
        <AlertTriangle size={13} />{count} conflict{count > 1 ? 's' : ''}
      </span>
    </>
  )
}

function ChangesBadge({ count, onClick, onCommitPush }: { count: number; onClick?: () => void; onCommitPush?: () => void }) {
  if (count <= 0) return null
  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role="button"
        onClick={onClick}
        style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
        title="View pending changes"
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        data-testid="status-modified-count"
      >
        <GitDiff size={13} style={{ color: 'var(--accent-orange)' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-orange)', color: '#fff', borderRadius: 9, padding: '0 5px', fontSize: 10, fontWeight: 600, minWidth: 16, lineHeight: '16px' }}>{count}</span>
        Changes
      </span>
      {onCommitPush && (
        <span
          role="button"
          onClick={onCommitPush}
          style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
          title="Commit & Push"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          data-testid="status-commit-push"
        >
          <GitCommitHorizontal size={13} style={{ color: 'var(--accent-orange)' }} />
        </span>
      )}
    </>
  )
}

function PulseBadge({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
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
        onMouseEnter={disabled ? undefined : (e) => { e.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={disabled ? undefined : (e) => { e.currentTarget.style.background = 'transparent' }}
        data-testid="status-pulse"
      >
        <Pulse size={13} />Pulse
      </span>
    </>
  )
}

const MCP_TOOLTIPS: Record<string, string> = {
  not_installed: 'MCP server not installed — click to install',
  no_claude_cli: 'Claude CLI not found — install it first',
}

function McpBadge({ status, onInstall }: { status: McpStatus; onInstall?: () => void }) {
  if (status === 'installed' || status === 'checking') return null
  const tooltip = MCP_TOOLTIPS[status] ?? 'MCP status unknown'
  const clickable = status === 'not_installed' && !!onInstall
  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role={clickable ? 'button' : undefined}
        onClick={clickable ? onInstall : undefined}
        style={{
          ...ICON_STYLE,
          color: 'var(--accent-orange)',
          cursor: clickable ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 3,
          background: 'transparent',
        }}
        title={tooltip}
        data-testid="status-mcp"
        onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = 'var(--hover)' } : undefined}
        onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = 'transparent' } : undefined}
      >
        <Cpu size={13} />MCP
        <AlertTriangle size={10} style={{ marginLeft: 2 }} />
      </span>
    </>
  )
}

export function StatusBar({ noteCount, modifiedCount = 0, vaultPath, vaults, onSwitchVault, onOpenSettings, onOpenLocalFolder, onConnectGitHub, onClickPending, onClickPulse, onCommitPush, isGitVault = false, hasGitHub, syncStatus = 'idle', lastSyncTime = null, conflictCount = 0, lastCommitInfo, remoteStatus, onTriggerSync, onPullAndPush, onOpenConflictResolver, zoomLevel = 100, onZoomReset, buildNumber, onCheckForUpdates, onRemoveVault, mcpStatus, onInstallMcp }: StatusBarProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer style={{ height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sidebar)', borderTop: '1px solid var(--border)', padding: '0 8px', fontSize: 11, color: 'var(--muted-foreground)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <VaultMenu vaults={vaults} vaultPath={vaultPath} onSwitchVault={onSwitchVault} onOpenLocalFolder={onOpenLocalFolder} onConnectGitHub={onConnectGitHub} hasGitHub={hasGitHub} onRemoveVault={onRemoveVault} />
        <span style={SEP_STYLE}>|</span>
        <span
          role="button"
          onClick={onCheckForUpdates}
          style={{ ...ICON_STYLE, cursor: onCheckForUpdates ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
          title="Check for updates"
          data-testid="status-build-number"
          onMouseEnter={onCheckForUpdates ? (e) => { e.currentTarget.style.background = 'var(--hover)' } : undefined}
          onMouseLeave={onCheckForUpdates ? (e) => { e.currentTarget.style.background = 'transparent' } : undefined}
        ><Package size={13} />{buildNumber ?? 'b?'}</span>
        <span style={SEP_STYLE}>|</span>
        <SyncBadge status={syncStatus} lastSyncTime={lastSyncTime} remoteStatus={remoteStatus} onTriggerSync={onTriggerSync} onPullAndPush={onPullAndPush} onOpenConflictResolver={onOpenConflictResolver} />
        {lastCommitInfo && <CommitBadge info={lastCommitInfo} />}
        <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} />
        <ChangesBadge count={modifiedCount} onClick={onClickPending} onCommitPush={onCommitPush} />
        <PulseBadge onClick={onClickPulse} disabled={!isGitVault} />
        {mcpStatus && <McpBadge status={mcpStatus} onInstall={onInstallMcp} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={ICON_STYLE}><FileText size={13} />{noteCount.toLocaleString()} notes</span>
        {zoomLevel !== 100 && (
          <span
            role="button"
            onClick={onZoomReset}
            style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
            title="Reset zoom (⌘0)"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            data-testid="status-zoom"
          >{zoomLevel}%</span>
        )}
        <span style={DISABLED_STYLE} title="Coming soon"><Bell size={14} /></span>
        <span
          role="button"
          onClick={onOpenSettings}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
          title="Settings (⌘,)"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <Settings size={14} />
        </span>
      </div>
    </footer>
  )
}
