import { useDroppable } from '@dnd-kit/core'
import { Plus } from '@phosphor-icons/react'
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { type AppLocale, translate } from '../../../lib/i18n'
import { type DayKey, dayOfMonth, fullDayLabel, isWeekend, monthDayLabel, weekdayLabels } from './calendarDates'
import { type CalendarItem, type CalendarSegment, itemsOnDay, layoutWeek, weekSegments } from './calendarModel'
import { CalendarItemButton, type CalendarItemContext } from './CalendarItem'
import { DAY_HEADER_PX, LANE_GAP_PX, lanesThatFit } from './calendarLanes'
import { dayDropId } from './useCalendarDrag'


export interface CalendarGridState {
  today: DayKey
  /** Any day in the month being shown; days outside it are muted. */
  anchor: DayKey
  monthView: boolean
  selectedNotePath?: string | null
  droppedPath: string | null
  /** Days the dragged note would cover if dropped now. */
  preview: { start: DayKey; end: DayKey } | null
  canCreate: boolean
  onCreate: (day: DayKey) => void
}

interface CalendarGridProps {
  weeks: DayKey[][]
  items: CalendarItem[]
  context: CalendarItemContext
  state: CalendarGridState
  laneHeight: number
  locale: AppLocale
}

function useElementHeight() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}

function inRange(day: DayKey, range: CalendarGridState['preview']): boolean {
  return range !== null && day >= range.start && day <= range.end
}

interface DayCellProps {
  day: DayKey
  state: CalendarGridState
  locale: AppLocale
}

function DayNumber({ day, state, locale }: DayCellProps) {
  const isToday = day === state.today
  const label = state.monthView && dayOfMonth(day) === 1 ? monthDayLabel(day, locale) : String(dayOfMonth(day))
  return (
    <span className={cn('calendar-day__number', isToday && 'calendar-day__number--today')} aria-current={isToday ? 'date' : undefined}>
      {label}
    </span>
  )
}

function CreateOnDayButton({ day, state, locale }: DayCellProps) {
  if (!state.canCreate) return null
  const label = translate(locale, 'calendar.addOnDay', { date: fullDayLabel(day, locale) })
  return (
    <Button type="button" variant="ghost" size="icon-xs" className="calendar-day__add !h-5 !w-5 !min-w-0 !rounded !p-0 text-muted-foreground hover:!bg-accent hover:!text-foreground [&_svg]:!size-3.5" title={label} aria-label={label} onClick={() => state.onCreate(day)} data-testid="calendar-day-add">
      <Plus size={14} />
    </Button>
  )
}

const DayCell = memo(function DayCell({ day, state, locale }: DayCellProps) {
  const { setNodeRef } = useDroppable({ id: dayDropId(day) })
  const outside = state.monthView && day.slice(0, 7) !== state.anchor.slice(0, 7)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'calendar-day',
        isWeekend(day) && 'calendar-day--weekend',
        outside && 'calendar-day--outside',
        inRange(day, state.preview) && 'calendar-day--target',
      )}
      data-day={day}
      data-testid="calendar-day"
    >
      <div className="calendar-day__header">
        <DayNumber day={day} state={state} locale={locale} />
        <CreateOnDayButton day={day} state={state} locale={locale} />
      </div>
    </div>
  )
})

interface MoreButtonProps {
  day: DayKey
  count: number
  items: CalendarItem[]
  context: CalendarItemContext
  locale: AppLocale
  style: CSSProperties
  selectedNotePath?: string | null
}

function MoreOnDay({ day, count, items, context, locale, style, selectedNotePath }: MoreButtonProps) {
  const [open, setOpen] = useState(false)
  const dayItems = useMemo(() => itemsOnDay(items, day), [day, items])
  const popoverContext = useMemo<CalendarItemContext>(() => ({
    ...context,
    draggable: false,
    onOpen: (entry, event) => {
      setOpen(false)
      context.onOpen(entry, event)
    },
  }), [context])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="calendar-more !h-5 justify-start rounded px-1.5 text-[11px] font-medium text-muted-foreground hover:!bg-accent hover:!text-foreground" style={style} data-testid="calendar-more">
          {translate(locale, 'calendar.more', { count })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="calendar-more-popover w-64 p-2" data-testid="calendar-more-popover">
        <p className="m-0 mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{fullDayLabel(day, locale)}</p>
        <div className="calendar-scroll flex max-h-72 flex-col gap-1 overflow-y-auto">
          {dayItems.map((item) => (
            <div key={item.entry.path} className="h-auto min-h-6">
              <CalendarItemButton dragId={`calendar-more:${day}:${item.entry.path}`} item={item} context={popoverContext} selected={item.entry.path === selectedNotePath} justDropped={false} />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function segmentStyle(segment: CalendarSegment): CSSProperties {
  return { gridColumn: `${segment.startColumn + 1} / span ${segment.span}`, gridRow: segment.lane + 1 }
}

interface WeekRowProps extends Omit<CalendarGridProps, 'weeks'> {
  week: DayKey[]
  maxLanes: number
}

const WeekRow = memo(function WeekRow({ week, items, context, state, laneHeight, locale, maxLanes }: WeekRowProps) {
  const segments = useMemo(() => weekSegments(items, week), [items, week])
  const { visible, hiddenCounts } = useMemo(() => layoutWeek(segments, week.length, maxLanes), [maxLanes, segments, week.length])
  const lanes = { gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))`, gridAutoRows: `${laneHeight}px`, rowGap: LANE_GAP_PX, top: DAY_HEADER_PX } as CSSProperties
  return (
    <div className="calendar-week" data-testid="calendar-week">
      <div className="calendar-week__days" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
        {week.map((day) => <DayCell key={day} day={day} state={state} locale={locale} />)}
      </div>
      <div className="calendar-week__lanes" style={lanes}>
        {visible.map((segment) => (
          <CalendarItemButton
            key={segment.item.entry.path}
            dragId={`calendar-item:${week[0]}:${segment.item.entry.path}`}
            item={segment.item}
            context={context}
            selected={segment.item.entry.path === state.selectedNotePath}
            justDropped={segment.item.entry.path === state.droppedPath}
            style={segmentStyle(segment)}
            continuesBefore={segment.continuesBefore}
            continuesAfter={segment.continuesAfter}
          />
        ))}
        {hiddenCounts.map((count, column) => count > 0 && (
          <MoreOnDay key={week[column]} day={week[column]} count={count} items={items} context={context} locale={locale} style={{ gridColumn: column + 1, gridRow: maxLanes }} selectedNotePath={state.selectedNotePath} />
        ))}
      </div>
    </div>
  )
})

export function CalendarGrid({ weeks, items, context, state, laneHeight, locale }: CalendarGridProps) {
  const [gridRef, gridHeight] = useElementHeight()
  const maxLanes = lanesThatFit(gridHeight, weeks.length, laneHeight)
  const labels = useMemo(() => weekdayLabels(weeks[0], locale), [locale, weeks])
  return (
    <div className="calendar-grid flex min-h-0 flex-1 flex-col" data-view={state.monthView ? 'month' : 'week'}>
      <div className="calendar-weekdays" style={{ gridTemplateColumns: `repeat(${weeks[0].length}, minmax(0, 1fr))` }}>
        {weeks[0].map((day, index) => (
          <span key={day} className={cn('calendar-weekday', isWeekend(day) && 'calendar-weekday--weekend')}>
            {labels[index]}
          </span>
        ))}
      </div>
      <div ref={gridRef} className="calendar-weeks" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week) => (
          <WeekRow key={week[0]} week={week} items={items} context={context} state={state} laneHeight={laneHeight} locale={locale} maxLanes={maxLanes} />
        ))}
      </div>
    </div>
  )
}
