import { useMemo, type ComponentType, type SVGAttributes } from 'react'
import type { VaultEntry, NoteStatus } from '../types'
import { cn } from '@/lib/utils'
import {
  Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, FileText, StackSimple,
  File, FileDashed,
} from '@phosphor-icons/react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { resolveIcon } from '../utils/iconRegistry'
import { relativeDate, getDisplayDate } from '../utils/noteListHelpers'
import { isEmoji } from '../utils/emoji'

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

function StatusDot({ noteStatus }: { noteStatus: NoteStatus }) {
  const dot = NOTE_STATUS_DOT[noteStatus]
  if (!dot) return null
  return (
    <span
      className={`mr-1.5 inline-block align-middle${noteStatus === 'pendingSave' ? ' tab-status-pulse' : ''}`}
      style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, verticalAlign: 'middle' }}
      data-testid={dot.testId}
      title={dot.title}
    />
  )
}

function StateBadge({ archived, trashed }: { archived: boolean; trashed: boolean }) {
  if (archived) {
    return (
      <span className="ml-1.5 inline-block align-middle text-muted-foreground" style={{ fontSize: 9, fontWeight: 500, background: 'var(--muted)', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' }}>
        ARCHIVED
      </span>
    )
  }
  if (trashed) {
    return (
      <span className="ml-1.5 inline-block align-middle" style={{ fontSize: 9, fontWeight: 500, background: 'var(--destructive-light, #ef44441a)', color: 'var(--destructive)', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' }}>
        TRASHED
      </span>
    )
  }
  return null
}

function noteItemStyle(isSelected: boolean, isMultiSelected: boolean, typeColor: string, typeLightColor: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: isSelected && !isMultiSelected ? '14px 16px 14px 13px' : '14px 16px' }
  if (isMultiSelected) base.backgroundColor = 'color-mix(in srgb, var(--accent-blue) 10%, transparent)'
  else if (isSelected) { base.borderLeftColor = typeColor; base.backgroundColor = typeLightColor }
  return base
}

function getFileKindIcon(fileKind: string | undefined): ComponentType<SVGAttributes<SVGSVGElement>> {
  if (fileKind === 'text') return File
  if (fileKind === 'binary') return FileDashed
  return FileText
}

export function NoteItem({ entry, isSelected, isMultiSelected = false, isHighlighted = false, noteStatus = 'clean', typeEntryMap, onClickNote, onPrefetch }: {
  entry: VaultEntry
  isSelected: boolean
  isMultiSelected?: boolean
  isHighlighted?: boolean
  noteStatus?: NoteStatus
  typeEntryMap: Record<string, VaultEntry>
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
  onPrefetch?: (path: string) => void
}) {
  const isBinary = entry.fileKind === 'binary'
  const isNonMarkdown = !!entry.fileKind && entry.fileKind !== 'markdown'
  const te = typeEntryMap[entry.isA ?? '']
  const typeColor = isBinary ? 'var(--muted-foreground)' : getTypeColor(entry.isA ?? 'Note', te?.color)
  const typeLightColor = getTypeLightColor(entry.isA ?? 'Note', te?.color)
  const TypeIcon = useMemo(() => {
    if (isNonMarkdown) return getFileKindIcon(entry.fileKind)
    return getTypeIcon(entry.isA, te?.icon)
  }, [entry.isA, te?.icon, entry.fileKind, isNonMarkdown])

  const handleClick = isBinary
    ? (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }
    : (e: React.MouseEvent) => onClickNote(entry, e)

  return (
    <div
      className={cn(
        "relative border-b border-[var(--border)] transition-colors",
        isBinary ? "cursor-default opacity-50" : "cursor-pointer",
        isSelected && !isMultiSelected && !isBinary && "border-l-[3px]",
        !isSelected && !isMultiSelected && !isBinary && "hover:bg-muted",
        isHighlighted && !isSelected && !isMultiSelected && !isBinary && "bg-muted"
      )}
      style={isBinary ? { padding: '14px 16px' } : noteItemStyle(isSelected, isMultiSelected, typeColor, typeLightColor)}
      onClick={handleClick}
      onMouseEnter={!isBinary && onPrefetch ? () => onPrefetch(entry.path) : undefined}
      data-testid={isMultiSelected ? 'multi-selected-item' : isBinary ? 'binary-file-item' : undefined}
      data-highlighted={isHighlighted || undefined}
      title={isBinary ? 'Cannot open this file type' : undefined}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- icon lookup from static map, no internal state */}
      <TypeIcon width={14} height={14} className="absolute right-3 top-2.5" style={{ color: typeColor }} data-testid="type-icon" />
      <div className="pr-5">
        <div className={cn("truncate text-[13px]", isBinary ? "text-muted-foreground" : "text-foreground", isSelected && !isBinary ? "font-semibold" : "font-medium")}>
          {noteStatus !== 'clean' && !isBinary && <StatusDot noteStatus={noteStatus} />}
          {entry.icon && isEmoji(entry.icon) && <span className="mr-1">{entry.icon}</span>}
          {entry.title}
          {!isBinary && <StateBadge archived={entry.archived} trashed={entry.trashed} />}
        </div>
      </div>
      {entry.snippet && !isBinary && (
        <div className="mt-0.5 text-[12px] leading-[1.5] text-muted-foreground" data-testid="note-snippet" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.snippet}
        </div>
      )}
      {!isBinary && (entry.trashed && entry.trashedAt
        ? <TrashDateLine entry={entry} />
        : <div className="mt-0.5 text-[10px] text-muted-foreground">{relativeDate(getDisplayDate(entry))}</div>
      )}
    </div>
  )
}
