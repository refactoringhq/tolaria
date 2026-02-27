import { useMemo, type ComponentType, type SVGAttributes } from 'react'
import type { VaultEntry, NoteStatus } from '../types'
import { cn } from '@/lib/utils'
import {
  Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, FileText, StackSimple,
} from '@phosphor-icons/react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { resolveIcon } from '../utils/iconRegistry'
import { relativeDate, formatSubtitle } from '../utils/noteListHelpers'

const TYPE_ICON_MAP: Record<string, ComponentType<SVGAttributes<SVGSVGElement>>> = {
  Project: Wrench,
  Experiment: Flask,
  Responsibility: Target,
  Procedure: ArrowsClockwise,
  Person: Users,
  Event: CalendarBlank,
  Topic: Tag,
  Type: StackSimple,
}

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function getTypeIcon(isA: string | null, customIcon?: string | null): ComponentType<SVGAttributes<SVGSVGElement>> {
  if (customIcon) return resolveIcon(customIcon)
  return (isA && TYPE_ICON_MAP[isA]) || FileText
}

const THIRTY_DAYS_SECS = 86400 * 30

function TrashDateLine({ entry }: { entry: VaultEntry }) {
  const { isExpired, suffix } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- Date.now() intentionally memoized on trashedAt
    const trashedAge = entry.trashedAt ? (Date.now() / 1000 - entry.trashedAt) : 0
    const expired = trashedAge >= THIRTY_DAYS_SECS
    return {
      isExpired: expired,
      suffix: expired ? ' — will be permanently deleted' : '',
    }
  }, [entry.trashedAt])
  const style = isExpired ? { color: 'var(--destructive)', fontWeight: 500 } as const : undefined
  return (
    <div className="mt-0.5 text-[10px] text-muted-foreground" style={style}>
      Trashed {relativeDate(entry.trashedAt)}{suffix}
    </div>
  )
}

const NOTE_STATUS_DOT: Record<string, { color: string; testId: string; title: string }> = {
  pendingSave: { color: 'var(--accent-green)', testId: 'pending-save-indicator', title: 'Saving to disk…' },
  new: { color: 'var(--accent-green)', testId: 'new-indicator', title: 'New (uncommitted)' },
  modified: { color: 'var(--accent-orange)', testId: 'modified-indicator', title: 'Modified (uncommitted)' },
}

export function NoteItem({ entry, isSelected, isMultiSelected = false, noteStatus = 'clean', typeEntryMap, onClickNote }: {
  entry: VaultEntry
  isSelected: boolean
  isMultiSelected?: boolean
  noteStatus?: NoteStatus
  typeEntryMap: Record<string, VaultEntry>
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  const te = typeEntryMap[entry.isA ?? '']
  const typeColor = getTypeColor(entry.isA ?? 'Note', te?.color)
  const typeLightColor = getTypeLightColor(entry.isA ?? 'Note', te?.color)
  const TypeIcon = useMemo(() => getTypeIcon(entry.isA, te?.icon), [entry.isA, te?.icon])

  return (
    <div
      className={cn(
        "relative cursor-pointer border-b border-[var(--border)] transition-colors",
        isSelected && !isMultiSelected && "border-l-[3px]",
        !isSelected && !isMultiSelected && "hover:bg-muted"
      )}
      style={{
        padding: isSelected && !isMultiSelected ? '14px 16px 14px 13px' : '14px 16px',
        ...(isMultiSelected && { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }),
        ...(isSelected && !isMultiSelected && { borderLeftColor: typeColor, backgroundColor: typeLightColor }),
      }}
      onClick={(e: React.MouseEvent) => onClickNote(entry, e)}
      data-testid={isMultiSelected ? 'multi-selected-item' : undefined}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- icon lookup from static map, no internal state */}
      <TypeIcon width={14} height={14} className="absolute right-3 top-2.5" style={{ color: typeColor }} data-testid="type-icon" />
      <div className="pr-5">
        <div className={cn("truncate text-[13px] text-foreground", isSelected ? "font-semibold" : "font-medium")}>
          {noteStatus !== 'clean' && NOTE_STATUS_DOT[noteStatus] && (
            <span
              className={`mr-1.5 inline-block align-middle${noteStatus === 'pendingSave' ? ' tab-status-pulse' : ''}`}
              style={{ width: 6, height: 6, borderRadius: '50%', background: NOTE_STATUS_DOT[noteStatus].color, verticalAlign: 'middle' }}
              data-testid={NOTE_STATUS_DOT[noteStatus].testId}
              title={NOTE_STATUS_DOT[noteStatus].title}
            />
          )}
          {entry.title}
          {entry.archived && (
            <span className="ml-1.5 inline-block align-middle text-muted-foreground" style={{ fontSize: 9, fontWeight: 500, background: 'var(--muted)', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' }}>
              ARCHIVED
            </span>
          )}
          {entry.trashed && (
            <span className="ml-1.5 inline-block align-middle" style={{ fontSize: 9, fontWeight: 500, background: 'var(--destructive-light, #ef44441a)', color: 'var(--destructive)', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' }}>
              TRASHED
            </span>
          )}
        </div>
      </div>
      {entry.trashed && entry.trashedAt
        ? <TrashDateLine entry={entry} />
        : <div className="mt-1 text-[11px] text-muted-foreground">{formatSubtitle(entry)}</div>
      }
    </div>
  )
}
