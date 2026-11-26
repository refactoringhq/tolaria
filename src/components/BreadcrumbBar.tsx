import { memo, useEffect, useImperativeHandle, useRef } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkspaceInitialsBadge } from './WorkspaceInitialsBadge'
import { NotePresence } from './NotePresence'
import { useDragRegion } from '../hooks/useDragRegion'
import { NoteHistoryDrawer } from './note-history/NoteHistoryDrawer'
import { BreadcrumbTooltipContext, useBreadcrumbTooltipController } from './breadcrumb-bar/breadcrumbTooltip'
import { InspectorAction, NoteToolbarActions } from './breadcrumb-bar/BreadcrumbToolbarActions'
import { BreadcrumbOverflowMenu } from './breadcrumb-bar/BreadcrumbOverflowMenu'
import { useBreadcrumbOverflow } from './breadcrumb-bar/useBreadcrumbOverflow'
import { FilenameCrumb } from './breadcrumb-bar/FilenameCrumb'
import type { BreadcrumbBarProps } from './breadcrumb-bar/breadcrumbBarProps'

function BreadcrumbTitleSkeleton() {
  return (
    <span
      aria-hidden="true"
      data-testid="breadcrumb-title-skeleton"
      className="h-4 w-36 animate-pulse rounded bg-muted"
    />
  )
}

function BreadcrumbActions(options: Omit<BreadcrumbBarProps, 'wordCount' | 'barRef' | 'onRenameFilename'> & {
  actionsRef: React.RefObject<HTMLDivElement | null>
  overflowCollapsed: boolean
}) {
  const { entry, actionsRef, overflowCollapsed, locale = 'en' } = options

  return (
    <div
      ref={actionsRef}
      className="breadcrumb-bar__actions ml-auto flex shrink-0 items-center"
      data-overflow-collapsed={overflowCollapsed}
      style={{ gap: 8 }}
    >
      <NotePresence locale={locale} />
      <NoteToolbarActions {...options} locale={locale} />
      <BreadcrumbOverflowMenu {...options} showResponsiveActions={overflowCollapsed} locale={locale} />
      <InspectorAction inspectorCollapsed={options.inspectorCollapsed} locale={locale} onToggleInspector={options.onToggleInspector} />
      <NoteHistoryDrawer notePath={entry.path} locale={locale} />
    </div>
  )
}

function BreadcrumbSeparator() {
  return <span aria-hidden="true" className="shrink-0 text-border">›</span>
}

function WorkspaceCrumb({ entry }: Pick<BreadcrumbBarProps, 'entry'>) {
  const workspace = entry.workspace
  if (!workspace) return null

  return (
    <>
      <WorkspaceInitialsBadge
        className="shrink-0"
        testId="breadcrumb-workspace-label"
        workspace={workspace}
      />
      <BreadcrumbSeparator />
    </>
  )
}

function BreadcrumbTitle({
  content,
  entry,
  locale,
  loadingTitle,
  onRenameFilename,
}: Pick<BreadcrumbBarProps, 'content' | 'entry' | 'locale' | 'loadingTitle' | 'onRenameFilename'>) {
  const typeLabel = entry.isA ?? 'Note'
  return (
    <div className="breadcrumb-bar__title-content flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
      <WorkspaceCrumb entry={entry} />
      <span className="shrink-0">{typeLabel}</span>
      <BreadcrumbSeparator />
      <div className="flex min-w-0 items-center gap-1 truncate">
        {loadingTitle
          ? <BreadcrumbTitleSkeleton />
          : <FilenameCrumb content={content} entry={entry} locale={locale} onRenameFilename={onRenameFilename} />}
      </div>
    </div>
  )
}

const BAR_STYLE: React.CSSProperties = {
  height: 52,
  background: 'var(--background)',
  padding: '6px 16px 6px var(--breadcrumb-bar-left-padding, 16px)',
  boxSizing: 'border-box',
}

/** The bar's drag region, exposed through `barRef`; without a native one it drags on mousedown. */
function useBreadcrumbDragRegion(barRef: BreadcrumbBarProps['barRef']) {
  const { dragRegionRef, onMouseDown } = useDragRegion<HTMLDivElement>()
  const fallbackDragRegionRef = useRef<HTMLDivElement>(null)
  const breadcrumbDragRegionRef = dragRegionRef ?? fallbackDragRegionRef
  useImperativeHandle(barRef, () => breadcrumbDragRegionRef.current as HTMLDivElement, [breadcrumbDragRegionRef])

  useEffect(() => {
    if (dragRegionRef) return
    const bar = fallbackDragRegionRef.current
    if (!bar) return

    bar.addEventListener('mousedown', onMouseDown)
    return () => bar.removeEventListener('mousedown', onMouseDown)
  }, [dragRegionRef, onMouseDown])

  return breadcrumbDragRegionRef
}

export const BreadcrumbBar = memo(function BreadcrumbBar({
  content,
  entry,
  barRef,
  locale = 'en',
  loadingTitle = false,
  onRenameFilename,
  ...actionProps
}: BreadcrumbBarProps) {
  const breadcrumbDragRegionRef = useBreadcrumbDragRegion(barRef)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLDivElement | null>(null)
  const overflowCollapsed = useBreadcrumbOverflow(titleRef, actionsRef)
  const tooltipController = useBreadcrumbTooltipController()

  return (
    <TooltipProvider>
      <BreadcrumbTooltipContext.Provider value={tooltipController}>
        <div
          ref={breadcrumbDragRegionRef}
          data-tauri-drag-region
          data-title-hidden=""
          className="breadcrumb-bar flex shrink-0 items-center border-b border-transparent"
          style={BAR_STYLE}
        >
          <div ref={titleRef} className="breadcrumb-bar__title min-w-0 flex-1 overflow-hidden">
            <BreadcrumbTitle
              content={content}
              entry={entry}
              locale={locale}
              loadingTitle={loadingTitle}
              onRenameFilename={onRenameFilename}
            />
          </div>
          <div
            aria-hidden="true"
            data-tauri-drag-region
            className="breadcrumb-bar__drag-spacer w-6 shrink-0"
          />
          <BreadcrumbActions
            actionsRef={actionsRef}
            entry={entry}
            locale={locale}
            overflowCollapsed={overflowCollapsed}
            {...actionProps}
          />
        </div>
      </BreadcrumbTooltipContext.Provider>
    </TooltipProvider>
  )
})
