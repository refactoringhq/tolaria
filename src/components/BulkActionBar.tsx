import { memo } from 'react'
import { Archive, ArrowCounterClockwise, CheckCircle, Trash, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { t } from '../lib/i18n'

interface BulkActionBarProps {
  count: number
  isArchivedView?: boolean
  onOrganize?: () => void
  onArchive: () => void
  onDelete: () => void
  onUnarchive?: () => void
  onClear: () => void
}

interface BulkActionButtonProps {
  ariaLabel: string
  children: React.ReactNode
  destructive?: boolean
  onClick?: () => void
  testId: string
}

function BulkActionButton({ ariaLabel, children, destructive = false, onClick, testId }: BulkActionButtonProps) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={destructive ? 'destructive' : 'ghost'}
      className={
        destructive
          ? 'h-8 w-8 rounded-lg bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30'
          : 'h-8 w-8 rounded-lg bg-white/10 text-background hover:bg-white/20 focus-visible:ring-white/35 disabled:bg-white/5 disabled:text-white/35'
      }
      onClick={onClick}
      disabled={!onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}

function renderPrimaryActions(
  isArchivedView: boolean,
  onOrganize: (() => void) | undefined,
  onArchive: () => void,
  onDelete: () => void,
  onUnarchive: (() => void) | undefined,
) {
  const archiveLabel = isArchivedView ? t('Unarchive selected notes') : t('Archive selected notes')
  const archiveIcon = isArchivedView ? <ArrowCounterClockwise size={16} /> : <Archive size={16} />
  const archiveHandler = isArchivedView ? onUnarchive : onArchive

  return (
    <>
      <BulkActionButton ariaLabel={t('Organize selected notes')} onClick={onOrganize} testId="bulk-organize-btn">
        <CheckCircle size={16} weight="fill" />
      </BulkActionButton>
      <BulkActionButton ariaLabel={archiveLabel} onClick={archiveHandler} testId={isArchivedView ? 'bulk-unarchive-btn' : 'bulk-archive-btn'}>
        {archiveIcon}
      </BulkActionButton>
      <BulkActionButton ariaLabel={t('Permanently delete selected notes')} destructive onClick={onDelete} testId="bulk-delete-btn">
        <Trash size={16} />
      </BulkActionButton>
    </>
  )
}

function BulkActionBarInner({ count, isArchivedView, onOrganize, onArchive, onDelete, onUnarchive, onClear }: BulkActionBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        height: 44,
        padding: '0 12px',
        background: 'var(--foreground)',
        color: 'var(--background)',
      }}
      data-testid="bulk-action-bar"
    >
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        {t('{count} selected', { count })}
      </span>
      <div className="flex items-center gap-1.5">
        {renderPrimaryActions(Boolean(isArchivedView), onOrganize, onArchive, onDelete, onUnarchive)}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8 rounded-lg text-white/55 hover:bg-white/10 hover:text-background focus-visible:ring-white/30"
          onClick={onClear}
          aria-label={t('Clear selection')}
          title={t('Clear selection')}
          data-testid="bulk-clear-btn"
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  )
}

export const BulkActionBar = memo(BulkActionBarInner)
