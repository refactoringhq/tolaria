import { CaretLeft, CaretRight, Tray } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { CalendarViewMode } from '../../../collections/collectionTypes'
import { type AppLocale, translate } from '../../../lib/i18n'
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME } from '../NoteListHeader'
import type { CalendarNavigation } from './useCalendarShortcuts'

interface CalendarToolbarProps {
  title: string
  view: CalendarViewMode
  locale: AppLocale
  navigation: CalendarNavigation
  trayCount: number
  trayOpen: boolean
  onToggleTray: () => void
}

function navigationLabels(view: CalendarViewMode, locale: AppLocale) {
  const week = view === 'week'
  return {
    previous: translate(locale, week ? 'calendar.previousWeek' : 'calendar.previousMonth'),
    next: translate(locale, week ? 'calendar.nextWeek' : 'calendar.nextMonth'),
  }
}

function withShortcut(label: string, key: string): string {
  return `${label} (${key})`
}

export function CalendarToolbar({ title, view, locale, navigation, trayCount, trayOpen, onToggleTray }: CalendarToolbarProps) {
  const labels = navigationLabels(view, locale)
  const trayLabel = translate(locale, 'calendar.tray.toggle', { count: trayCount })
  return (
    <div className="calendar-toolbar flex h-11 shrink-0 items-center gap-2 px-3" data-testid="calendar-toolbar">
      <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground" aria-live="polite" data-testid="calendar-title">{title}</h2>
      <Button type="button" variant="outline" size="xs" className="h-6 px-2 text-xs" title={withShortcut(translate(locale, 'calendar.todayHint'), 'T')} onClick={navigation.today} data-testid="calendar-today">
        {translate(locale, 'calendar.today')}
      </Button>
      <div className="flex items-center gap-0.5">
        <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} title={withShortcut(labels.previous, '←')} aria-label={labels.previous} onClick={navigation.previous} data-testid="calendar-previous">
          <CaretLeft size={16} />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} title={withShortcut(labels.next, '→')} aria-label={labels.next} onClick={navigation.next} data-testid="calendar-next">
          <CaretRight size={16} />
        </Button>
      </div>
      <Tabs value={view} onValueChange={(value) => navigation.setView(value === 'week' ? 'week' : 'month')} className="gap-0">
        <TabsList className="!h-7 p-0.5" aria-label={translate(locale, 'calendar.viewLabel')}>
          <TabsTrigger value="month" className="h-6 px-2.5 text-xs" title={withShortcut(translate(locale, 'calendar.month'), 'M')} data-testid="calendar-view-month">{translate(locale, 'calendar.month')}</TabsTrigger>
          <TabsTrigger value="week" className="h-6 px-2.5 text-xs" title={withShortcut(translate(locale, 'calendar.week'), 'W')} data-testid="calendar-view-week">{translate(locale, 'calendar.week')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn('h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:!bg-accent hover:!text-foreground', trayOpen && '!bg-accent !text-foreground')}
        title={trayLabel}
        aria-label={trayLabel}
        aria-pressed={trayOpen}
        onClick={onToggleTray}
        data-testid="calendar-tray-toggle"
      >
        <Tray size={16} />
        <span className="tabular-nums">{trayCount}</span>
      </Button>
    </div>
  )
}
