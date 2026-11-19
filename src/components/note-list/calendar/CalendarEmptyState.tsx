import { CalendarBlank } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { CalendarLayoutBindings } from '../../../collections/layoutRegistry'
import { type AppLocale, translate } from '../../../lib/i18n'
import { CREATED_DATE_PROPERTY, MODIFIED_DATE_PROPERTY } from './calendarModel'

interface CalendarEmptyStateProps {
  calendar: CalendarLayoutBindings
  locale: AppLocale
  /** The configured property no note has a value for; absent when the list has no date property at all. */
  property?: string
}

function DatePropertyChoices({ calendar, locale, property }: CalendarEmptyStateProps) {
  if (property && property === calendar.settings.endDateProperty) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => calendar.onSettingsChange({ endDateProperty: null })} data-testid="calendar-empty-clear-end">
        {translate(locale, 'calendar.clearEndDate')}
      </Button>
    )
  }
  const choose = (dateProperty: string) => calendar.onSettingsChange({ dateProperty, endDateProperty: null })
  return (
    <>
      {calendar.dateOptions.filter((option) => option !== property).map((option) => (
        <Button key={option} type="button" variant="outline" size="sm" onClick={() => choose(option)} data-testid="calendar-empty-use-property">
          {translate(locale, 'calendar.useProperty', { property: option })}
        </Button>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => choose(CREATED_DATE_PROPERTY)} data-testid="calendar-empty-use-created">
        {translate(locale, 'calendar.useCreated')}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => choose(MODIFIED_DATE_PROPERTY)}>
        {translate(locale, 'calendar.useModified')}
      </Button>
    </>
  )
}

/** Never a blank grid: explains why nothing can be placed and offers the ways forward. */
export function CalendarEmptyState({ calendar, locale, property }: CalendarEmptyStateProps) {
  return (
    <div className="calendar-empty flex min-h-0 flex-1 items-center justify-center p-8" data-testid="calendar-empty">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarBlank size={20} />
        </span>
        <h3 className="m-0 text-[15px] font-semibold text-foreground">{translate(locale, 'calendar.empty.title')}</h3>
        <p className="m-0 text-[13px] text-muted-foreground">
          {property
            ? translate(locale, 'calendar.empty.missingProperty', { property })
            : translate(locale, 'calendar.empty.noDateProperty')}
        </p>
        <p className="m-0 text-xs text-muted-foreground">{translate(locale, 'calendar.empty.addProperty')}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <DatePropertyChoices calendar={calendar} locale={locale} property={property} />
          <Button type="button" variant="ghost" size="sm" onClick={calendar.onUseList} data-testid="calendar-empty-use-list">
            {translate(locale, 'layout.useList')}
          </Button>
        </div>
      </div>
    </div>
  )
}
