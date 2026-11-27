import { Eye } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { type AppLocale, translate } from '../../lib/i18n'
import { columnTitle, type HiddenColumnSummary } from './kanbanModel'

interface KanbanHiddenColumnsProps {
  hidden: HiddenColumnSummary[]
  locale: AppLocale
  onShow: (group: string) => void
}

/** The end-of-board list of hidden columns with their note counts, like Notion's "Hidden groups". */
export function KanbanHiddenColumns({ hidden, locale, onShow }: KanbanHiddenColumnsProps) {
  if (hidden.length === 0) return null
  const heading = translate(locale, 'layout.hiddenColumns')
  return (
    <section className="kanban-hidden-columns flex w-[220px] min-w-[220px] shrink-0 flex-col gap-0.5 self-start rounded-xl p-2" aria-label={heading} data-testid="kanban-hidden-columns">
      <h4 className="m-0 px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</h4>
      {hidden.map(({ group, count }) => {
        const title = columnTitle(group, locale)
        const showLabel = translate(locale, 'layout.showColumn', { column: title })
        return (
          <Button
            key={group || '__empty'}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-between gap-2 px-2 text-[13px] font-normal text-foreground"
            title={showLabel}
            aria-label={showLabel}
            data-testid="kanban-show-column"
            onClick={() => onShow(group)}
          >
            <span className="truncate">{title}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {count}
              <Eye size={14} />
            </span>
          </Button>
        )
      })}
    </section>
  )
}
