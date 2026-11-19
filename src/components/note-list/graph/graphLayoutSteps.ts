import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'

/** What the layout needs from the visible graph: node ids, their current positions and the edges by index. */
export interface GraphLayoutSnapshot {
  ids: string[]
  /** x, y per node, interleaved. */
  positions: number[]
  /** Source and target node indexes per edge, interleaved. */
  edges: number[]
  iterations: number
}

/** Force iterations run between two position updates, so the graph settles visibly instead of jumping. */
export const LAYOUT_BATCH = 10

/** Fewer iterations on bigger graphs: they cost more each and need less to read well at step 1 scale. */
export function layoutIterations(nodeCount: number, settled: boolean): number {
  if (settled) return 60
  if (nodeCount <= 200) return 300
  if (nodeCount <= 1000) return 200
  return 120
}

export function snapshotGraph(graph: Graph, iterations: number): GraphLayoutSnapshot {
  const ids = graph.nodes()
  const index = new Map(ids.map((id, position) => [id, position]))
  const positions: number[] = []
  for (const id of ids) positions.push(graph.getNodeAttribute(id, 'x') ?? 0, graph.getNodeAttribute(id, 'y') ?? 0)
  const edges: number[] = []
  graph.forEachEdge((_edge, _attributes, source, target) => {
    edges.push(index.get(source) ?? 0, index.get(target) ?? 0)
  })
  return { ids, positions, edges, iterations }
}

function numberAt(values: readonly number[], index: number): number {
  return values.at(index) ?? 0
}

/** The two note ids of the edge at `edge` (an even index into the interleaved edge list). */
function edgeEnds(snapshot: GraphLayoutSnapshot, edge: number): [string, string] | null {
  const source = snapshot.ids.at(numberAt(snapshot.edges, edge))
  const target = snapshot.ids.at(numberAt(snapshot.edges, edge + 1))
  return source && target && source !== target ? [source, target] : null
}

export function graphFromSnapshot(snapshot: GraphLayoutSnapshot): Graph {
  const graph = new Graph({ type: 'undirected', multi: false })
  snapshot.ids.forEach((id, position) => {
    graph.addNode(id, { x: numberAt(snapshot.positions, position * 2), y: numberAt(snapshot.positions, position * 2 + 1) })
  })
  for (let edge = 0; edge < snapshot.edges.length; edge += 2) {
    const ends = edgeEnds(snapshot, edge)
    if (ends && !graph.hasEdge(...ends)) graph.addEdge(...ends)
  }
  return graph
}

/**
 * Strong gravity keeps orphans and small islands near the main cluster instead of drifting off-screen;
 * the scaling ratio keeps linked notes apart enough for their labels.
 */
export function runLayoutBatch(graph: Graph, iterations = LAYOUT_BATCH) {
  const settings = { ...forceAtlas2.inferSettings(graph), strongGravityMode: true, gravity: 1, scalingRatio: 20, slowDown: 2 }
  forceAtlas2.assign(graph, { iterations, settings })
}

export function readPositions(graph: Graph, ids: readonly string[]): number[] {
  const positions: number[] = []
  for (const id of ids) positions.push(graph.getNodeAttribute(id, 'x'), graph.getNodeAttribute(id, 'y'))
  return positions
}

/** Writes worker positions back in one graph update, skipping notes that left the graph meanwhile. */
export function applyPositions(graph: Graph, ids: readonly string[], positions: readonly number[]) {
  const index = new Map(ids.map((id, position) => [id, position]))
  graph.updateEachNodeAttributes((node, attributes) => {
    const position = index.get(node)
    if (position === undefined) return attributes
    return { ...attributes, x: positions.at(position * 2) ?? attributes.x, y: positions.at(position * 2 + 1) ?? attributes.y }
  }, { attributes: ['x', 'y'] })
}
