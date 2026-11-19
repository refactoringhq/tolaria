import { useDraggable } from '@dnd-kit/core'
import { X } from '@phosphor-icons/react'
import { memo, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AppLocale, translate } from '../../../lib/i18n'
import type { VaultEntry } from '../../../types'
import { type CalendarItem, entryDateValue } from './calendarModel'
import { CalendarItemFace, type CalendarItemContext } from './CalendarItem'

interface CalendarTrayProps {
  unscheduled: VaultEntry[]
  invalid: VaultEntry[]
  dateProperty: string
  context: CalendarItemContext
  locale: AppLocale
  selectedNotePath?: string | null
  onClose: () => void
}

/** A tray note has no day yet; dropping it on one gives it that day. */
function trayItem(entry: VaultEntry): CalendarItem {
  return { entry, start: '', end: '' }
}

interface TrayNoteProps {
  entry: VaultEntry
  context: CalendarItemContext
  selected: boolean
  hint?: string
}

const TrayNote = memo(function TrayNote({ entry, context, selected, hint }: TrayNoteProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `calendar-tray:${entry.path}`,
    data: { item: trayItem(entry), fromTray: true },
    disabled: !context.draggable,
  })
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="ghost"
      {...attributes}
      {...listeners}
      aria-roledescription={context.itemRole}
      aria-label={entry.title}
      className={cn('calendar-item-slot calendar-tray__note block h-auto w-full whitespace-normal rounded-md p-0 text-left font-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring [&_svg]:!size-[11px]', isDragging && 'calendar-item-slot--placeholder')}
      onClick={(event) => context.onOpen(entry, event)}
      data-testid="calendar-tray-note"
      data-selected={selected ? 'true' : undefined}
    >
      <CalendarItemFace entry={entry} context={context} className={cn('min-h-7 py-1', selected && 'calendar-item--selected')} />
      {hint && <span className="block truncate px-2 pb-1 text-[11px] text-muted-foreground" data-testid="calendar-tray-hint">{hint}</span>}
    </Button>
  )
})

function invalidHint(entry: VaultEntry, dateProperty: string, locale: AppLocale): string {
  return translate(locale, 'calendar.tray.invalid', { value: String(entryDateValue(entry, dateProperty)) })
}

interface TrayRow {
  entry: VaultEntry
  hint?: string
}

function trayRows({ unscheduled, invalid, dateProperty, locale }: Pick<CalendarTrayProps, 'unscheduled' | 'invalid' | 'dateProperty' | 'locale'>): TrayRow[] {
  return [
    ...unscheduled.map((entry) => ({ entry })),
    ...invalid.map((entry) => ({ entry, hint: invalidHint(entry, dateProperty, locale) })),
  ]
}

/** Notes the calendar cannot place: no date yet, or a value that is not a date. Never silently dropped. */
export function CalendarTray({ unscheduled, invalid, dateProperty, context, locale, selectedNotePath, onClose }: CalendarTrayProps) {
  const rows = useMemo(() => trayRows({ unscheduled, invalid, dateProperty, locale }), [dateProperty, invalid, locale, unscheduled])
  const count = rows.length
  const closeLabel = translate(locale, 'calendar.tray.close')
  return (
    <aside className="calendar-tray flex w-60 shrink-0 flex-col" aria-label={translate(locale, 'calendar.tray.title')} data-testid="calendar-tray">
      <div className="flex h-9 shrink-0 items-center gap-2 pl-3 pr-1.5">
        <span className="flex-1 text-[13px] font-semibold text-foreground">{translate(locale, 'calendar.tray.title')}</span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground" data-testid="calendar-tray-count">{count}</span>
        <Button type="button" variant="ghost" size="icon-xs" className="!h-6 !w-6 !min-w-0 !p-0 text-muted-foreground hover:!bg-accent hover:!text-foreground [&_svg]:!size-3.5" title={closeLabel} aria-label={closeLabel} onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
      <p className="m-0 px-3 pb-2 text-[11px] text-muted-foreground">
        {translate(locale, count > 0 ? 'calendar.tray.dragHint' : 'calendar.tray.empty')}
      </p>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <Virtuoso
          data={rows}
          className="calendar-scroll"
          style={{ height: '100%' }}
          computeItemKey={(_, row) => row.entry.path}
          itemContent={(_, row) => (
            <div className="pb-1.5">
              <TrayNote entry={row.entry} context={context} selected={row.entry.path === selectedNotePath} hint={row.hint} />
            </div>
          )}
        />
      </div>
    </aside>
  )
}
