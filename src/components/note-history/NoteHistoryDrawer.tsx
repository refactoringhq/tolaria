import { ArrowCounterClockwise } from '@phosphor-icons/react'
import type { NoteCheckpoint } from '../../../packages/protocol/src/index'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useVaultAccess } from '../../hooks/useVaultAccess'
import { type AppLocale, getLocaleDateLocale, translate, type TranslationKey } from '../../lib/i18n'
import { type DiffRow, diffRows, hasChanges } from '../../lib/noteHistory/lineDiff'
import { hasNoteHistory } from '../../lib/noteHistory/noteHistoryClient'
import { closeNoteHistory, useNoteHistoryPath } from '../../lib/noteHistory/noteHistoryDrawerStore'
import { canWritePath } from '../../lib/sharing/vaultAccess'
import { type CheckpointPreview, type Loaded, type NoteHistoryModel, type RestoreState, useNoteHistory } from './useNoteHistory'

/**
 * The per-note history drawer of the web app (TOL-421): the note's saved versions, newest
 * first; the one picked compared with the note now; and restoring it, which saves it as a new
 * version so nothing after it is lost. Viewers see the history but cannot restore.
 */

interface LocaleProps {
  locale: AppLocale
}

const ROW_CLASS: Record<DiffRow['kind'], string> = {
  same: 'text-secondary-foreground',
  added: 'bg-[var(--diff-added-bg)] text-[var(--diff-added-text)]',
  removed: 'bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)]',
  skipped: 'bg-muted text-muted-foreground italic',
}
const ROW_MARK: Record<DiffRow['kind'], string> = { same: ' ', added: '+', removed: '-', skipped: '⋯' }

const RESTORE_MESSAGE: Partial<Record<RestoreState, TranslationKey>> = {
  restored: 'noteHistory.restored',
  unchanged: 'noteHistory.unchanged',
  failed: 'noteHistory.restoreFailed',
}

function noteName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '')
}

function checkpointTime(time: string, locale: AppLocale): string {
  const format = new Intl.DateTimeFormat(getLocaleDateLocale(locale), { dateStyle: 'medium', timeStyle: 'medium' })
  return format.format(new Date(time))
}

function StatusText({ children }: { children: string }) {
  return <p className="px-4 py-6 text-sm text-muted-foreground">{children}</p>
}

function CheckpointRow({ checkpoint, latest, selected, locale, onSelect }: LocaleProps & {
  checkpoint: NoteCheckpoint
  latest: boolean
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        data-testid="note-history-checkpoint"
        aria-pressed={selected}
        onClick={() => onSelect(checkpoint.id)}
        className={cn(
          'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
          selected && 'bg-accent',
        )}
      >
        <span className="flex items-center gap-2 font-medium text-foreground">
          {checkpointTime(checkpoint.time, locale)}
          {latest && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{translate(locale, 'noteHistory.latest')}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{translate(locale, 'noteHistory.byAuthor', { author: checkpoint.author })}</span>
      </button>
    </li>
  )
}

function CheckpointList({ model, locale }: LocaleProps & { model: NoteHistoryModel }) {
  const { checkpoints } = model
  if (checkpoints.status === 'loading') return <StatusText>{translate(locale, 'noteHistory.loading')}</StatusText>
  if (checkpoints.status === 'failed') return <StatusText>{translate(locale, 'noteHistory.loadFailed')}</StatusText>
  if (checkpoints.value.length === 0) return <StatusText>{translate(locale, 'noteHistory.empty')}</StatusText>
  return (
    <ul className="flex flex-col gap-1 p-2" data-testid="note-history-list">
      {checkpoints.value.map((checkpoint, index) => (
        <CheckpointRow
          key={checkpoint.id}
          checkpoint={checkpoint}
          latest={index === 0}
          selected={checkpoint.id === model.selectedId}
          locale={locale}
          onSelect={model.select}
        />
      ))}
    </ul>
  )
}

function DiffRowLine({ row, locale }: LocaleProps & { row: DiffRow }) {
  const text = row.kind === 'skipped' ? translate(locale, 'noteHistory.unchangedLines', { count: row.count }) : row.text
  return (
    <div className={cn('flex min-h-[22px] px-3', ROW_CLASS[row.kind])} data-diff-kind={row.kind}>
      <span aria-hidden="true" className="w-4 shrink-0 select-none text-muted-foreground">{ROW_MARK[row.kind]}</span>
      <span className="flex-1 whitespace-pre-wrap break-words">{text || ' '}</span>
    </div>
  )
}

function DiffLegend({ locale }: LocaleProps) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span><span className="rounded bg-[var(--diff-removed-bg)] px-1 text-[var(--diff-removed-text)]">-</span> {translate(locale, 'noteHistory.legendRemoved')}</span>
      <span><span className="rounded bg-[var(--diff-added-bg)] px-1 text-[var(--diff-added-text)]">+</span> {translate(locale, 'noteHistory.legendAdded')}</span>
    </div>
  )
}

function DiffPreview({ preview, locale }: LocaleProps & { preview: CheckpointPreview }) {
  if (!preview.diff) return <StatusText>{translate(locale, 'noteHistory.tooLarge')}</StatusText>
  if (!hasChanges(preview.diff)) return <StatusText>{translate(locale, 'noteHistory.sameAsNow')}</StatusText>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
      <h3 className="text-sm font-medium">{translate(locale, 'noteHistory.previewHeading')}</h3>
      <DiffLegend locale={locale} />
      <div className="min-h-0 flex-1 overflow-auto rounded-md border py-2 font-mono text-[13px] leading-relaxed" data-testid="note-history-diff">
        {diffRows(preview.diff).map((row, index) => <DiffRowLine key={index} row={row} locale={locale} />)}
      </div>
    </div>
  )
}

function PreviewBody({ preview, locale }: LocaleProps & { preview: Loaded<CheckpointPreview> | null }) {
  if (!preview) return <StatusText>{translate(locale, 'noteHistory.pickVersion')}</StatusText>
  if (preview.status === 'loading') return <StatusText>{translate(locale, 'noteHistory.previewLoading')}</StatusText>
  if (preview.status === 'failed') return <StatusText>{translate(locale, 'noteHistory.previewFailed')}</StatusText>
  return <DiffPreview preview={preview.value} locale={locale} />
}

function RestoreFooter({ model, canRestore, locale }: LocaleProps & { model: NoteHistoryModel; canRestore: boolean }) {
  if (!model.selectedId) return null
  const message = RESTORE_MESSAGE[model.restoreState]
  const restoring = model.restoreState === 'restoring'
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3">
      {message && <p role="status" className="mr-auto text-sm text-muted-foreground" data-testid="note-history-restore-status">{translate(locale, message)}</p>}
      {canRestore
        ? (
          <Button type="button" onClick={model.restore} disabled={restoring || model.preview?.status !== 'ready'} data-testid="note-history-restore">
            <ArrowCounterClockwise />
            {translate(locale, restoring ? 'noteHistory.restoring' : 'noteHistory.restore')}
          </Button>
        )
        : <p className="text-sm text-muted-foreground" data-testid="note-history-view-only">{translate(locale, 'noteHistory.viewOnly')}</p>}
    </div>
  )
}

function NoteHistoryPanel({ path, locale }: LocaleProps & { path: string }) {
  const model = useNoteHistory(path)
  const canRestore = canWritePath(useVaultAccess(), path)
  return (
    <>
      <DialogHeader className="border-b px-4 py-3 pr-12">
        <DialogTitle>{translate(locale, 'noteHistory.title')}</DialogTitle>
        <DialogDescription>{translate(locale, 'noteHistory.description', { note: noteName(path) })}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="max-h-[35vh] shrink-0 overflow-auto border-b md:max-h-none md:w-64 md:border-r md:border-b-0">
          <CheckpointList model={model} locale={locale} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewBody preview={model.preview} locale={locale} />
          <RestoreFooter model={model} canRestore={canRestore} locale={locale} />
        </div>
      </div>
    </>
  )
}

/** The history drawer of the note at `notePath`, open while `openNoteHistory` names that note. */
export function NoteHistoryDrawer({ notePath, locale }: LocaleProps & { notePath: string }) {
  const open = useNoteHistoryPath() === notePath
  if (!hasNoteHistory()) return null
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeNoteHistory() }}>
      <DialogContent
        data-testid="note-history-drawer"
        className="top-0 right-0 left-auto flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-r-0 p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-[min(56rem,100vw)]"
      >
        {open && <NoteHistoryPanel path={notePath} locale={locale} />}
      </DialogContent>
    </Dialog>
  )
}
