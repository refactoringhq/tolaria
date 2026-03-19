import { AlertTriangle } from 'lucide-react'

interface ConflictNoteBannerProps {
  onKeepMine: () => void
  onKeepTheirs: () => void
}

export function ConflictNoteBanner({ onKeepMine, onKeepTheirs }: ConflictNoteBannerProps) {
  return (
    <div
      data-testid="conflict-note-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 16px',
        background: 'var(--muted)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--accent-orange)',
        flexShrink: 0,
      }}
    >
      <AlertTriangle size={13} />
      <span>This note has a merge conflict</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button
          data-testid="conflict-keep-mine-btn"
          onClick={onKeepMine}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--foreground)',
            cursor: 'pointer',
          }}
          title="Keep my local version"
        >
          Keep mine
        </button>
        <button
          data-testid="conflict-keep-theirs-btn"
          onClick={onKeepTheirs}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--foreground)',
            cursor: 'pointer',
          }}
          title="Keep the remote version"
        >
          Keep theirs
        </button>
      </div>
    </div>
  )
}
