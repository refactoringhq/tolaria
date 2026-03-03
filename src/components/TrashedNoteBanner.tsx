import { memo } from 'react'
import { Trash, ArrowCounterClockwise } from '@phosphor-icons/react'

interface TrashedNoteBannerProps {
  onRestore: () => void
  onDeletePermanently: () => void
}

export const TrashedNoteBanner = memo(function TrashedNoteBanner({
  onRestore,
  onDeletePermanently,
}: TrashedNoteBannerProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-3"
      style={{
        padding: '6px 16px',
        background: 'var(--destructive-muted, color-mix(in srgb, var(--destructive) 8%, var(--background)))',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}
      data-testid="trashed-note-banner"
    >
      <Trash size={14} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
      <span className="text-muted-foreground" style={{ flex: 1 }}>This note is in the Trash</span>
      <button
        className="flex items-center gap-1 border-none bg-transparent px-2 py-0.5 text-xs cursor-pointer rounded transition-colors text-primary hover:bg-accent"
        onClick={onRestore}
        data-testid="trashed-banner-restore"
      >
        <ArrowCounterClockwise size={12} />
        Restore
      </button>
      <button
        className="flex items-center gap-1 border-none bg-transparent px-2 py-0.5 text-xs cursor-pointer rounded transition-colors text-destructive hover:bg-destructive/10"
        onClick={onDeletePermanently}
        data-testid="trashed-banner-delete"
      >
        <Trash size={12} />
        Delete permanently
      </button>
    </div>
  )
})
