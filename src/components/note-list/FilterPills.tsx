import { memo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import type { NoteListFilter } from '../../utils/noteListHelpers'
import { CreateNoteAction } from './NoteListHeader'

interface FilterPillsProps {
  active: NoteListFilter
  counts: Record<NoteListFilter, number>
  onChange: (filter: NoteListFilter) => void
  onCreate: () => void
  locale?: AppLocale
}

const PILLS: { value: NoteListFilter; labelKey: TranslationKey }[] = [
  { value: 'open', labelKey: 'noteList.filter.open' },
  { value: 'archived', labelKey: 'noteList.filter.archived' },
]

function FilterPillsInner({ active, counts, onChange, onCreate, locale = 'en' }: FilterPillsProps) {
  return (
    <div className="note-list-bottom-controls pointer-events-none absolute z-[23] flex items-center justify-between gap-2">
      <Tabs value={active} activationMode="manual" className="pointer-events-auto min-w-0 gap-0" data-testid="filter-pills">
        <TabsList className="floating-pane-control max-w-full rounded-full p-0.5">
          {PILLS.map(({ value, labelKey }) => (
            <TabsTrigger
              key={value}
              value={value}
              onClick={() => onChange(value)}
              className="min-w-0 flex-initial rounded-full px-2 py-0 text-xs !text-foreground data-[state=active]:bg-sidebar group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none"
              data-testid={`filter-pill-${value}`}
            >
              <span className="truncate">{translate(locale, labelKey)}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{value === 'open' ? counts.open : counts.archived}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <CreateNoteAction onCreateNote={onCreate} locale={locale} floating />
    </div>
  )
}

export const FilterPills = memo(FilterPillsInner)
