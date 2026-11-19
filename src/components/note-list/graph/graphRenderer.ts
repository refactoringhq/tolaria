import type Graph from 'graphology'
import Sigma from 'sigma'
import { layerDashed } from 'sigma/rendering'

export type GraphRenderer = Sigma

const MIN_CAMERA_RATIO = 0.05
const MAX_CAMERA_RATIO = 4
const SELECTED_NODE_GROWTH = 1.5
const CAMERA_DURATION_MS = 280
const REVEAL_MARGIN_PX = 48

/**
 * Sigma on WebGL: one dashed edge layer draws both edge kinds. Relationship edges fill their gaps with the
 * edge color (solid); wiki-link edges leave the gaps transparent (dashed). The open note carries a
 * `highlighted` attribute and is drawn larger with a backdrop ring. Labels are an HTML overlay, so sigma's own labels stay off.
 */
export function createGraphRenderer(graph: Graph, container: HTMLElement, highlight: () => string): GraphRenderer {
  return new Sigma(graph, container, {
    primitives: {
      edges: {
        variables: { gapColor: { type: 'color', default: 'rgba(0, 0, 0, 0)' } },
        layers: [layerDashed({ gapColor: { attribute: 'gapColor' }, dashSize: { value: 5 }, gapSize: { value: 4 } })],
      },
    },
    styles: {
      nodes: {
        x: { attribute: 'x' },
        y: { attribute: 'y' },
        color: { attribute: 'color' },
        size: (attributes) => Number(attributes.size ?? 6) * (attributes.highlighted ? SELECTED_NODE_GROWTH : 1),
        backdropVisibility: (attributes) => (attributes.highlighted ? 'visible' : 'hidden'),
        // Read on every refresh, so a theme switch recolors the ring without rebuilding the renderer.
        backdropColor: () => highlight(),
        backdropShadowBlur: 0,
        backdropPadding: 3,
        labelVisibility: 'hidden',
      },
      edges: {
        color: { attribute: 'color' },
        size: { attribute: 'size' },
        gapColor: { attribute: 'gapColor' },
      },
    },
    settings: {
      renderLabels: false,
      renderEdgeLabels: false,
      minCameraRatio: MIN_CAMERA_RATIO,
      maxCameraRatio: MAX_CAMERA_RATIO,
      zoomDuration: CAMERA_DURATION_MS,
      stagePadding: 40,
      // Sizes are screen pixels (growing gently with zoom), not graph units that balloon on small graphs.
      itemSizesReference: 'screen',
      enableNodeDrag: false,
    },
  })
}

export function zoomGraph(renderer: GraphRenderer, direction: 'in' | 'out') {
  const camera = renderer.getCamera()
  if (direction === 'in') void camera.zoomIn({ duration: CAMERA_DURATION_MS })
  else void camera.zoomOut({ duration: CAMERA_DURATION_MS })
}

/**
 * Pans the camera so a node covered by the editor panel moves to the middle of the part of the canvas
 * the panel leaves visible (`visibleWidth` pixels from the left edge). Nodes already visible stay put.
 */
export function revealNode(renderer: GraphRenderer, node: string, visibleWidth: number) {
  const graph = renderer.getGraph()
  if (!graph.hasNode(node) || visibleWidth <= 0) return
  const point = renderer.graphToViewport(graph.getNodeAttributes(node) as { x: number; y: number })
  if (point.x >= REVEAL_MARGIN_PX && point.x <= visibleWidth - REVEAL_MARGIN_PX) return
  const from = renderer.viewportToFramedGraph(point)
  const to = renderer.viewportToFramedGraph({ x: visibleWidth / 2, y: point.y })
  const camera = renderer.getCamera()
  void camera.animate({ x: camera.x + from.x - to.x, y: camera.y + from.y - to.y }, { duration: CAMERA_DURATION_MS })
}

export function fitGraph(renderer: GraphRenderer) {
  void renderer.getCamera().reset({ duration: CAMERA_DURATION_MS })
}
