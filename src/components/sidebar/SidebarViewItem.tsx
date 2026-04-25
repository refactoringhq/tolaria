import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { VaultEntry, ViewFile } from '../../types'
import { evaluateView } from '../../utils/viewFilters'
import { Funnel, PencilSimple, Trash } from '@phosphor-icons/react'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { SidebarCountPill } from '../SidebarParts'
import { SIDEBAR_ITEM_PADDING } from './sidebarStyles'

interface SidebarViewItemProps {
  view: ViewFile
  isActive: boolean
  onSelect: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
  entries: VaultEntry[]
}

export function SidebarViewItem({
  view,
  isActive,
  onSelect,
  onEditView,
  onDeleteView,
  entries,
}: SidebarViewItemProps) {
  const { t } = useTranslation('sidebar')
  const count = useMemo(() => evaluateView(view.definition, entries).length, [view.definition, entries])
  const showCount = count > 0
  const icon = view.definition.icon
    ? <NoteTitleIcon icon={view.definition.icon} size={16} />
    : <Funnel size={16} weight={isActive ? 'fill' : 'regular'} />

  return (
    <div className="group relative">
      <div
        className={`flex cursor-pointer select-none items-center gap-2 rounded transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'}`}
        style={{ padding: showCount ? SIDEBAR_ITEM_PADDING.withCount : SIDEBAR_ITEM_PADDING.regular, borderRadius: 4 }}
        onClick={onSelect}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{view.definition.name}</span>
        {showCount && (
          <SidebarCountPill
            count={count}
            className="text-muted-foreground transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
            style={{ background: 'var(--muted)' }}
            testId="view-count-chip"
          />
        )}
      </div>
      <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {onEditView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(event) => { event.stopPropagation(); onEditView(view.filename) }}
            title={t('Edit view')}
          >
            <PencilSimple size={12} />
          </button>
        )}
        {onDeleteView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            onClick={(event) => { event.stopPropagation(); onDeleteView(view.filename) }}
            title={t('Delete view')}
          >
            <Trash size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
