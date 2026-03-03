import { useState, useRef, useEffect } from 'react'
import { Package, RefreshCw, FileText, Bell, Settings, FolderOpen, Check, Github, CircleDot, AlertTriangle, Loader2, GitCommitHorizontal, Search, X } from 'lucide-react'
import type { LastCommitInfo, SyncStatus } from '../types'
import type { IndexingProgress } from '../hooks/useIndexing'
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
  hasGitHub?: boolean
  syncStatus?: SyncStatus
  lastSyncTime?: number | null
  conflictCount?: number
  lastCommitInfo?: LastCommitInfo | null
  onTriggerSync?: () => void
  onOpenConflictResolver?: () => void
  zoomLevel?: number
  onZoomReset?: () => void
  buildNumber?: string
  onCheckForUpdates?: () => void
  indexingProgress?: IndexingProgress
  onRetryIndexing?: () => void
  onRemoveVault?: (path: string) => void
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
const SYNC_ICON_MAP: Record<string, typeof RefreshCw> = { syncing: Loader2, conflict: AlertTriangle }

const SYNC_LABELS: Record<string, string> = { syncing: 'Syncing…', conflict: 'Conflict', error: 'Sync failed' }
const SYNC_COLORS: Record<string, string> = { conflict: 'var(--accent-orange)', error: 'var(--muted-foreground)' }

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

function SyncBadge({ status, lastSyncTime, onTriggerSync, onOpenConflictResolver }: { status: SyncStatus; lastSyncTime: number | null; onTriggerSync?: () => void; onOpenConflictResolver?: () => void }) {
  const SyncIcon = SYNC_ICON_MAP[status] ?? RefreshCw
  const isSyncing = status === 'syncing'
  const isConflict = status === 'conflict'
  const handleClick = isConflict ? onOpenConflictResolver : onTriggerSync
  return (
    <span
      role="button"
      onClick={handleClick}
      style={{ ...ICON_STYLE, cursor: handleClick ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 3 }}
      title={isConflict ? 'Click to resolve conflicts' : isSyncing ? 'Syncing…' : 'Click to sync now'}
      data-testid="status-sync"
    >
      <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />{formatSyncLabel(status, lastSyncTime)}
    </span>
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

const INDEXING_LABELS: Record<string, string> = {
  installing: 'Installing search…',
  scanning: 'Indexing…',
  embedding: 'Embedding…',
  complete: 'Index ready',
  error: 'Index failed — retry',
  unavailable: 'Search unavailable',
}

function IndexingBadge({ progress, onRetry }: { progress: IndexingProgress; onRetry?: () => void }) {
  if (progress.phase === 'idle' || progress.phase === 'unavailable') return null
  const label = INDEXING_LABELS[progress.phase] ?? progress.phase
  const isActive = !progress.done
  const isError = progress.phase === 'error'
  const showCount = progress.total > 0 && isActive
  const displayText = showCount
    ? `${label} ${progress.current.toLocaleString()}/${progress.total.toLocaleString()}`
    : label
  const color = isError ? 'var(--accent-orange)' : 'var(--accent-blue, #3b82f6)'

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        role={isError && onRetry ? 'button' : undefined}
        onClick={isError && onRetry ? onRetry : undefined}
        style={{ ...ICON_STYLE, color, cursor: isError && onRetry ? 'pointer' : 'default' }}
        title={isError ? 'Click to retry indexing' : undefined}
        data-testid="status-indexing"
      >
        {isActive
          ? <Loader2 size={13} className="animate-spin" />
          : <Search size={13} />
        }
        {displayText}
      </span>
    </>
  )
}

function PendingBadge({ count, onClick }: { count: number; onClick?: () => void }) {
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
      ><CircleDot size={13} style={{ color: 'var(--accent-orange)' }} />{count} pending</span>
    </>
  )
}

export function StatusBar({ noteCount, modifiedCount = 0, vaultPath, vaults, onSwitchVault, onOpenSettings, onOpenLocalFolder, onConnectGitHub, onClickPending, hasGitHub, syncStatus = 'idle', lastSyncTime = null, conflictCount = 0, lastCommitInfo, onTriggerSync, onOpenConflictResolver, zoomLevel = 100, onZoomReset, buildNumber, onCheckForUpdates, indexingProgress, onRetryIndexing, onRemoveVault }: StatusBarProps) {
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
        <SyncBadge status={syncStatus} lastSyncTime={lastSyncTime} onTriggerSync={onTriggerSync} onOpenConflictResolver={onOpenConflictResolver} />
        {lastCommitInfo && <CommitBadge info={lastCommitInfo} />}
        <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} />
        <PendingBadge count={modifiedCount} onClick={onClickPending} />
        {indexingProgress && <IndexingBadge progress={indexingProgress} onRetry={onRetryIndexing} />}
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
