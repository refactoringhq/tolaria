import { forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'

/** The four Obsidian-style force sliders, as stored in the graph settings. */
export interface GraphForces {
  centerForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
}

/** What the simulation needs from the visible graph: node ids, their positions and the edges by index. */
export interface GraphLayoutSnapshot {
  ids: string[]
  /** x, y per node, interleaved. */
  positions: number[]
  /** Source and target node indexes per edge, interleaved. */
  edges: number[]
}

type LayoutNode = SimulationNodeDatum & { id: string }
type LayoutLink = SimulationLinkDatum<LayoutNode>

/** Below this energy the graph is at rest and no more ticks (or frames) are spent. */
export const REST_ALPHA = 0.005
/** Energy kept while a node is held, so the rest of the graph keeps following it. */
export const DRAG_ALPHA_TARGET = 0.3
/** Fast decay: a released node and its neighbours come to rest in about two seconds. */
const ALPHA_DECAY = 0.03
const VELOCITY_DECAY = 0.4
const REPEL_SCALE = 30
const CENTER_SCALE = 0.1
const REPEL_DISTANCE_MAX = 2000

/** d3's default link strength (1 / the smaller degree of the two ends), scaled by the Link force setting. */
function linkStrength(forces: GraphForces, degrees: readonly number[]) {
  const degreeOf = (end: LayoutLink['source']) => degrees.at((end as LayoutNode).index ?? 0) ?? 1
  return (link: LayoutLink) => forces.linkForce / Math.max(1, Math.min(degreeOf(link.source), degreeOf(link.target)))
}

function edgeLinks(snapshot: GraphLayoutSnapshot): LayoutLink[] {
  const links: LayoutLink[] = []
  for (let edge = 0; edge + 1 < snapshot.edges.length; edge += 2) {
    const source = snapshot.edges[edge]
    const target = snapshot.edges[edge + 1]
    if (source !== target && source < snapshot.ids.length && target < snapshot.ids.length) links.push({ source, target })
  }
  return links
}

function nodeDegrees(count: number, links: readonly LayoutLink[]): number[] {
  const degrees = new Array<number>(count).fill(0)
  for (const { source, target } of links) {
    degrees[source as number] += 1
    degrees[target as number] += 1
  }
  return degrees
}

/**
 * A d3-force simulation over the visible graph: links pull, every node repels every other (Barnes-Hut),
 * and a gentle pull to the origin keeps islands nearby. It never runs its own timer: the caller ticks it
 * and stops once it is at rest.
 */
export class GraphSimulation {
  private readonly simulation: Simulation<LayoutNode, LayoutLink>
  private readonly nodes: LayoutNode[]
  private readonly links: LayoutLink[]
  private readonly degrees: number[]

  constructor(snapshot: GraphLayoutSnapshot, forces: GraphForces, alpha: number) {
    this.nodes = snapshot.ids.map((id, index) => ({ id, x: snapshot.positions[index * 2] ?? 0, y: snapshot.positions[index * 2 + 1] ?? 0 }))
    this.links = edgeLinks(snapshot)
    this.degrees = nodeDegrees(this.nodes.length, this.links)
    this.simulation = forceSimulation(this.nodes).stop().alpha(alpha).alphaMin(REST_ALPHA).alphaDecay(ALPHA_DECAY).velocityDecay(VELOCITY_DECAY)
    this.applyForces(forces)
  }

  get ids(): string[] {
    return this.nodes.map((node) => node.id)
  }

  applyForces(forces: GraphForces) {
    const center = forces.centerForce * CENTER_SCALE
    this.simulation
      .force('link', forceLink<LayoutNode, LayoutLink>(this.links).distance(forces.linkDistance).strength(linkStrength(forces, this.degrees)))
      .force('charge', forceManyBody<LayoutNode>().strength(-forces.repelForce * REPEL_SCALE).distanceMax(REPEL_DISTANCE_MAX))
      .force('x', forceX<LayoutNode>(0).strength(center))
      .force('y', forceY<LayoutNode>(0).strength(center))
  }

  /** Wakes the graph up with at least this much energy (moving a slider, a new note). */
  reheat(alpha: number) {
    this.simulation.alpha(Math.max(this.simulation.alpha(), alpha))
  }

  /** Holds a node under the pointer; the rest of the graph keeps moving around it. */
  hold(index: number, x: number, y: number) {
    const node = this.nodes.at(index)
    if (!node) return
    node.fx = x
    node.fy = y
    this.simulation.alphaTarget(DRAG_ALPHA_TARGET)
    this.reheat(DRAG_ALPHA_TARGET)
  }

  /** Lets a held node go: it rejoins the simulation (not pinned) and the graph settles. */
  release(index: number) {
    const node = this.nodes.at(index)
    if (node) {
      node.fx = null
      node.fy = null
    }
    this.simulation.alphaTarget(0)
  }

  isResting(): boolean {
    return this.simulation.alphaTarget() === 0 && this.simulation.alpha() < REST_ALPHA
  }

  alpha(): number {
    return this.simulation.alpha()
  }

  tick() {
    this.simulation.tick()
  }

  positions(): number[] {
    const positions: number[] = []
    for (const node of this.nodes) positions.push(node.x ?? 0, node.y ?? 0)
    return positions
  }
}
