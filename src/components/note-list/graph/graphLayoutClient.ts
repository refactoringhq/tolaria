import type Graph from 'graphology'
import type { GraphForces, GraphLayoutSnapshot } from './graphSimulation'
import { type SimulationCommand, type SimulationFrame, SimulationLoop } from './graphSimulationLoop'

/** Energy for the very first layout and for a graph whose notes or links changed afterwards. */
export const FIRST_LAYOUT_ALPHA = 1
export const RELAYOUT_ALPHA = 0.3

/** The live layout of one canvas: the simulation runs elsewhere, positions land in the graph once per frame. */
export interface LayoutController {
  /** Restarts the simulation from the graph's current notes, links and positions. */
  load: (alpha: number) => void
  hold: (node: string, x: number, y: number) => void
  release: (node: string) => void
  setForces: (forces: GraphForces) => void
  dispose: () => void
}

interface SimulationChannel {
  send: (command: SimulationCommand) => void
  close: () => void
}

export function snapshotGraph(graph: Graph): GraphLayoutSnapshot {
  const ids = graph.nodes()
  const index = new Map(ids.map((id, position) => [id, position]))
  const positions: number[] = []
  for (const id of ids) positions.push(graph.getNodeAttribute(id, 'x') ?? 0, graph.getNodeAttribute(id, 'y') ?? 0)
  const edges: number[] = []
  graph.forEachEdge((_edge, _attributes, source, target) => {
    edges.push(index.get(source) ?? 0, index.get(target) ?? 0)
  })
  return { ids, positions, edges }
}

/** Writes simulation positions back in one graph update, skipping the held node and notes that left. */
export function applyPositions(graph: Graph, frame: SimulationFrame, held: string | null) {
  const index = new Map(frame.ids.map((id, position) => [id, position]))
  graph.updateEachNodeAttributes((node, attributes) => {
    const position = index.get(node)
    if (position === undefined || node === held) return attributes
    return { ...attributes, x: frame.positions.at(position * 2) ?? attributes.x, y: frame.positions.at(position * 2 + 1) ?? attributes.y }
  }, { attributes: ['x', 'y'] })
}

function workerChannel(receive: (frame: SimulationFrame) => void): SimulationChannel | null {
  if (typeof Worker === 'undefined') return null
  const worker = new Worker(new URL('./graphLayout.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<SimulationFrame>) => receive(event.data)
  return { send: (command) => worker.postMessage(command), close: () => worker.terminate() }
}

/** Without workers (tests, very old webviews) the same loop runs on the main thread in timer slices. */
function inlineChannel(receive: (frame: SimulationFrame) => void): SimulationChannel {
  const loop = new SimulationLoop(receive, {
    later: (step, delayMs) => {
      const timer = setTimeout(step, delayMs)
      return () => clearTimeout(timer)
    },
    now: () => performance.now(),
  })
  return { send: (command) => loop.handle(command), close: () => loop.dispose() }
}

/** Called after positions land in the graph; `resting` is true on the last frame before the graph stops. */
export type LayoutFrameListener = (resting: boolean) => void

/** Coalesces simulation frames to at most one graph update per animation frame. */
function frameApplier(graph: Graph, held: () => string | null, onFrame: LayoutFrameListener) {
  let latest: SimulationFrame | null = null
  let request: number | null = null
  const flush = () => {
    request = null
    const frame = latest
    latest = null
    if (!frame) return
    applyPositions(graph, frame, held())
    onFrame(frame.resting)
  }
  return {
    receive: (frame: SimulationFrame) => {
      latest = frame
      request ??= requestAnimationFrame(flush)
    },
    cancel: () => {
      if (request !== null) cancelAnimationFrame(request)
      request = null
    },
  }
}

export function createLayoutController(graph: Graph, initialForces: GraphForces, onFrame: LayoutFrameListener = () => undefined): LayoutController {
  let held: string | null = null
  let forces = initialForces
  const applier = frameApplier(graph, () => held, onFrame)
  const channel = workerChannel(applier.receive) ?? inlineChannel(applier.receive)
  return {
    load: (alpha) => channel.send({ type: 'load', snapshot: snapshotGraph(graph), forces, alpha }),
    hold: (node, x, y) => {
      held = node
      channel.send({ type: 'hold', id: node, x, y })
    },
    release: (node) => {
      held = null
      channel.send({ type: 'release', id: node })
    },
    setForces: (next) => {
      forces = next
      channel.send({ type: 'forces', forces })
    },
    dispose: () => {
      applier.cancel()
      channel.close()
    },
  }
}
