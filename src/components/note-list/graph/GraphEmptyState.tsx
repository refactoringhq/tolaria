import { Graph } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { GraphLayoutBindings } from '../../../collections/layoutRegistry'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/presentationConfig'
import { type AppLocale, translate } from '../../../lib/i18n'

interface GraphEmptyStateProps {
  graph: GraphLayoutBindings
  locale: AppLocale
  /** True when the list has links but the filters hide every note. */
  filtered: boolean
}

/** Never a blank canvas: explains why there is nothing to draw and offers the ways forward. */
export function GraphEmptyState({ graph, locale, filtered }: GraphEmptyStateProps) {
  return (
    <div className="graph-empty flex min-h-0 flex-1 items-center justify-center p-8" data-testid={filtered ? 'graph-empty-filtered' : 'graph-empty'}>
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Graph size={20} />
        </span>
        <h3 className="m-0 text-[15px] font-semibold text-foreground">
          {translate(locale, filtered ? 'graph.empty.filteredTitle' : 'graph.empty.title')}
        </h3>
        <p className="m-0 text-[13px] text-muted-foreground">
          {translate(locale, filtered ? 'graph.empty.filteredBody' : 'graph.empty.body')}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {filtered && (
            <Button type="button" variant="outline" size="sm" onClick={() => graph.onSettingsChange(DEFAULT_GRAPH_SETTINGS)} data-testid="graph-empty-reset">
              {translate(locale, 'graph.empty.resetFilters')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={graph.onUseList} data-testid="graph-empty-use-list">
            {translate(locale, 'layout.useList')}
          </Button>
        </div>
      </div>
    </div>
  )
}
