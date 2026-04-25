import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { NoteTitleIcon } from '../NoteTitleIcon'

type ChangeStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'

type ChangeStatsEntry = VaultEntry & {
  __changeAddedLines?: number | null
  __changeDeletedLines?: number | null
  __changeBinary?: boolean
}

const CHANGE_STATUS_DISPLAY: Record<ChangeStatus, { label: string; color: string; symbol: string }> = {
  modified: { label: 'Modified', color: 'var(--accent-orange)', symbol: '·' },
  added: { label: 'Added', color: 'var(--accent-green)', symbol: '+' },
  untracked: { label: 'Added', color: 'var(--accent-green)', symbol: '+' },
  deleted: { label: 'Deleted', color: 'var(--destructive)', symbol: '−' },
  renamed: { label: 'Renamed', color: 'var(--accent-orange)', symbol: 'R' },
}

function readChangeStats(entry: VaultEntry): Required<Pick<ChangeStatsEntry, '__changeAddedLines' | '__changeDeletedLines' | '__changeBinary'>> {
  const changeEntry = entry as ChangeStatsEntry
  return {
    __changeAddedLines: changeEntry.__changeAddedLines ?? null,
    __changeDeletedLines: changeEntry.__changeDeletedLines ?? null,
    __changeBinary: changeEntry.__changeBinary ?? false,
  }
}

function ChangeStatusIcon({ status }: { status: ChangeStatus }) {
  const display = CHANGE_STATUS_DISPLAY[status]
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

type ChangeStatBadge = {
  className: string
  testId: string
  value: string
}

function hasLineCount(value: number | null): value is number {
  return typeof value === 'number'
}

function shouldShowAddedStat(status: ChangeStatus, addedLines: number | null, deletedLines: number | null): boolean {
  if (!hasLineCount(addedLines)) return false
  if (addedLines > 0) return true
  return (status === 'added' || status === 'untracked') && !deletedLines
}

function shouldShowDeletedStat(status: ChangeStatus, addedLines: number | null, deletedLines: number | null): boolean {
  if (!hasLineCount(deletedLines)) return false
  if (deletedLines > 0) return true
  return status === 'deleted' && !addedLines
}

function buildChangeStatBadges(
  status: ChangeStatus,
  addedLines: number | null,
  deletedLines: number | null,
): ChangeStatBadge[] {
  const badges: ChangeStatBadge[] = []

  if (shouldShowAddedStat(status, addedLines, deletedLines)) {
    badges.push({
      className: 'text-[var(--accent-green)]',
      testId: 'change-stat-added',
      value: `+${addedLines ?? 0}`,
    })
  }

  if (shouldShowDeletedStat(status, addedLines, deletedLines)) {
    badges.push({
      className: 'text-[var(--destructive)]',
      testId: 'change-stat-deleted',
      value: `-${deletedLines ?? 0}`,
    })
  }

  return badges
}

function changeStatsFallback(binary: boolean): string {
  return binary ? 'Binary diff' : 'Diff unavailable'
}

function ChangeStatsRow({ entry, changeStatus }: { entry: VaultEntry; changeStatus: ChangeStatus }) {
  const { __changeAddedLines: addedLines, __changeDeletedLines: deletedLines, __changeBinary: binary } = readChangeStats(entry)
  const badges = buildChangeStatBadges(changeStatus, addedLines, deletedLines)

  if (badges.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground" data-testid="change-stats-row">
        <span data-testid="change-stat-fallback">{changeStatsFallback(binary)}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-[11px] font-medium" data-testid="change-stats-row">
      {badges.map((badge) => (
        <span key={badge.testId} className={badge.className} data-testid={badge.testId}>
          {badge.value}
        </span>
      ))}
    </div>
  )
}

export function ChangeNoteContent({
  entry,
  changeStatus,
  isSelected,
  isDeletedChange,
}: {
  entry: VaultEntry
  changeStatus: ChangeStatus
  isSelected: boolean
  isDeletedChange: boolean
}) {
  return (
    <>
      <ChangeStatusIcon status={changeStatus} />
      <div className="pr-5">
        <div className="space-y-1.5">
          <div
            className={cn(
              'truncate text-[13px]',
              isSelected ? 'font-semibold' : 'font-medium',
              isDeletedChange ? 'text-muted-foreground line-through opacity-70' : 'text-foreground',
            )}
            data-testid="change-note-title"
          >
            <NoteTitleIcon icon={entry.icon} size={15} className="mr-1" testId="change-note-icon" />
            {entry.title}
          </div>
          <div
            className={cn('truncate text-[12px] leading-[1.5] text-muted-foreground', isDeletedChange && 'opacity-70')}
            data-testid="change-note-filename"
            title={entry.filename}
          >
            {entry.filename}
          </div>
          <ChangeStatsRow entry={entry} changeStatus={changeStatus} />
        </div>
      </div>
    </>
  )
}
