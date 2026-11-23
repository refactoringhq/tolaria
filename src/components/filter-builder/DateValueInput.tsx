import { useEffect, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseDateFilterInput } from '@/utils/filterDates'
import { formatDateForDisplay, type DateDisplayFormat } from '@/utils/dateDisplay'
import { useAppLocale, useDateDisplayFormat } from '../../hooks/useAppPreferences'
import type { AppLocale } from '../../lib/i18n'

const DATE_PREVIEW_DEBOUNCE_MS = 250

interface DateValueInputProps {
  value: string
  onChange: (v: string) => void
}

interface DatePreviewState {
  previewLabel: string | null
  resolvedPreview: Date | null
  selected?: Date
  setShowPreview: (showPreview: boolean) => void
}

function resolvedDate(value: string): Date | undefined {
  return value ? parseDateFilterInput(value) ?? undefined : undefined
}

function previewLabelForValue(
  previewValue: string,
  resolvedPreview: Date | null,
  dateDisplayFormat: DateDisplayFormat,
  locale: AppLocale,
): string | null {
  if (resolvedPreview) return formatDateForDisplay(resolvedPreview, dateDisplayFormat, locale)
  return previewValue ? 'Not recognized' : null
}

function useDatePreview(value: string, dateDisplayFormat: DateDisplayFormat, locale: AppLocale): DatePreviewState {
  const [showPreview, setShowPreview] = useState(false)
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), DATE_PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [value])

  const previewValue = showPreview ? debouncedValue.trim() : ''
  const resolvedPreview = previewValue ? parseDateFilterInput(previewValue) : null
  return {
    previewLabel: previewLabelForValue(previewValue, resolvedPreview, dateDisplayFormat, locale),
    resolvedPreview,
    selected: resolvedDate(value),
    setShowPreview,
  }
}

function DatePreview({ label, resolved }: { label: string | null; resolved: Date | null }) {
  if (!label) return null

  return (
    <div
      className="pl-1 text-[11px] text-muted-foreground"
      data-testid={resolved ? 'date-value-preview' : 'date-value-preview-unrecognized'}
    >
      {resolved ? `Resolves to ${label}` : label}
    </div>
  )
}

export function DateValueInput({ value, onChange }: DateValueInputProps) {
  const dateDisplayFormat = useDateDisplayFormat()
  const locale = useAppLocale()
  const {
    previewLabel,
    resolvedPreview,
    selected,
    setShowPreview,
  } = useDatePreview(value, dateDisplayFormat, locale)

  return (
    <div className="flex flex-1 min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <Input
          className="h-8 flex-1 min-w-0 text-sm"
          placeholder='YYYY-MM-DD or "10 days ago"'
          value={value}
          onChange={(e) => {
            setShowPreview(true)
            onChange(e.target.value)
          }}
          onFocus={() => setShowPreview(true)}
          onBlur={() => setShowPreview(false)}
          data-testid="date-value-input"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="date-picker-trigger"
              className="h-8 w-8 shrink-0 px-0"
              title={selected ? formatDateForDisplay(selected, dateDisplayFormat, locale) : 'Pick a date'}
              aria-label={selected ? `Open date picker (${formatDateForDisplay(selected, dateDisplayFormat, locale)})` : 'Open date picker'}
            >
              <CalendarBlank size={14} className="shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(day) => onChange(day ? format(day, 'yyyy-MM-dd') : '')}
            />
          </PopoverContent>
        </Popover>
      </div>
      <DatePreview label={previewLabel} resolved={resolvedPreview} />
    </div>
  )
}
