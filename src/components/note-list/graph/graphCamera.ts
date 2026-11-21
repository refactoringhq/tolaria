import type Sigma from 'sigma'

type Point = { x: number; y: number }

/** The part of the canvas a fit should fill: from the left edge, `width` pixels wide (the editor panel covers the rest). */
export interface ViewRegion {
  width: number
  height: number
}

export interface CameraTarget {
  x: number
  y: number
  ratio: number
}

interface ViewportBox {
  left: number
  top: number
  right: number
  bottom: number
}

export const MIN_CAMERA_RATIO = 0.05
export const MAX_CAMERA_RATIO = 60
/** A fit never zooms in further than this, so two linked notes don't fill the whole canvas. */
const MIN_FIT_RATIO = 0.6
const FIT_PADDING_PX = 48
const REVEAL_MARGIN_PX = 48
export const CAMERA_DURATION_MS = 280

function nodePoint(renderer: Sigma, node: string): Point {
  return renderer.graphToViewport(renderer.getGraph().getNodeAttributes(node) as Point)
}

/** Where the given nodes sit on screen right now; null when none of them is in the graph. */
export function viewportBox(renderer: Sigma, nodes: Iterable<string>): ViewportBox | null {
  const graph = renderer.getGraph()
  let box: ViewportBox | null = null
  for (const node of nodes) {
    if (!graph.hasNode(node)) continue
    const { x, y } = nodePoint(renderer, node)
    box = box
      ? { left: Math.min(box.left, x), top: Math.min(box.top, y), right: Math.max(box.right, x), bottom: Math.max(box.bottom, y) }
      : { left: x, top: y, right: x, bottom: y }
  }
  return box
}

function clampRatio(ratio: number): number {
  return Math.min(MAX_CAMERA_RATIO, Math.max(MIN_CAMERA_RATIO, ratio))
}

/** Framed-graph units per screen pixel along x at the current camera. */
function framedPerPixel(renderer: Sigma): number {
  const origin = renderer.viewportToFramedGraph({ x: 0, y: 0 })
  const step = renderer.viewportToFramedGraph({ x: 1, y: 0 })
  return Math.hypot(step.x - origin.x, step.y - origin.y)
}

function fitScale(box: ViewportBox, region: ViewRegion): number {
  const usableWidth = Math.max(1, region.width - FIT_PADDING_PX * 2)
  const usableHeight = Math.max(1, region.height - FIT_PADDING_PX * 2)
  return Math.max((box.right - box.left) / usableWidth, (box.bottom - box.top) / usableHeight)
}

/**
 * The camera that puts `nodes` in the middle of `region`, as large as fits. `allowZoomIn` false keeps the
 * current zoom when the nodes already fit (revealing a neighbourhood never zooms in on it).
 */
export function cameraToFit(renderer: Sigma, nodes: Iterable<string>, region: ViewRegion, allowZoomIn = true): CameraTarget | null {
  const box = viewportBox(renderer, nodes)
  if (!box) return null
  const camera = renderer.getCamera()
  const scale = fitScale(box, region)
  const fitted = Math.max(camera.ratio * scale, MIN_FIT_RATIO)
  const ratio = clampRatio(allowZoomIn ? fitted : Math.max(camera.ratio, fitted))
  const center = renderer.viewportToFramedGraph({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 })
  const { width } = renderer.getDimensions()
  // Shift the camera right so the box centre lands in the middle of the uncovered region, not the canvas.
  const shift = (width / 2 - region.width / 2) * framedPerPixel(renderer) * (ratio / camera.ratio)
  return { x: center.x + shift, y: center.y, ratio }
}

function fullRegion(renderer: Sigma): ViewRegion {
  return renderer.getDimensions()
}

/** Fits the whole graph, eased unless `instant` (the automatic fit while the first layout settles). */
export function fitGraph(renderer: Sigma, instant = false) {
  const target = cameraToFit(renderer, renderer.getGraph().nodes(), fullRegion(renderer))
  if (!target) return
  const camera = renderer.getCamera()
  if (instant) camera.setState(target)
  else void camera.animate(target, { duration: CAMERA_DURATION_MS })
}

function insideRegion(box: ViewportBox, region: ViewRegion): boolean {
  return box.left >= REVEAL_MARGIN_PX && box.right <= region.width - REVEAL_MARGIN_PX
    && box.top >= REVEAL_MARGIN_PX && box.bottom <= region.height - REVEAL_MARGIN_PX
}

/** Eases the camera so every node of `nodes` is inside the uncovered region; nodes already in view stay put. */
export function revealNodes(renderer: Sigma, nodes: readonly string[], visibleWidth: number) {
  const region = { width: visibleWidth, height: renderer.getDimensions().height }
  const box = viewportBox(renderer, nodes)
  if (!box || visibleWidth <= 0 || insideRegion(box, region)) return
  const target = cameraToFit(renderer, nodes, region, false)
  if (target) void renderer.getCamera().animate(target, { duration: CAMERA_DURATION_MS })
}

export function zoomGraph(renderer: Sigma, direction: 'in' | 'out') {
  const camera = renderer.getCamera()
  if (direction === 'in') void camera.zoomIn({ duration: CAMERA_DURATION_MS })
  else void camera.zoomOut({ duration: CAMERA_DURATION_MS })
}
