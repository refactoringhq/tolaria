import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import type { VisibleGraph } from './graphModel'
import type { GraphPalette } from './graphPalette'
import { syncGraph } from './graphSync'

const palette: GraphPalette = {
  relationshipEdge: 'rgba(1, 1, 1, 0.7)',
  wikiLinkEdge: 'rgba(1, 1, 1, 0.4)',
  transparent: 'rgba(0, 0, 0, 0)',
  nodeColor: (entry) => (entry.isA === 'Project' ? 'rgba(255, 0, 0, 1)' : 'rgba(128, 128, 128, 1)'),
  dispose: () => undefined,
}

const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', isA: 'Project' })
const ada = makeEntry({ path: '/v/ada.md', title: 'Ada', isA: null })
const guide = makeEntry({ path: '/v/guide.md', title: 'Guide', isA: null })

function node(entry: typeof launch, degree: number) {
  return { id: entry.path, entry, typeKey: entry.isA ?? '', degree, size: 5 + degree }
}

const base: VisibleGraph = {
  nodes: [node(launch, 2), node(ada, 1), node(guide, 1)],
  edges: [
    { id: 'a', source: launch.path, target: ada.path, kind: 'relationship', labels: ['owner', 'projects'] },
    { id: 'b', source: launch.path, target: guide.path, kind: 'wikilink', labels: [] },
  ],
}

describe('syncGraph', () => {
  it('adds notes in type colors and edges as solid relationships or dashed wiki links', () => {
    const graph = new Graph({ type: 'undirected' })
    expect(syncGraph(graph, base, palette)).toBe(true)
    expect(graph.getNodeAttributes(launch.path)).toMatchObject({ label: 'Launch', color: 'rgba(255, 0, 0, 1)', size: 7 })
    expect(graph.getEdgeAttributes('a')).toMatchObject({ kind: 'relationship', color: palette.relationshipEdge, gapColor: palette.relationshipEdge, label: 'owner, projects' })
    expect(graph.getEdgeAttributes('b')).toMatchObject({ kind: 'wikilink', color: palette.wikiLinkEdge, gapColor: palette.transparent })
  })

  it('keeps positions of notes that stay and only reports structure changes', () => {
    const graph = new Graph({ type: 'undirected' })
    syncGraph(graph, base, palette)
    graph.mergeNodeAttributes(launch.path, { x: 42, y: -7 })
    expect(syncGraph(graph, base, palette)).toBe(false)
    expect(graph.getNodeAttributes(launch.path)).toMatchObject({ x: 42, y: -7 })
  })

  it('places a new note next to a placed neighbor and drops notes and edges that left', () => {
    const graph = new Graph({ type: 'undirected' })
    syncGraph(graph, { nodes: [node(launch, 0)], edges: [] }, palette)
    graph.mergeNodeAttributes(launch.path, { x: 100, y: 100 })
    syncGraph(graph, { nodes: [node(launch, 1), node(ada, 1)], edges: [base.edges[0]] }, palette)
    const placed = graph.getNodeAttributes(ada.path)
    expect(Math.hypot(placed.x - 100, placed.y - 100)).toBeLessThan(10)

    expect(syncGraph(graph, { nodes: [node(launch, 0)], edges: [] }, palette)).toBe(true)
    expect(graph.hasNode(ada.path)).toBe(false)
    expect(graph.size).toBe(0)
  })

  it('spreads unconnected new notes on a spiral instead of stacking them', () => {
    const graph = new Graph({ type: 'undirected' })
    syncGraph(graph, { nodes: [node(launch, 0), node(ada, 0), node(guide, 0)], edges: [] }, palette)
    const positions = graph.mapNodes((_node, attributes) => `${Math.round(attributes.x)},${Math.round(attributes.y)}`)
    expect(new Set(positions).size).toBe(3)
  })
})
