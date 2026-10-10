import { desktopPanelParity } from '../ui/desktopParity'
import type { TabletPanelPosition } from './tabletNativePanGesture'
import { tabletReadableEditorMinWidth } from './tabletWorkspaceScreenMode'
import type { TabletLeftPanelStage } from './tabletWorkspacePanelTransitions'

/** Narrowing hides left panes in order; growing never reopens a dismissed pane. */
export function tabletPanelPositionAfterResize(position: TabletPanelPosition, width: number, compact: boolean): TabletPanelPosition {
  const propertiesVisible = position.propertiesVisible && width >= tabletReadableEditorMinWidth + desktopPanelParity.inspectorWidth
  const inspectorWidth = propertiesVisible ? desktopPanelParity.inspectorWidth : 0
  const available = width - inspectorWidth - tabletReadableEditorMinWidth
  const stage = fittedLeftStage(position.stage, available, compact)
  return stage === position.stage && propertiesVisible === position.propertiesVisible
    ? position : { stage, propertiesVisible }
}

function fittedLeftStage(requested: TabletLeftPanelStage, available: number, compact: boolean): TabletLeftPanelStage {
  let stage = compact && requested === 'all' ? 'list' : requested
  if (stage === 'all' && available < desktopPanelParity.sidebarWidth + desktopPanelParity.noteListWidth) stage = 'list'
  if (stage === 'list' && available < desktopPanelParity.noteListWidth) stage = 'editor'
  return stage
}
