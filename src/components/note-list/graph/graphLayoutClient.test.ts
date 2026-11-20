import Graph from 'graphology'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyPositions, createLayoutController, snapshotGraph } from './graphLayoutClient'

const forces = { centerForce: 0.5, repelForce: 10, linkForce: 1, linkDistance: 80 }

function triangle(): Graph {
  const graph = new Graph({ type: 'undirected' })
  graph.addNode('a', { x: 0, y: 0 })
  graph.addNode('b', { x: 1, y: 0 })
  graph.addNode('c', { x: 0, y: 1 })
  graph.addEdge('a', 'b')
  graph.addEdge('b', 'c')
  return graph
}

describe('graph layout client', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('snapshots ids, positions and edges by index', () => {
    expect(snapshotGraph(triangle())).toEqual({ ids: ['a', 'b', 'c'], positions: [0, 0, 1, 0, 0, 1], edges: [0, 1, 1, 2] })
  })

  it('applies positions, skipping the held node and notes that left', () => {
    const graph = triangle()
    applyPositions(graph, { ids: ['a', 'b', 'gone'], positions: [10, 20, 30, 40, 50, 60], resting: false }, 'b')
    expect(graph.getNodeAttributes('a')).toMatchObject({ x: 10, y: 20 })
    expect(graph.getNodeAttributes('b')).toMatchObject({ x: 1, y: 0 })
  })

  it('runs the live layout without a worker and reports the frame it comes to rest', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const graph = triangle()
    const onFrame = vi.fn()
    const controller = createLayoutController(graph, forces, onFrame)
    controller.load(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onFrame).toHaveBeenLastCalledWith(true)
    expect(Math.hypot(graph.getNodeAttribute('a', 'x') - graph.getNodeAttribute('b', 'x'), graph.getNodeAttribute('a', 'y') - graph.getNodeAttribute('b', 'y'))).toBeGreaterThan(30)
    graph.mergeNodeAttributes('a', { x: 500, y: 500 })
    controller.hold('a', 500, 500)
    await vi.advanceTimersByTimeAsync(500)
    expect(graph.getNodeAttributes('a')).toMatchObject({ x: 500, y: 500 })
    expect(onFrame).toHaveBeenLastCalledWith(false)
    controller.release('a')
    controller.setForces({ ...forces, linkDistance: 150 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onFrame).toHaveBeenLastCalledWith(true)
    controller.dispose()
  })
})
