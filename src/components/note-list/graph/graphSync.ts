import Graph from 'graphology'
import type { GraphEdgeModel, VisibleGraph } from './graphModel'
import type { GraphPalette } from './graphPalette'
import type { GraphRenderer } from './graphRenderer'

const RELATIONSHIP_EDGE_SIZE = 1.6
const WIKI_LINK_EDGE_SIZE = 1.2
/** Golden angle: new notes without a placed neighbor spiral out evenly instead of piling up. */
const SPIRAL_ANGLE = 2.399963
const SPIRAL_SPACING = 12
const NEIGHBOR_JITTER = 6

type Position = { x: number; y: number }

function spiralPosition(index: number): Position {
  const radius = SPIRAL_SPACING * Math.sqrt(index + 1)
  return { x: radius * Math.cos(index * SPIRAL_ANGLE), y: radius * Math.sin(index * SPIRAL_ANGLE) }
}

/** Deterministic small offset so two notes added next to the same neighbor don't overlap. */
function jitter(id: string): Position {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  const angle = (hash % 360) * (Math.PI / 180)
  return { x: Math.cos(angle) * NEIGHBOR_JITTER, y: Math.sin(angle) * NEIGHBOR_JITTER }
}

function placedNeighbor(graph: Graph, id: string, edges: readonly GraphEdgeModel[]): Position | null {
  for (const { source, target } of edges) {
    const other = source === id ? target : target === id ? source : null
    if (other && graph.hasNode(other)) return graph.getNodeAttributes(other) as Position
  }
  return null
}

function initialPosition(graph: Graph, id: string, edges: readonly GraphEdgeModel[]): Position {
  const neighbor = placedNeighbor(graph, id, edges)
  if (!neighbor) return spiralPosition(graph.order)
  const offset = jitter(id)
  return { x: neighbor.x + offset.x, y: neighbor.y + offset.y }
}

function edgeAttributes(edge: GraphEdgeModel, palette: GraphPalette) {
  if (edge.kind === 'relationship') {
    const color = palette.relationshipEdge
    return { kind: edge.kind, color, gapColor: color, size: RELATIONSHIP_EDGE_SIZE, label: edge.labels.join(', ') }
  }
  return { kind: edge.kind, color: palette.wikiLinkEdge, gapColor: palette.transparent, size: WIKI_LINK_EDGE_SIZE, label: '' }
}

function dropMissing(graph: Graph, visible: VisibleGraph): boolean {
  const nodeIds = new Set(visible.nodes.map((node) => node.id))
  const edgeIds = new Set(visible.edges.map((edge) => edge.id))
  const staleNodes = graph.filterNodes((node) => !nodeIds.has(node))
  for (const node of staleNodes) graph.dropNode(node)
  const staleEdges = graph.filterEdges((edge) => !edgeIds.has(edge))
  for (const edge of staleEdges) graph.dropEdge(edge)
  return staleNodes.length > 0 || staleEdges.length > 0
}

function upsertNodes(graph: Graph, visible: VisibleGraph, palette: GraphPalette): boolean {
  let added = false
  for (const node of visible.nodes) {
    const attributes = { label: node.entry.title, size: node.size, color: palette.nodeColor(node.entry), typeKey: node.typeKey }
    if (graph.hasNode(node.id)) {
      graph.mergeNodeAttributes(node.id, attributes)
      continue
    }
    graph.addNode(node.id, { ...attributes, ...initialPosition(graph, node.id, visible.edges) })
    added = true
  }
  return added
}

function upsertEdges(graph: Graph, visible: VisibleGraph, palette: GraphPalette): boolean {
  let added = false
  for (const edge of visible.edges) {
    const attributes = edgeAttributes(edge, palette)
    if (graph.hasEdge(edge.id)) {
      graph.mergeEdgeAttributes(edge.id, attributes)
      continue
    }
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, attributes)
    added = true
  }
  return added
}

/**
 * Brings the rendered graph in line with the visible notes and links, keeping the positions of notes
 * that stay. Returns true when notes or links were added or removed, so the caller re-settles the layout.
 */
export function syncGraph(graph: Graph, visible: VisibleGraph, palette: GraphPalette): boolean {
  const dropped = dropMissing(graph, visible)
  const addedNodes = upsertNodes(graph, visible, palette)
  const addedEdges = upsertEdges(graph, visible, palette)
  return dropped || addedNodes || addedEdges
}

export function createGraphModel(): Graph {
  return new Graph({ type: 'undirected', multi: false })
}

/** Marks the note open in the editor panel; every other node loses the mark. */
export function highlightNode(renderer: GraphRenderer, path: string | null) {
  renderer.getGraph().forEachNode((node) => {
    const highlighted = node === path
    if (renderer.getNodeState(node).isHighlighted !== highlighted) renderer.setNodeState(node, { isHighlighted: highlighted })
  })
}
