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
 * Marks the selected note (drawn larger). WebKitGTK can present a WebGL frame one draw late, which left
 * the mark on the previous note until the next interaction, so the change is drawn now and once more on
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

/**
 * The panel must stay closed (or the note unselected) this long to end a focus: opening another note can
 * close and reopen the panel, or clear the selection, for a moment.
 */
const PANEL_CLOSED_GRACE_MS = 300

/** The clicked note the graph focuses on; it ends with a background click, Escape, or the panel closing. */
function useFocusedNode(selectedNotePath: string | null, panelOpen: boolean) {
  const [focused, setFocused] = useState<string | null>(null)
  const panelShowsNote = panelOpen && selectedNotePath !== null
  useEffect(() => {
    if (panelShowsNote || focused === null) return
    const timer = setTimeout(() => setFocused(null), PANEL_CLOSED_GRACE_MS)
    return () => clearTimeout(timer)
  }, [focused, panelShowsNote])
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

interface FocusSource {
  graph: Graph
  renderer: GraphRenderer | null
  visible: VisibleGraph
  selectedNotePath: string | null
  panelOpen: boolean
  onOpen: GraphCanvasProps['onOpen']
  onBackgroundClick: () => void
}

/**
 * The open note the graph marks. Closing the panel leaves the note open in the app, so an empty-canvas
 * click or Escape unmarks it here until a node is clicked or another note opens.
 */
function useMarkedNote(selectedNotePath: string | null) {
  const [unmarked, setUnmarked] = useState<string | null>(null)
  const marked = selectedNotePath === unmarked ? null : selectedNotePath
  return { marked, unmark: () => setUnmarked(selectedNotePath), mark: () => setUnmarked(null) }
}

/** Hover and click focus: a node click opens and focuses the note; a background click or Escape deselects it. */
function useGraphFocus({ graph, renderer, visible, selectedNotePath, panelOpen, onOpen, onBackgroundClick }: FocusSource) {
  const [focused, setFocused] = useFocusedNode(selectedNotePath, panelOpen)
  const { marked, unmark, mark } = useMarkedNote(selectedNotePath)
  const hovered = useHoveredNode(renderer)
  const emphasis = useGraphEmphasis({ graph, hovered, focused, visible })
  const leaveFocus = () => {
    setFocused(null)
    unmark()
    onBackgroundClick()
  }
  useEscapeLeavesFocus(focused !== null, leaveFocus)
  const clicks = useCanvasClicks({
    renderer,
    visible,
    onNodeClick: (entry, event) => {
      setFocused(entry.path)
      mark()
      trackEvent('graph_node_focused', { neighbour_count: neighboursIn(visible.edges)(entry.path).length })
      onOpen(entry, event)
    },
    onBackgroundClick: leaveFocus,
  })
  return { focused, marked, emphasis, clicks, leaveFocus }
}

/** The WebGL graph: sigma draws nodes and edges, React draws labels and the zoom controls on top. */
export default function GraphCanvas(props: GraphCanvasProps) {
  const { visible, settings, typeEntryMap, panelOpen, locale } = props
  const stageRef = useRef<HTMLDivElement>(null)
  const [graph] = useState(createGraphModel)
  const theme = useThemeSignature()
  const renderer = useGraphRenderer(stageRef, graph, theme, displayOf(settings))
  const { layout, stopAutoFit } = useLiveLayout({ graph, renderer, forces: forcesOf(settings) })
  useGraphSync({ stageRef, graph, visible, typeEntryMap, theme, layout })
  const { focused, marked, emphasis, clicks, leaveFocus } = useGraphFocus({ ...props, graph, renderer })
  useOpenNoteHighlight(graph, renderer, marked, visible)
  const revealed = useMemo(() => (emphasis.focused ? [...emphasis.focused] : [marked ?? '']), [emphasis.focused, marked])
  useRevealOpenNote({ renderer, stageRef, revealed, panelOpen })
  useNodeDrag(renderer, layout, stopAutoFit)
  return (
    <div
      className="graph-canvas"
      role="application"
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
      {renderer && <GraphOverlays renderer={renderer} visible={visible} settings={settings} typeEntryMap={typeEntryMap} selectedNotePath={marked} locale={locale} emphasis={emphasis} />}
    </div>
  )
}
