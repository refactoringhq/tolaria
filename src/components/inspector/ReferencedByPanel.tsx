import { useMemo } from 'react'
import type { VaultEntry } from '../../types'
import { getTypeColor } from '../../utils/typeColors'
import { getTypeIcon } from '../NoteItem'
import { LinkButton } from './LinkButton'

export interface ReferencedByItem {
  entry: VaultEntry
  viaKey: string
}

export function ReferencedByPanel({ items, typeEntryMap, onNavigate }: {
  items: ReferencedByItem[]
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, VaultEntry[]>()
    for (const item of items) {
      const existing = map.get(item.viaKey)
      if (existing) existing.push(item.entry)
      else map.set(item.viaKey, [item.entry])
    }
    return Array.from(map.entries())
  }, [items])

  if (items.length === 0) return null

  return (
    <div className="referenced-by-panel">
      <div className="flex flex-col gap-2.5">
        {grouped.map(([viaKey, groupEntries]) => (
          <div key={viaKey}>
            <span className="mb-1 block font-mono text-muted-foreground" style={{ fontSize: 9, fontWeight: 400, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: 0.7 }}>
              ← {viaKey}
            </span>
            <div className="flex flex-col gap-0.5">
              {groupEntries.map((e) => {
                const te = typeEntryMap[e.isA ?? '']
                return (
                  <LinkButton
                    key={e.path}
                    label={e.title}
                    typeColor={getTypeColor(e.isA, te?.color)}
                    isArchived={e.archived}
                    isTrashed={e.trashed}
                    onClick={() => onNavigate(e.title)}
                    title={e.trashed ? 'Trashed' : e.archived ? 'Archived' : undefined}
                    TypeIcon={getTypeIcon(e.isA, te?.icon)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
