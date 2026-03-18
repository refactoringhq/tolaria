import { useState } from 'react'
import type { VaultEntry } from '../../types'
import { CaretRight, Trash } from '@phosphor-icons/react'
import { getTypeColor } from '../../utils/typeColors'
import { isEmoji } from '../../utils/emoji'
import { entryStatusTitle } from './shared'
import { StatusSuffix } from './LinkButton'

export interface BacklinkItem {
  entry: VaultEntry
  context: string | null
}

function BacklinkEntry({ entry, context, typeEntryMap, onNavigate }: {
  entry: VaultEntry
  context: string | null
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const te = typeEntryMap[entry.isA ?? '']
  const isDimmed = entry.archived || entry.trashed
  return (
    <button
      className="flex w-full cursor-pointer flex-col items-start gap-0.5 border-none bg-transparent p-0 text-left hover:opacity-80"
      onClick={() => onNavigate(entry.title)}
      title={entryStatusTitle(entry)}
    >
      <span
        className="flex items-center gap-1 text-xs font-medium"
        style={{ color: isDimmed ? 'var(--muted-foreground)' : getTypeColor(entry.isA, te?.color) }}
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

export function BacklinksPanel({ backlinks, typeEntryMap, onNavigate }: {
  backlinks: BacklinkItem[]
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (backlinks.length === 0) return null

  return (
    <div>
      <button
        className="font-mono-overline mb-2 flex w-full cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
        data-testid="backlinks-toggle"
      >
        <CaretRight
          size={12}
          className="shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
        />
        Backlinks ({backlinks.length})
      </button>
      {expanded && (
        <div className="flex flex-col gap-1.5" data-testid="backlinks-list">
          {backlinks.map(({ entry, context }) => (
            <BacklinkEntry
              key={entry.path}
              entry={entry}
              context={context}
              typeEntryMap={typeEntryMap}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
