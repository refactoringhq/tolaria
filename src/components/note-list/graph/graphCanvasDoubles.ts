import type Graph from 'graphology'
import { vi } from 'vitest'

/** Test doubles for GraphCanvas tests: WebGL is not available in JSDOM, and the live layout runs elsewhere. */
type Handler = (payload: { node: string }) => void

export interface FakeRenderer {
  graph: Graph
  handlers: Map<string, Set<Handler>>
  camera: { ratio: number }
  kill: () => void
  refresh: () => void
  scheduleRender: () => void
  emit: (event: string, payload?: { node: string }) => void
}

export const renderers: FakeRenderer[] = []
export const layout = { load: vi.fn(), hold: vi.fn(), release: vi.fn(), setForces: vi.fn(), dispose: vi.fn() }
export const createLayoutController = vi.fn<(graph: unknown, forces: unknown, onFrame: (resting: boolean) => void) => typeof layout>(() => layout)
export const zoomGraph = vi.fn()
export const fitGraph = vi.fn()
export const revealNodes = vi.fn()
export const trackEvent = vi.fn()

function createFakeRenderer(graph: Graph): FakeRenderer {
  const handlers = new Map<string, Set<Handler>>()
  const camera = { ratio: 1 }
  const renderer = {
    graph,
    handlers,
    camera,
    kill: vi.fn(),
    emit: (event: string, payload = { node: '' }) => {
      for (const handler of handlers.get(event) ?? []) handler(payload)
    },
    getGraph: () => graph,
    on: (event: string, handler: Handler) => handlers.set(event, (handlers.get(event) ?? new Set()).add(handler)),
    off: (event: string, handler: Handler) => handlers.get(event)?.delete(handler),
    getNodeDisplayData: (node: string) => (graph.hasNode(node) ? { size: 6 } : undefined),
    graphToViewport: (point: { x: number; y: number }) => point,
    getDimensions: () => ({ width: 800, height: 600 }),
    getSetting: () => (ratio: number) => Math.sqrt(ratio),
    getCamera: () => camera,
    refresh: vi.fn(),
    scheduleRender: vi.fn(),
  }
  renderers.push(renderer)
  return renderer
}

export const telemetryModule = { trackEvent }
export const layoutClientModule = { createLayoutController, FIRST_LAYOUT_ALPHA: 1, RELAYOUT_ALPHA: 0.3 }
export const cameraModule = { zoomGraph, fitGraph, revealNodes }
export const rendererModule = { createGraphRenderer: createFakeRenderer }

export function resetGraphCanvasDoubles() {
  renderers.length = 0
  for (const mock of [zoomGraph, fitGraph, revealNodes, trackEvent, createLayoutController, ...Object.values(layout)]) mock.mockClear()
}

export function lastRenderer(): FakeRenderer {
  const renderer = renderers.at(-1)
  if (!renderer) throw new Error('No renderer')
  return renderer
}
