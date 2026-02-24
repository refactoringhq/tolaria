import { useState, useRef, useEffect } from 'react'
import { Package, GitBranch, RefreshCw, Sparkles, FileText, Bell, Settings, FolderOpen, Check, Github, CircleDot } from 'lucide-react'

export interface VaultOption {
  label: string
  path: string
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
}

function VaultMenuItem({ vault, isActive, onSelect }: { vault: VaultOption; isActive: boolean; onSelect: () => void }) {
  return (
    <div
      role="button" onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
        background: isActive ? 'var(--hover)' : 'transparent',
        color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', fontSize: 12,
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--hover)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {isActive ? <Check size={12} /> : <span style={{ width: 12 }} />}
      {vault.label}
    </div>
  )
}

function VaultMenu({ vaults, vaultPath, onSwitchVault, onOpenLocalFolder, onConnectGitHub, hasGitHub }: { vaults: VaultOption[]; vaultPath: string; onSwitchVault: (path: string) => void; onOpenLocalFolder?: () => void; onConnectGitHub?: () => void; hasGitHub?: boolean }) {
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
          {vaults.map((v) => <VaultMenuItem key={v.path} vault={v} isActive={v.path === vaultPath} onSelect={() => { onSwitchVault(v.path); setOpen(false) }} />)}
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

export function StatusBar({ noteCount, modifiedCount = 0, vaultPath, vaults, onSwitchVault, onOpenSettings, onOpenLocalFolder, onConnectGitHub, onClickPending, hasGitHub }: StatusBarProps) {
  return (
    <footer style={{ height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sidebar)', borderTop: '1px solid var(--border)', padding: '0 8px', fontSize: 11, color: 'var(--muted-foreground)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <VaultMenu vaults={vaults} vaultPath={vaultPath} onSwitchVault={onSwitchVault} onOpenLocalFolder={onOpenLocalFolder} onConnectGitHub={onConnectGitHub} hasGitHub={hasGitHub} />
        <span style={SEP_STYLE}>|</span>
        <span style={ICON_STYLE}><Package size={13} />v0.4.2</span>
        <span style={SEP_STYLE}>|</span>
        <span style={ICON_STYLE}><GitBranch size={13} />main</span>
        <span style={SEP_STYLE}>|</span>
        <span style={ICON_STYLE}><RefreshCw size={13} style={{ color: 'var(--accent-green)' }} />Synced 2m ago</span>
        {modifiedCount > 0 && (
          <>
            <span style={SEP_STYLE}>|</span>
            <span
              role="button"
              onClick={onClickPending}
              style={{ ...ICON_STYLE, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, background: 'transparent' }}
              title="View pending changes"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              data-testid="status-modified-count"
            ><CircleDot size={13} style={{ color: 'var(--accent-orange)' }} />{modifiedCount} pending</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={ICON_STYLE}><Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />Claude Sonnet 4</span>
        <span style={ICON_STYLE}><FileText size={13} />{noteCount.toLocaleString()} notes</span>
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
