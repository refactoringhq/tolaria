import type { ComponentType, SVGAttributes } from 'react'
import { Trash, X } from '@phosphor-icons/react'

export function StatusSuffix({ isArchived, isTrashed }: { isArchived: boolean; isTrashed: boolean }) {
  if (isTrashed) return <span style={{ fontSize: 10, opacity: 0.8 }}>(trashed)</span>
  if (isArchived) return <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>(archived)</span>
  return null
}

export function LinkButton({ label, emoji, typeColor, bgColor, isArchived, isTrashed, onClick, onRemove, title, TypeIcon }: {
  label: string
  emoji?: string | null
  typeColor: string
  bgColor?: string
  isArchived: boolean
  isTrashed: boolean
  onClick: () => void
  onRemove?: () => void
  title?: string
  TypeIcon: ComponentType<SVGAttributes<SVGSVGElement>>
}) {
  const isDimmed = isArchived || isTrashed
  const color = isDimmed ? 'var(--muted-foreground)' : typeColor
  return (
    <button
      className={`group/link flex w-full items-center justify-between gap-2 border-none text-left cursor-pointer min-w-0${bgColor ? ' ring-inset hover:ring-1 hover:ring-current' : ' hover:opacity-80'}`}
      style={{
        background: isDimmed ? 'var(--muted)' : (bgColor ?? 'transparent'),
        color, borderRadius: 6, padding: bgColor ? '6px 10px' : '4px 0',
        fontSize: 12, fontWeight: 500, opacity: isDimmed ? 0.7 : 1,
      }}
      onClick={onClick}
      title={title}
    >
      <span className="flex items-center gap-1 flex-1 truncate">
        {isTrashed && <Trash size={12} className="shrink-0" />}
        {emoji && <span className="shrink-0">{emoji}</span>}
        {label}
        <StatusSuffix isArchived={isArchived} isTrashed={isTrashed} />
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {onRemove && (
          <span
            className="flex items-center opacity-0 transition-opacity group-hover/link:opacity-100"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            role="button"
            title="Remove from relation"
            data-testid="remove-relation-ref"
          >
            <X size={14} />
          </span>
        )}
        <TypeIcon width={14} height={14} className="shrink-0" style={{ color, opacity: 0.5 }} />
      </span>
    </button>
  )
}
