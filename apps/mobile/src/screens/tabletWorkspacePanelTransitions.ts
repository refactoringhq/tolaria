import { desktopPanelParity } from '../ui/desktopParity'
import type { TabletPanel } from './tabletWorkspaceTypes'

export const tabletPanelTransitionDurationMs = 160
export const tabletPropertiesEdgeWidth = 32

export type TabletLeftPanelStage = 'all' | 'editor' | 'list'
export type TabletWorkspaceDragMode = 'left' | 'properties'

export function tabletLeftPanelStageOffset(stage: TabletLeftPanelStage, compactTablet: boolean) {
  if (stage === 'editor') {
    return -(desktopPanelParity.noteListWidth + (compactTablet ? 0 : desktopPanelParity.sidebarWidth))
  }
  if (stage === 'list' && !compactTablet) return -desktopPanelParity.sidebarWidth
  return 0
}

export function tabletLeftPanelDragOffset({
  compactTablet,
  dx,
  stage,
  startOffset,
}: {
  compactTablet: boolean
  dx: number
  stage: TabletLeftPanelStage
  startOffset?: number
}) {
  const minimum = tabletLeftPanelStageOffset('editor', compactTablet)
  return clamp((startOffset ?? tabletLeftPanelStageOffset(stage, compactTablet)) + dx, minimum, 0)
}

export function tabletLeftPanelStageAfterDrag({
  compactTablet,
  dx,
  stage,
  startOffset,
  vx,
}: {
  compactTablet: boolean
  dx: number
  stage: TabletLeftPanelStage
  startOffset?: number
  vx: number
}) {
  const stages = compactTablet
    ? (['list', 'editor'] as const)
    : (['all', 'list', 'editor'] as const)
  const offset = tabletLeftPanelDragOffset({ compactTablet, dx, stage, startOffset })
  const projectedOffset = clamp(
    offset + vx * 200,
    tabletLeftPanelStageOffset('editor', compactTablet),
    0,
  )
  return stages.reduce((nearest, candidate) => (
    Math.abs(tabletLeftPanelStageOffset(candidate, compactTablet) - projectedOffset)
      < Math.abs(tabletLeftPanelStageOffset(nearest, compactTablet) - projectedOffset)
      ? candidate
      : nearest
  ), stages[0])
}

export function tabletWorkspaceDragMode({
  dx,
  propertiesVisible,
  screenWidth,
  x0,
}: {
  dx: number
  propertiesVisible: boolean
  screenWidth: number
  x0: number
}): TabletWorkspaceDragMode {
  if (propertiesVisible && x0 >= screenWidth - desktopPanelParity.inspectorWidth) return 'properties'
  if (!propertiesVisible && dx < 0 && x0 >= screenWidth - tabletPropertiesEdgeWidth) return 'properties'
  return 'left'
}

export function tabletPropertiesVisibleAfterDrag({
  dx,
  visible,
  vx,
}: {
  dx: number
  visible: boolean
  vx: number
}) {
  if (Math.abs(vx) >= 0.5 && Math.abs(dx) >= 24) return vx < 0
  const offset = tabletPropertiesDragOffset({ dx, visible })
  return offset < desktopPanelParity.inspectorWidth / 2
}

export function tabletLeftChromeWidth({
  compactTablet,
  noteListVisible,
  previewVisible = false,
  sidebarVisible,
}: {
  compactTablet: boolean
  noteListVisible: boolean
  previewVisible?: boolean
  sidebarVisible: boolean
}) {
  const targetVisible = previewVisible || noteListVisible
  if (!targetVisible) return 0

  return desktopPanelParity.noteListWidth
    + (sidebarVisible && !compactTablet ? desktopPanelParity.sidebarWidth : 0)
}

export function tabletLeftChromeLayout({
  compactTablet,
  noteListVisible,
  previewVisible,
  sidebarVisible,
}: {
  compactTablet: boolean
  noteListVisible: boolean
  previewVisible: boolean
  sidebarVisible: boolean
}) {
  const showSidebar = !compactTablet && sidebarVisible
  const rendered = showSidebar || noteListVisible
  const targetSidebarVisible = !compactTablet
  const renderSidebar = showSidebar || (previewVisible && targetSidebarVisible)
  const renderNoteList = noteListVisible || previewVisible

  return {
    currentWidth: tabletLeftChromeWidth({
      compactTablet,
      noteListVisible: renderNoteList,
      previewVisible,
      sidebarVisible: renderSidebar,
    }),
    rendered,
    renderNoteList,
    renderSidebar,
    revealWidth: tabletLeftChromeWidth({
      compactTablet,
      noteListVisible: true,
      previewVisible: true,
      sidebarVisible: targetSidebarVisible,
    }),
    showSidebar,
  }
}

export function tabletLeftChromeRendered({
  propertiesPanelVisible,
  propertiesReplaceSidebar,
}: {
  propertiesPanelVisible: boolean
  propertiesReplaceSidebar: boolean
}) {
  return !(propertiesPanelVisible && propertiesReplaceSidebar)
}

export function restoreTabletPanelVisibility(
  restore: { noteList: boolean; sidebar: boolean } | null,
  showPanel: (panel: TabletPanel) => void,
) {
  if (restore?.sidebar) showPanel('sidebar')
  if (restore?.noteList) showPanel('noteList')
}

export const tabletLeftChromeDragOffset = createTabletEdgePanelDragOffset(-1)
export const tabletPropertiesDragOffset = createTabletEdgePanelDragOffset(
  1,
  desktopPanelParity.inspectorWidth,
)

function createTabletEdgePanelDragOffset(direction: -1 | 1, defaultWidth?: number) {
  return ({ dx, visible, width = defaultWidth ?? 0 }: { dx: number; visible: boolean; width?: number }) =>
    tabletEdgePanelDragOffset({ direction, dx, visible, width })
}

function tabletEdgePanelDragOffset({
  direction,
  dx,
  visible,
  width,
}: {
  direction: -1 | 1
  dx: number
  visible: boolean
  width: number
}) {
  if (width <= 0) return 0
  const distanceFromVisible = visible ? direction * dx : width + direction * dx
  const offset = direction * clamp(distanceFromVisible, 0, width)
  return offset === 0 ? 0 : offset
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
