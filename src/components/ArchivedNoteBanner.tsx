import { Archive, ArrowUUpLeft } from '@phosphor-icons/react'

interface ArchivedNoteBannerProps {
  onUnarchive: () => void
}

export function ArchivedNoteBanner({ onUnarchive }: ArchivedNoteBannerProps) {
  return (
    <div
      data-testid="archived-note-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 16px',
        background: 'var(--muted)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--muted-foreground)',
        flexShrink: 0,
      }}
    >
      <Archive size={13} weight="bold" />
      <span>Archived</span>
      <button
        data-testid="unarchive-btn"
        onClick={onUnarchive}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginLeft: 'auto',
          padding: '2px 8px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 11,
          color: 'var(--muted-foreground)',
          cursor: 'pointer',
        }}
        title="Unarchive (Cmd+E)"
      >
        <ArrowUUpLeft size={12} />
        Unarchive
      </button>
    </div>
  )
}
