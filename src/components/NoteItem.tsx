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
import { wikilinkDisplay } from '../utils/wikilink'

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

function StateBadge({ archived }: { archived: boolean }) {
  if (archived) {
    return (
      <span className="ml-1.5 inline-block align-middle text-muted-foreground" style={{ fontSize: 9, fontWeight: 500, background: 'var(--muted)', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' }}>
        ARCHIVED
      </span>
    )
  }
  return null
}

function formatChipValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value)
  // URL: show only hostname
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) return new URL(s).hostname
  } catch { /* not a URL */ }
  return s.length > 40 ? s.slice(0, 37) + '…' : s
}

function resolveChipValues(entry: VaultEntry, propName: string): string[] {
  // Check relationships first (wikilink values)
  const relKey = Object.keys(entry.relationships).find((k) => k.toLowerCase() === propName.toLowerCase())
  if (relKey) {
    return entry.relationships[relKey].map((ref) => wikilinkDisplay(ref)).filter(Boolean)
  }
  // Check scalar properties
  const propKey = Object.keys(entry.properties).find((k) => k.toLowerCase() === propName.toLowerCase())
  if (!propKey) return []
  const val = entry.properties[propKey]
  if (Array.isArray(val)) return val.map((v) => formatChipValue(v)).filter((v): v is string => v !== null)
  const formatted = formatChipValue(val)
  return formatted ? [formatted] : []
}

function PropertyChips({ entry, displayProps }: { entry: VaultEntry; displayProps: string[] }) {
  const chips = useMemo(() => {
    const result: { key: string; values: string[] }[] = []
    for (const prop of displayProps) {
      const values = resolveChipValues(entry, prop)
      if (values.length > 0) result.push({ key: prop, values })
    }
    return result
  }, [entry, displayProps])

  if (chips.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="property-chips">
      {chips.map(({ key, values }) =>
        values.map((v, i) => (
          <span
            key={`${key}-${i}`}
            className="inline-block max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {v}
          </span>
        ))
      )}
    </div>
  )
}

const CHANGE_STATUS_DISPLAY: Record<string, { label: string; color: string; symbol: string }> = {
  modified: { label: 'Modified', color: 'var(--accent-orange, #f59e0b)', symbol: '·' },
  added: { label: 'Added', color: 'var(--accent-green, #22c55e)', symbol: '+' },
  untracked: { label: 'Added', color: 'var(--accent-green, #22c55e)', symbol: '+' },
  deleted: { label: 'Deleted', color: 'var(--destructive, #ef4444)', symbol: '−' },
  renamed: { label: 'Renamed', color: 'var(--accent-orange, #f59e0b)', symbol: 'R' },
}

function ChangeStatusIcon({ status }: { status: string }) {
  const display = CHANGE_STATUS_DISPLAY[status] ?? CHANGE_STATUS_DISPLAY.modified
  return (
    <span
      className="absolute right-3 top-2.5 text-xs font-bold"
      style={{ color: display.color, fontSize: status === 'modified' ? 18 : 14 }}
      title={display.label}
      data-testid="change-status-icon"
    >
      {display.symbol}
    </span>
  )
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

function resolveDisplayProps(entry: VaultEntry, typeEntryMap: Record<string, VaultEntry>, displayPropsOverride?: string[] | null): string[] {
  if (displayPropsOverride && displayPropsOverride.length > 0) return displayPropsOverride
  return typeEntryMap[entry.isA ?? '']?.listPropertiesDisplay ?? []
}

export function NoteItem({ entry, isSelected, isMultiSelected = false, isHighlighted = false, noteStatus = 'clean', changeStatus, typeEntryMap, displayPropsOverride, onClickNote, onPrefetch, onContextMenu }: {
  entry: VaultEntry
  isSelected: boolean
  isMultiSelected?: boolean
  isHighlighted?: boolean
  noteStatus?: NoteStatus
  /** When set, renders in Changes-view style: filename + change type icon */
  changeStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
  onPrefetch?: (path: string) => void
  onContextMenu?: (entry: VaultEntry, e: React.MouseEvent) => void
}) {
  const isBinary = entry.fileKind === 'binary'
  const isNonMarkdown = !!entry.fileKind && entry.fileKind !== 'markdown'
  const isDeletedChange = changeStatus === 'deleted'
  const te = typeEntryMap[entry.isA ?? '']
  const displayProps = resolveDisplayProps(entry, typeEntryMap, displayPropsOverride)
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
      onContextMenu={onContextMenu ? (e) => onContextMenu(entry, e) : undefined}
      onMouseEnter={!isBinary && onPrefetch ? () => onPrefetch(entry.path) : undefined}
      data-testid={isMultiSelected ? 'multi-selected-item' : isBinary ? 'binary-file-item' : undefined}
      data-highlighted={isHighlighted || undefined}
      data-note-path={entry.path}
      data-change-status={changeStatus}
      title={isBinary ? 'Cannot open this file type' : undefined}
    >
      {changeStatus ? (
        <>
          <ChangeStatusIcon status={changeStatus} />
          <div className="pr-5">
            <div
              className={cn(
                "truncate text-[13px] font-mono",
                isSelected ? "font-semibold" : "font-normal",
                isDeletedChange && "text-muted-foreground line-through opacity-70",
              )}
              style={{ fontSize: 12 }}
            >
              {entry.filename}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line react-hooks/static-components -- icon lookup from static map, no internal state */}
          <TypeIcon width={14} height={14} className="absolute right-3 top-2.5" style={{ color: typeColor }} data-testid="type-icon" />
          <div className="pr-5">
            <div className={cn("truncate text-[13px]", isBinary ? "text-muted-foreground" : "text-foreground", isSelected && !isBinary ? "font-semibold" : "font-medium")}>
              {noteStatus !== 'clean' && !isBinary && <StatusDot noteStatus={noteStatus} />}
              {entry.icon && isEmoji(entry.icon) && <span className="mr-1">{entry.icon}</span>}
              {entry.title}
              {!isBinary && <StateBadge archived={entry.archived} />}
            </div>
          </div>
          {entry.snippet && !isBinary && (
            <div className="mt-0.5 text-[12px] leading-[1.5] text-muted-foreground" data-testid="note-snippet" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {entry.snippet}
            </div>
          )}
          {!isBinary && displayProps.length > 0 && (
            <PropertyChips entry={entry} displayProps={displayProps} />
          )}
          {!isBinary && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">{relativeDate(getDisplayDate(entry))}</div>
          )}
        </>
      )}
    </div>
  )
}
