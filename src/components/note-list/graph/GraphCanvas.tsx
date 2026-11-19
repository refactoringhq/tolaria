import type Graph from 'graphology'
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { type AppLocale, translate } from '../../../lib/i18n'
import type { VaultEntry } from '../../../types'
import { canvasKeyHandler, useCanvasClicks, useRevealOpenNote } from './graphCanvasInput'
import { GraphLabels } from './GraphLabels'
import { settleGraph } from './graphLayoutClient'
import { layoutIterations } from './graphLayoutSteps'
import type { VisibleGraph } from './graphModel'
import { readGraphPalette, useThemeSignature } from './graphPalette'
import { createGraphRenderer, fitGraph, type GraphRenderer, zoomGraph } from './graphRenderer'
import { createGraphModel, highlightNode, syncGraph } from './graphSync'
import { GraphZoomControls } from './GraphZoomControls'

export interface GraphCanvasProps {
  visible: VisibleGraph
  showLabels: boolean
  typeEntryMap: Record<string, VaultEntry>
  selectedNotePath: string | null
  /** True while the editor panel covers the right side of the canvas. */
  panelOpen: boolean
  locale: AppLocale
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
  onBackgroundClick: () => void
}

interface GraphSyncSource {
  stageRef: RefObject<HTMLDivElement | null>
  graph: Graph
  visible: VisibleGraph
  typeEntryMap: Record<string, VaultEntry>
  theme: string
}

type GraphOverlayProps = Pick<GraphCanvasProps, 'visible' | 'showLabels' | 'typeEntryMap' | 'selectedNotePath' | 'locale'> & { renderer: GraphRenderer }

function readHighlight(stage: HTMLElement): string {
  const palette = readGraphPalette(stage, {})
  palette.dispose()
  return palette.highlight
}

/**
 * One sigma renderer per mounted canvas. A theme switch only re-reads the highlight color and refreshes:
 * node and edge colors follow through the graph attributes, so the WebGL context is never rebuilt.
 */
function useGraphRenderer(stageRef: RefObject<HTMLDivElement | null>, graph: Graph, theme: string) {
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null)
  const highlightRef = useRef('')
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    highlightRef.current = readHighlight(stage)
    const created = createGraphRenderer(graph, stage, () => highlightRef.current)
    setRenderer(created)
    return () => {
      created.kill()
      setRenderer(null)
    }
  }, [graph, stageRef])
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !renderer) return
    highlightRef.current = readHighlight(stage)
    renderer.refresh()
  }, [renderer, stageRef, theme])
  return renderer
}

/** Mirrors the visible notes into the graph and re-settles the layout when notes or links come or go. */
function useGraphSync({ stageRef, graph, visible, typeEntryMap, theme }: GraphSyncSource) {
  const settled = useRef(false)
  const cancelLayout = useRef<(() => void) | null>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const palette = readGraphPalette(stage, typeEntryMap)
    const changed = syncGraph(graph, visible, palette)
    palette.dispose()
    if (!changed) return
    cancelLayout.current?.()
    cancelLayout.current = settleGraph(graph, layoutIterations(graph.order, settled.current))
    settled.current = true
  }, [graph, stageRef, theme, typeEntryMap, visible])
  useEffect(() => () => cancelLayout.current?.(), [])
}

/** Labels and zoom controls, drawn over the WebGL canvas once the renderer exists. */
function GraphOverlays({ renderer, visible, showLabels, typeEntryMap, selectedNotePath, locale }: GraphOverlayProps) {
  return (
    <>
      {showLabels && <GraphLabels renderer={renderer} nodes={visible.nodes} typeEntryMap={typeEntryMap} selectedNotePath={selectedNotePath} />}
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
  const { visible, showLabels, typeEntryMap, selectedNotePath, panelOpen, locale, onOpen, onBackgroundClick } = props
  const stageRef = useRef<HTMLDivElement>(null)
  const [graph] = useState(createGraphModel)
  const theme = useThemeSignature()
  const renderer = useGraphRenderer(stageRef, graph, theme)
  useGraphSync({ stageRef, graph, visible, typeEntryMap, theme })
  useEffect(() => {
    if (renderer) highlightNode(renderer, selectedNotePath)
  }, [renderer, selectedNotePath, visible])
  useRevealOpenNote({ renderer, stageRef, selectedNotePath, panelOpen })
  const clicks = useCanvasClicks({ renderer, visible, onOpen, onBackgroundClick })
  return (
    <div
      className="graph-canvas"
      role="application"
      aria-label={translate(locale, 'graph.canvasLabel', { count: visible.nodes.length })}
      data-layout-panel-keep=""
      data-testid="graph-canvas"
      onPointerDown={clicks.onPointerDown}
      onClick={clicks.onClick}
      onKeyDown={canvasKeyHandler(renderer, onBackgroundClick)}
    >
      <div ref={stageRef} className="graph-stage" data-testid="graph-stage" />
      {renderer && <GraphOverlays renderer={renderer} visible={visible} showLabels={showLabels} typeEntryMap={typeEntryMap} selectedNotePath={selectedNotePath} locale={locale} />}
    </div>
  )
}
