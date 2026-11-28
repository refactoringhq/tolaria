import { X as XIcon } from '@phosphor-icons/react'
import { useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppLocale, useDateDisplayFormat } from '../hooks/useAppPreferences'
import { translate, type AppLocale } from '../lib/i18n'
import { trackDatePropertyDirectEntrySaved } from '../lib/productAnalytics'
import { formatDateValue, toISODate } from '../utils/propertyTypes'
import { PROPERTY_CHIP_STYLE } from './propertyChipStyles'

const ISO_DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DEFAULT_DATE_PICKER_START_YEAR = 1800
const DEFAULT_DATE_PICKER_END_YEAR = 2200

interface CalendarDay {
  year: number
  monthIndex: number
  day: number
}

function localDate({ year, monthIndex, day }: CalendarDay): Date {
  const date = new Date(0)
  date.setFullYear(year, monthIndex, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function calendarDayFromMatch(match: RegExpExecArray): CalendarDay {
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) }
}

function dateToISO(day: Date): string {
  const yyyy = String(day.getFullYear()).padStart(4, '0')
  const mm = String(day.getMonth() + 1).padStart(2, '0')
  const dd = String(day.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateInput(value: string): string | null {
  const trimmed = value.trim()
  const match = ISO_DATE_INPUT_RE.exec(trimmed)
  if (!match) return null

  const calendarDay = calendarDayFromMatch(match)
  if (calendarDay.year < 1) return null

  return dateToISO(localDate(calendarDay)) === trimmed ? trimmed : null
}

function dateFromISO(value: string): Date | undefined {
  const iso = parseDateInput(value)
  const match = iso ? ISO_DATE_INPUT_RE.exec(iso) : null
  return match ? localDate(calendarDayFromMatch(match)) : undefined
}

function parseDateValue(value: string): Date | undefined {
  return dateFromISO(toISODate(value))
}

function datePickerStartMonth(selectedDate: Date | undefined): Date {
  const year = Math.min(selectedDate?.getFullYear() || DEFAULT_DATE_PICKER_START_YEAR, DEFAULT_DATE_PICKER_START_YEAR)
  return localDate({ year, monthIndex: 0, day: 1 })
}

function datePickerEndMonth(selectedDate: Date | undefined): Date {
  const year = Math.max(selectedDate?.getFullYear() || DEFAULT_DATE_PICKER_END_YEAR, DEFAULT_DATE_PICKER_END_YEAR)
  return localDate({ year, monthIndex: 11, day: 31 })
}

interface DateValueProps {
  value: string
  onSave: (newValue: string) => void
  locale?: AppLocale
  autoOpen?: boolean
  onCancel?: () => void
}

function useDatePicker({ value, onSave, autoOpen = false, onCancel }: DateValueProps) {
  const [open, setOpen] = useState(autoOpen)
  const selectedDate = parseDateValue(value)
  const selectedIso = selectedDate ? dateToISO(selectedDate) : ''
  const [draftValue, setDraftValue] = useState(selectedIso)
  const [invalidDraft, setInvalidDraft] = useState(false)

  const resetDraft = () => {
    setDraftValue(selectedIso)
    setInvalidDraft(false)
  }

  const closeWithoutSave = () => {
    resetDraft()
    setOpen(false)
    onCancel?.()
  }

  const commitDraftValue = () => {
    if (!draftValue.trim()) {
      if (value) onSave('')
      else closeWithoutSave()
      setOpen(false)
      return
    }

    const parsed = parseDateInput(draftValue)
    if (!parsed) {
      setInvalidDraft(true)
      return
    }

    onSave(parsed)
    trackDatePropertyDirectEntrySaved()
    setOpen(false)
  }

  const handleSelect = (day: Date | undefined) => {
    if (day) onSave(dateToISO(day))
    setOpen(false)
  }

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) resetDraft()
    setOpen(nextOpen)
    if (!nextOpen) onCancel?.()
  }

  function clear(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onSave('')
    setOpen(false)
  }

  return { open, changeOpen, selectedDate, draftValue, setDraftValue, invalidDraft, setInvalidDraft, commitDraftValue, closeWithoutSave, handleSelect, clear }
}

type DatePicker = ReturnType<typeof useDatePicker>

function DatePickerInput({ picker, label }: { picker: DatePicker; label: string }) {
  const { draftValue, setDraftValue, invalidDraft, setInvalidDraft, commitDraftValue, closeWithoutSave } = picker
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftValue(event.target.value)
    if (invalidDraft) setInvalidDraft(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraftValue()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeWithoutSave()
    }
  }

  return (
    <div className="border-b p-2">
      <Input
        className="h-8 w-full min-w-[8.75rem] border-ring bg-background px-2 py-1 text-left font-mono text-[13px] tabular-nums"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        placeholder="YYYY-MM-DD"
        aria-label={label}
        aria-invalid={invalidDraft ? 'true' : undefined}
        value={draftValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        autoFocus
        data-testid="date-picker-input"
      />
    </div>
  )
}

function DatePickerCalendar({ picker }: { picker: DatePicker }) {
  const { selectedDate, handleSelect, clear } = picker
  return (
    <>
      <div className="pb-8">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate}
          captionLayout="dropdown"
          navLayout="after"
          startMonth={datePickerStartMonth(selectedDate)}
          endMonth={datePickerEndMonth(selectedDate)}
          data-testid="date-picker-calendar"
        />
      </div>
      {selectedDate && (
        <div className="relative bg-popover border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={clear}
            data-testid="date-picker-clear"
          >
            <XIcon className="size-3" />
            Clear date
          </Button>
        </div>
      )}
    </>
  )
}

export function DateValue(props: DateValueProps) {
  const { value, locale = 'en' } = props
  const dateDisplayFormat = useDateDisplayFormat()
  const appLocale = useAppLocale()
  const formatted = formatDateValue(value, dateDisplayFormat, appLocale)
  const pickDateLabel = translate(locale, 'inspector.properties.pickDate')
  const picker = useDatePicker(props)

  return (
    <Popover open={picker.open} onOpenChange={picker.changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={`min-w-0 justify-start border-none text-left transition-colors hover:opacity-80${formatted ? ' bg-muted text-accent-foreground' : ' bg-transparent text-muted-foreground'}`}
          style={PROPERTY_CHIP_STYLE}
          title={value}
          data-testid="date-display"
        >
          <span className={`min-w-0 truncate${!formatted ? ' text-muted-foreground' : ''}`}>{formatted || pickDateLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="end" side="bottom" data-testid="date-picker-popover">
        <DatePickerInput picker={picker} label={pickDateLabel} />
        <DatePickerCalendar picker={picker} />
      </PopoverContent>
    </Popover>
  )
}
