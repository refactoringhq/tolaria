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
import { NoteTitleIcon } from './NoteTitleIcon'
import { PropertyChips } from './note-item/PropertyChips'

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

function noteItemClassName({
  isBinary,
  isSelected,
  isMultiSelected,
  isHighlighted,
}: {
  isBinary: boolean
  isSelected: boolean
  isMultiSelected: boolean
  isHighlighted: boolean
}) {
  return cn(
    'relative border-b border-[var(--border)] transition-colors',
    isBinary ? 'cursor-default opacity-50' : 'cursor-pointer',
    isSelected && !isMultiSelected && !isBinary && 'border-l-[3px]',
    !isSelected && !isMultiSelected && !isBinary && 'hover:bg-muted',
    isHighlighted && !isSelected && !isMultiSelected && !isBinary && 'bg-muted',
  )
}

function ChangeStatusContent({
  entry,
  changeStatus,
  isSelected,
  isDeletedChange,
}: {
  entry: VaultEntry
  changeStatus: NonNullable<NoteItemProps['changeStatus']>
  isSelected: boolean
  isDeletedChange: boolean
}) {
  return (
    <>
      <ChangeStatusIcon status={changeStatus} />
      <div className="pr-5">
        <div
          className={cn(
            'truncate text-[13px] font-mono',
            isSelected ? 'font-semibold' : 'font-normal',
            isDeletedChange && 'text-muted-foreground line-through opacity-70',
          )}
          style={{ fontSize: 12 }}
        >
          {entry.filename}
        </div>
      </div>
    </>
  )
}

function StandardNoteContent({
  entry,
  isBinary,
  noteStatus,
  isSelected,
  typeColor,
  displayProps,
  allEntries,
  typeEntryMap,
  onClickNote,
}: {
  entry: VaultEntry
  isBinary: boolean
  noteStatus: NoteStatus
  isSelected: boolean
  typeColor: string
  displayProps: string[]
  allEntries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  onClickNote: NoteItemProps['onClickNote']
}) {
  const isNonMarkdown = !!entry.fileKind && entry.fileKind !== 'markdown'
  const te = typeEntryMap[entry.isA ?? '']
  const TypeIcon = useMemo(() => {
    if (isNonMarkdown) return getFileKindIcon(entry.fileKind)
    return getTypeIcon(entry.isA, te?.icon)
  }, [entry.fileKind, entry.isA, isNonMarkdown, te?.icon])

  return (
    <>
      {/* eslint-disable-next-line react-hooks/static-components -- icon lookup from static map, no internal state */}
      <TypeIcon width={14} height={14} className="absolute right-3 top-2.5" style={{ color: typeColor }} data-testid="type-icon" />
      <div className="space-y-2 pr-5" data-testid="note-content-stack">
        <NoteTitleRow
          entry={entry}
          isBinary={isBinary}
          isSelected={isSelected}
          noteStatus={noteStatus}
        />
        {!isBinary && entry.snippet && (
          <div
            className="text-[12px] leading-[1.5] text-muted-foreground"
            data-testid="note-snippet"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {entry.snippet}
          </div>
        )}
        {!isBinary && displayProps.length > 0 && (
          <PropertyChips
            entry={entry}
            displayProps={displayProps}
            allEntries={allEntries}
            typeEntryMap={typeEntryMap}
            onOpenNote={onClickNote}
          />
        )}
        {!isBinary && <NoteDateRow entry={entry} />}
      </div>
    </>
  )
}

function NoteTitleRow({
  entry,
  isBinary,
  isSelected,
  noteStatus,
}: {
  entry: VaultEntry
  isBinary: boolean
  isSelected: boolean
  noteStatus: NoteStatus
}) {
  return (
    <div className={cn('truncate text-[13px]', isBinary ? 'text-muted-foreground' : 'text-foreground', isSelected && !isBinary ? 'font-semibold' : 'font-medium')}>
      {noteStatus !== 'clean' && !isBinary && <StatusDot noteStatus={noteStatus} />}
      <NoteTitleIcon icon={entry.icon} size={15} className="mr-1" testId="note-title-icon" />
      {entry.title}
      {!isBinary && <StateBadge archived={entry.archived} />}
    </div>
  )
}

function NoteDateRow({ entry }: { entry: VaultEntry }) {
  const modifiedLabel = relativeDate(getDisplayDate(entry))
  const createdLabel = entry.createdAt ? `Created ${relativeDate(entry.createdAt)}` : null

  if (!modifiedLabel && !createdLabel) return null

  return (
    <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground" data-testid="note-date-row">
      <span>{modifiedLabel}</span>
      {createdLabel && <span className="shrink-0">{createdLabel}</span>}
    </div>
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

type NoteItemProps = {
  entry: VaultEntry
  isSelected: boolean
  isMultiSelected?: boolean
  isHighlighted?: boolean
  noteStatus?: NoteStatus
  /** When set, renders in Changes-view style: filename + change type icon */
  changeStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'
  typeEntryMap: Record<string, VaultEntry>
  allEntries?: VaultEntry[]
  displayPropsOverride?: string[] | null
  onClickNote: (entry: VaultEntry, e: React.MouseEvent) => void
  onPrefetch?: (path: string) => void
  onContextMenu?: (entry: VaultEntry, e: React.MouseEvent) => void
}

function createNoteItemClickHandler(
  entry: VaultEntry,
  isBinary: boolean,
  onClickNote: NoteItemProps['onClickNote'],
) {
  if (isBinary) {
    return (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  return (event: React.MouseEvent) => onClickNote(entry, event)
}

export function NoteItem({ entry, isSelected, isMultiSelected = false, isHighlighted = false, noteStatus = 'clean', changeStatus, typeEntryMap, allEntries, displayPropsOverride, onClickNote, onPrefetch, onContextMenu }: NoteItemProps) {
  const isBinary = entry.fileKind === 'binary'
  const isDeletedChange = changeStatus === 'deleted'
  const te = typeEntryMap[entry.isA ?? '']
  const displayProps = resolveDisplayProps(entry, typeEntryMap, displayPropsOverride)
  const typeColor = isBinary ? 'var(--muted-foreground)' : getTypeColor(entry.isA ?? 'Note', te?.color)
  const typeLightColor = getTypeLightColor(entry.isA ?? 'Note', te?.color)
  const handleClick = createNoteItemClickHandler(entry, isBinary, onClickNote)

  return (
    <div
      className={noteItemClassName({ isBinary, isSelected, isMultiSelected, isHighlighted })}
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
        <ChangeStatusContent
          entry={entry}
          changeStatus={changeStatus}
          isSelected={isSelected}
          isDeletedChange={isDeletedChange}
        />
      ) : (
        <StandardNoteContent
          entry={entry}
          isBinary={isBinary}
          noteStatus={noteStatus}
          isSelected={isSelected}
          typeColor={typeColor}
          displayProps={displayProps}
          allEntries={allEntries ?? [entry]}
          typeEntryMap={typeEntryMap}
          onClickNote={onClickNote}
        />
      )}
    </div>
  )
}
