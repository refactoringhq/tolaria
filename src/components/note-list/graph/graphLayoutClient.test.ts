import Graph from 'graphology'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { settleGraph } from './graphLayoutClient'

function pair(): Graph {
  const graph = new Graph({ type: 'undirected' })
  graph.addNode('a', { x: 0, y: 0 })
  graph.addNode('b', { x: 10, y: 0 })
  graph.addEdge('a', 'b')
  return graph
}

describe('settleGraph', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('settles on the main thread in slices when workers are unavailable, then stops', () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', undefined)
    const graph = pair()
    settleGraph(graph, 20)
    vi.advanceTimersByTime(0)
    const afterFirst = graph.getNodeAttributes('b').x
    expect(afterFirst).not.toBe(10)
    vi.advanceTimersByTime(1_000)
    const settled = graph.getNodeAttributes('b').x
    vi.advanceTimersByTime(1_000)
    expect(graph.getNodeAttributes('b').x).toBe(settled)
  })

  it('can be cancelled before it starts', () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', undefined)
    const graph = pair()
    const cancel = settleGraph(graph, 20)
    cancel()
    vi.advanceTimersByTime(1_000)
    expect(graph.getNodeAttributes('b').x).toBe(10)
  })

  it('streams worker positions into the graph and terminates the worker when finished', () => {
    const instances: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: (() => void) | null = null
      posted: unknown[] = []
      terminate = vi.fn()
      constructor() { instances.push(this) }
      postMessage(message: unknown) { this.posted.push(message) }
    }
    vi.stubGlobal('Worker', FakeWorker)
    const graph = pair()
    settleGraph(graph, 20)
    const worker = instances[0]
    const request = worker.posted[0] as { requestId: number; snapshot: { ids: string[] } }
    expect(request.snapshot.ids).toEqual(['a', 'b'])
    worker.onmessage?.({ data: { requestId: request.requestId + 1, ids: ['a'], positions: [9, 9], finished: false } } as MessageEvent)
    expect(graph.getNodeAttributes('a')).toMatchObject({ x: 0, y: 0 })
    worker.onmessage?.({ data: { requestId: request.requestId, ids: ['a', 'b'], positions: [1, 2, 3, 4], finished: true } } as MessageEvent)
    expect(graph.getNodeAttributes('b')).toMatchObject({ x: 3, y: 4 })
    expect(worker.terminate).toHaveBeenCalled()
  })
})
