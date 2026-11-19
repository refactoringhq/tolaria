import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { applyPositions, graphFromSnapshot, layoutIterations, readPositions, runLayoutBatch, snapshotGraph } from './graphLayoutSteps'

function triangle(): Graph {
  const graph = new Graph({ type: 'undirected' })
  graph.addNode('a', { x: 0, y: 0 })
  graph.addNode('b', { x: 1, y: 0 })
  graph.addNode('c', { x: 0, y: 1 })
  graph.addNode('orphan', { x: 50, y: 50 })
  graph.addEdge('a', 'b')
  graph.addEdge('b', 'c')
  return graph
}

describe('graphLayoutSteps', () => {
  it('round-trips a graph through the worker snapshot', () => {
    const snapshot = snapshotGraph(triangle(), 30)
    expect(snapshot).toEqual({ ids: ['a', 'b', 'c', 'orphan'], positions: [0, 0, 1, 0, 0, 1, 50, 50], edges: [0, 1, 1, 2], iterations: 30 })
    const rebuilt = graphFromSnapshot(snapshot)
    expect(rebuilt.order).toBe(4)
    expect(rebuilt.size).toBe(2)
    expect(readPositions(rebuilt, snapshot.ids)).toEqual(snapshot.positions)
  })

  it('moves nodes with force iterations and pulls orphans toward the cluster', () => {
    const graph = triangle()
    runLayoutBatch(graph, 50)
    const orphan = graph.getNodeAttributes('orphan')
    expect(Math.hypot(orphan.x, orphan.y)).toBeLessThan(Math.hypot(50, 50))
    expect(graph.getNodeAttributes('a')).not.toEqual({ x: 0, y: 0 })
  })

  it('writes positions back, ignoring notes that left the graph meanwhile', () => {
    const graph = triangle()
    graph.dropNode('c')
    applyPositions(graph, ['a', 'c', 'b'], [5, 6, 7, 8, 9, 10])
    expect(graph.getNodeAttributes('a')).toMatchObject({ x: 5, y: 6 })
    expect(graph.getNodeAttributes('b')).toMatchObject({ x: 9, y: 10 })
  })

  it('runs fewer iterations for bigger graphs and for re-settling after an update', () => {
    expect(layoutIterations(50, false)).toBeGreaterThan(layoutIterations(800, false))
    expect(layoutIterations(800, false)).toBeGreaterThan(layoutIterations(5_000, false))
    expect(layoutIterations(50, true)).toBeLessThan(layoutIterations(5_000, false))
  })
})
