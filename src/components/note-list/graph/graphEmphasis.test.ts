import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { DIM_EDGE_OPACITY, DIM_NODE_OPACITY, emphasisTarget, neighbourhood, neighboursIn, strongNodes } from './graphEmphasis'
import { EDGE_ANIMATION_LIMIT, easeOutCubic, EMPHASIS_DURATION_MS, EmphasisAnimator, type FrameScheduler } from './graphEmphasisAnimator'

const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
]

function chain(): Graph {
  const graph = new Graph({ type: 'undirected' })
  for (const node of ['a', 'b', 'c', 'd']) graph.addNode(node)
  graph.addEdgeWithKey('ab', 'a', 'b')
  graph.addEdgeWithKey('bc', 'b', 'c')
  return graph
}

/** Frames that run only when the test says so, with a clock the test moves. */
function manualFrames() {
  let time = 0
  let pending: Array<() => void> = []
  const frames: FrameScheduler = {
    request: (callback) => pending.push(callback),
    cancel: () => {
      pending = []
    },
    now: () => time,
  }
  const advance = (ms: number) => {
    time += ms
    const run = pending
    pending = []
    for (const callback of run) callback()
  }
  return { frames, advance, pending: () => pending.length }
}

describe('graph emphasis', () => {
  it('finds a note and its direct neighbours, either link direction', () => {
    const neighbours = neighboursIn(edges)
    expect([...neighbourhood(neighbours, 'b')].sort()).toEqual(['a', 'b', 'c'])
    expect([...neighbourhood(neighbours, 'd')]).toEqual(['d'])
  })

  it('lets the hovered note win over the focused one, and emphasises nothing without either', () => {
    const neighbours = neighboursIn(edges)
    expect(strongNodes(neighbours, { hovered: null, focused: null })).toBeNull()
    expect([...(strongNodes(neighbours, { hovered: null, focused: 'a' }) ?? [])].sort()).toEqual(['a', 'b'])
    expect([...(strongNodes(neighbours, { hovered: 'c', focused: 'a' }) ?? [])].sort()).toEqual(['b', 'c'])
  })

  it('keeps the strong set and the links between them at full strength and dims the rest', () => {
    const target = emphasisTarget(new Set(['a', 'b']), 'a')
    expect([target.nodeFade('a'), target.nodeFade('c')]).toEqual([1, DIM_NODE_OPACITY])
    expect([target.nodeAccent('a'), target.nodeAccent('b')]).toEqual([1, 0])
    expect([target.edgeFade('a', 'b'), target.edgeFade('b', 'c')]).toEqual([1, DIM_EDGE_OPACITY])
    const none = emphasisTarget(null, null)
    expect([none.nodeFade('c'), none.edgeFade('b', 'c')]).toEqual([1, 1])
  })

  it('eases out and clamps', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('animates toward the target and retargets from wherever the graph is', () => {
    const graph = chain()
    const { frames, advance, pending } = manualFrames()
    const animator = new EmphasisAnimator(graph, frames)
    animator.animateTo(emphasisTarget(new Set(['a', 'b']), 'a'), false)
    advance(EMPHASIS_DURATION_MS / 2)
    const halfway = graph.getNodeAttribute('d', 'fade') as number
    expect(halfway).toBeLessThan(1)
    expect(halfway).toBeGreaterThan(DIM_NODE_OPACITY)
    expect(graph.getNodeAttribute('a', 'accent')).toBeGreaterThan(0.5)
    animator.animateTo(emphasisTarget(null, null), false)
    advance(1)
    expect(graph.getNodeAttribute('d', 'fade')).toBeCloseTo(halfway, 1)
    advance(EMPHASIS_DURATION_MS)
    expect(graph.getNodeAttribute('d', 'fade')).toBe(1)
    expect(graph.getEdgeAttribute('bc', 'fade')).toBe(1)
    expect(pending()).toBe(0)
  })

  it('jumps straight to the target with reduced motion', () => {
    const graph = chain()
    const animator = new EmphasisAnimator(graph, manualFrames().frames)
    animator.animateTo(emphasisTarget(new Set(['a', 'b']), null), true)
    expect(graph.getNodeAttribute('c', 'fade')).toBeCloseTo(DIM_NODE_OPACITY)
    expect(graph.getEdgeAttribute('bc', 'fade')).toBeCloseTo(DIM_EDGE_OPACITY)
    animator.stop()
  })

  it('switches links once per transition on big graphs while the notes ease', () => {
    const graph = new Graph({ type: 'undirected' })
    for (let index = 0; index <= EDGE_ANIMATION_LIMIT + 1; index += 1) graph.addNode(String(index))
    for (let index = 1; index <= EDGE_ANIMATION_LIMIT + 1; index += 1) graph.addEdge('0', String(index))
    graph.addNode('far')
    graph.addNode('farther')
    graph.addEdgeWithKey('faredge', 'far', 'farther')
    const { frames, advance } = manualFrames()
    new EmphasisAnimator(graph, frames).animateTo(emphasisTarget(new Set(['0', '1']), null), false)
    advance(EMPHASIS_DURATION_MS / 4)
    expect(graph.getEdgeAttribute('faredge', 'fade')).toBeCloseTo(DIM_EDGE_OPACITY)
    expect(graph.getNodeAttribute('far', 'fade')).toBeGreaterThan(DIM_NODE_OPACITY)
  })
})
