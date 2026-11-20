import type Graph from 'graphology'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphSettings } from '../../../collections/collectionTypes'
import { type AppLocale, translate } from '../../../lib/i18n'
import { trackEvent } from '../../../lib/telemetry'
import type { VaultEntry } from '../../../types'
import { fitGraph, zoomGraph } from './graphCamera'
import { displayOf, forcesOf, useGraphEmphasis, useGraphRenderer, useGraphSync, useLiveLayout } from './graphCanvasHooks'
import { canvasKeyHandler, useCanvasClicks, useEscapeLeavesFocus, useHoveredNode, useNodeDrag, useRevealOpenNote } from './graphCanvasInput'
import { neighboursIn } from './graphEmphasis'
import { GraphLabels } from './GraphLabels'
import type { LabelEmphasis } from './graphLabelRanking'
import type { VisibleGraph } from './graphModel'
import { useThemeSignature } from './graphPalette'
import type { GraphRenderer } from './graphRenderer'
import { createGraphModel, highlightNode } from './graphSync'
import { GraphZoomControls } from './GraphZoomControls'

export interface GraphCanvasProps {
  visible: VisibleGraph
  settings: GraphSettings
  typeEntryMap: Record<string, VaultEntry>
  selectedNotePath: string | null
  /** True while the editor panel covers the right side of the canvas. */
  panelOpen: boolean
  locale: AppLocale
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
  onBackgroundClick: () => void
}

type GraphOverlayProps = Pick<GraphCanvasProps, 'visible' | 'settings' | 'typeEntryMap' | 'selectedNotePath' | 'locale'> & {
  renderer: GraphRenderer
  emphasis: LabelEmphasis
}

/**
 * Rings the note open in the editor panel. WebKitGTK can present a WebGL frame one draw late, which left
 * the ring on the previous note until the next interaction, so the change is drawn now and once more on
 * the next animation frame.
 */
function useOpenNoteHighlight(graph: Graph, renderer: GraphRenderer | null, selectedNotePath: string | null, visible: VisibleGraph) {
  useEffect(() => {
    if (!highlightNode(graph, selectedNotePath) || !renderer) return
    renderer.refresh()
    const frame = requestAnimationFrame(() => renderer.scheduleRender())
    return () => cancelAnimationFrame(frame)
  }, [graph, renderer, selectedNotePath, visible])
}

/** What ends a focus without a click on the canvas: the open note going away or the editor panel closing. */
function focusEnds(previous: { selected: string | null; panelOpen: boolean }, selected: string | null, panelOpen: boolean): boolean {
  return (previous.selected !== null && selected === null) || (previous.panelOpen && !panelOpen)
}

/** The clicked note the graph focuses on; it ends with a background click, Escape, or the panel closing. */
function useFocusedNode(selectedNotePath: string | null, panelOpen: boolean) {
  const [focused, setFocused] = useState<string | null>(null)
  const [previous, setPrevious] = useState({ selected: selectedNotePath, panelOpen })
  // Adjusted during render (not in an effect), so the focus never outlives the panel by a frame.
  if (previous.selected !== selectedNotePath || previous.panelOpen !== panelOpen) {
    setPrevious({ selected: selectedNotePath, panelOpen })
    if (focusEnds(previous, selectedNotePath, panelOpen)) setFocused(null)
  }
  return [focused, setFocused] as const
}

/** Labels and zoom controls, drawn over the WebGL canvas once the renderer exists. */
function GraphOverlays({ renderer, visible, settings, typeEntryMap, selectedNotePath, locale, emphasis }: GraphOverlayProps) {
  return (
    <>
      {settings.showLabels && (
        <GraphLabels
          renderer={renderer}
          nodes={visible.nodes}
          typeEntryMap={typeEntryMap}
          selectedNotePath={selectedNotePath}
          emphasis={emphasis}
          textFadeThreshold={settings.textFadeThreshold}
        />
      )}
      <GraphZoomControls
        locale={locale}
        onZoomIn={() => zoomGraph(renderer, 'in')}
        onZoomOut={() => zoomGraph(renderer, 'out')}
        onFit={() => fitGraph(renderer)}
      />
    </>
  )
}

/** The WebGL graph: sigma draws nodes and edges, React draws labels and the zoom controls on top. */
export default function GraphCanvas(props: GraphCanvasProps) {
  const { visible, settings, typeEntryMap, selectedNotePath, panelOpen, locale, onOpen, onBackgroundClick } = props
  const stageRef = useRef<HTMLDivElement>(null)
  const [graph] = useState(createGraphModel)
  const theme = useThemeSignature()
  const renderer = useGraphRenderer(stageRef, graph, theme, displayOf(settings))
  const { layout, stopAutoFit } = useLiveLayout({ graph, renderer, forces: forcesOf(settings) })
  useGraphSync({ stageRef, graph, visible, typeEntryMap, groups: settings.colorGroups, theme, layout })
  useOpenNoteHighlight(graph, renderer, selectedNotePath, visible)
  const [focused, setFocused] = useFocusedNode(selectedNotePath, panelOpen)
  const hovered = useHoveredNode(renderer)
  const emphasis = useGraphEmphasis({ graph, hovered, focused, visible })
  const revealed = useMemo(() => (emphasis.focused ? [...emphasis.focused] : [selectedNotePath ?? '']), [emphasis.focused, selectedNotePath])
  useRevealOpenNote({ renderer, stageRef, revealed, panelOpen })
  useNodeDrag(renderer, layout, stopAutoFit)
  const leaveFocus = () => {
    setFocused(null)
    onBackgroundClick()
  }
  useEscapeLeavesFocus(focused !== null, leaveFocus)
  const clicks = useCanvasClicks({
    renderer,
    visible,
    onNodeClick: (entry, event) => {
      setFocused(entry.path)
      trackEvent('graph_node_focused', { neighbour_count: neighboursIn(visible.edges)(entry.path).length })
      onOpen(entry, event)
    },
    onBackgroundClick: leaveFocus,
  })
  return (
    <div
      className="graph-canvas"
      role="application"
      tabIndex={0}
      aria-label={translate(locale, 'graph.canvasLabel', { count: visible.nodes.length })}
      data-layout-panel-keep=""
      data-testid="graph-canvas"
      data-focused-node={focused ?? undefined}
      data-hovered-node={emphasis.hovered ?? undefined}
      onPointerDown={(event) => {
        stopAutoFit()
        clicks.onPointerDown(event)
      }}
      onWheel={stopAutoFit}
      onClick={clicks.onClick}
      onKeyDown={canvasKeyHandler(renderer, leaveFocus)}
    >
      <div ref={stageRef} className="graph-stage" data-testid="graph-stage" />
      {renderer && <GraphOverlays renderer={renderer} visible={visible} settings={settings} typeEntryMap={typeEntryMap} selectedNotePath={selectedNotePath} locale={locale} emphasis={emphasis} />}
    </div>
  )
}
