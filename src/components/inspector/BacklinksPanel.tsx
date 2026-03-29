import type { VaultEntry } from '../../types'
import { ArrowUpRight, Trash } from '@phosphor-icons/react'
import { isEmoji } from '../../utils/emoji'
import { entryStatusTitle } from './shared'
import { StatusSuffix } from './LinkButton'

export interface BacklinkItem {
  entry: VaultEntry
  context: string | null
}

function BacklinkEntry({ entry, context, onNavigate }: {
  entry: VaultEntry
  context: string | null
  onNavigate: (target: string) => void
}) {
  const isDimmed = entry.archived || entry.trashed
  return (
    <button
      className="flex w-full cursor-pointer flex-col items-start gap-0.5 border-none bg-transparent p-0 text-left hover:underline"
      onClick={() => onNavigate(entry.title)}
      title={entryStatusTitle(entry)}
    >
      <span
        className="flex items-center gap-1 text-xs text-primary"
        style={isDimmed ? { color: 'var(--muted-foreground)' } : undefined}
      >
        {entry.trashed && <Trash size={12} className="shrink-0" />}
        {entry.icon && isEmoji(entry.icon) && <span className="shrink-0">{entry.icon}</span>}
        {entry.title}
        <StatusSuffix isArchived={entry.archived} isTrashed={entry.trashed} />
      </span>
      {context && (
        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {context}
        </span>
      )}
    </button>
  )
}

export function BacklinksPanel({ backlinks, onNavigate }: {
  backlinks: BacklinkItem[]
  onNavigate: (target: string) => void
}) {
  if (backlinks.length === 0) return null

  return (
    <div>
      <h4 className="font-mono-overline mb-2 flex items-center gap-1 text-muted-foreground">
        <ArrowUpRight size={12} className="shrink-0" />
        Backlinks
      </h4>
      <div className="flex flex-col gap-1.5" data-testid="backlinks-list">
        {backlinks.map(({ entry, context }) => (
          <BacklinkEntry
            key={entry.path}
            entry={entry}
            context={context}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}
