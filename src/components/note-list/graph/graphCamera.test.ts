import Graph from 'graphology'
import type Sigma from 'sigma'
import { describe, expect, it, vi } from 'vitest'
import { cameraToFit, fitGraph, MIN_CAMERA_RATIO, revealNodes, viewportBox, zoomGraph } from './graphCamera'

/** A renderer whose viewport is graph coordinates scaled by 1 / ratio around the camera (framed = graph / 1000). */
function fakeRenderer(positions: Record<string, { x: number; y: number }>, ratio = 1) {
  const graph = new Graph()
  for (const [id, position] of Object.entries(positions)) graph.addNode(id, position)
  const camera = { ratio, x: 0.5, y: 0.5, setState: vi.fn(), animate: vi.fn(() => Promise.resolve()), zoomIn: vi.fn(() => Promise.resolve()), zoomOut: vi.fn(() => Promise.resolve()) }
  const width = 800
  const height = 600
  const renderer = {
    getGraph: () => graph,
    getCamera: () => camera,
    getDimensions: () => ({ width, height }),
    graphToViewport: ({ x, y }: { x: number; y: number }) => ({ x: (x / 1000 - camera.x) * 1000 / camera.ratio + width / 2, y: (y / 1000 - camera.y) * 1000 / camera.ratio + height / 2 }),
    viewportToFramedGraph: ({ x, y }: { x: number; y: number }) => ({ x: ((x - width / 2) * camera.ratio) / 1000 + camera.x, y: ((y - height / 2) * camera.ratio) / 1000 + camera.y }),
  }
  return { renderer: renderer as unknown as Sigma, camera }
}

describe('graph camera', () => {
  it('measures where nodes sit on screen, ignoring unknown ones', () => {
    const { renderer } = fakeRenderer({ a: { x: 500, y: 500 }, b: { x: 600, y: 400 } })
    const box = viewportBox(renderer, ['a', 'b', 'zzz'])
    expect([box?.left, box?.top, box?.right, box?.bottom].map((value) => Math.round(value ?? -1))).toEqual([400, 200, 500, 300])
    expect(viewportBox(renderer, ['zzz'])).toBeNull()
  })

  it('fits a wide graph by zooming out, centred', () => {
    const { renderer } = fakeRenderer({ a: { x: 0, y: 500 }, b: { x: 2000, y: 500 } })
    const target = cameraToFit(renderer, ['a', 'b'], { width: 800, height: 600 })
    expect(target?.ratio).toBeCloseTo(2000 / (800 - 96))
    expect(target?.x).toBeCloseTo(1)
  })

  it('never zooms in past the fit limit on a tiny graph', () => {
    const { renderer } = fakeRenderer({ a: { x: 500, y: 500 }, b: { x: 501, y: 500 } })
    expect(cameraToFit(renderer, ['a', 'b'], { width: 800, height: 600 })?.ratio).toBeGreaterThan(MIN_CAMERA_RATIO)
  })

  it('centres the fit in the part the editor panel leaves uncovered', () => {
    const { renderer } = fakeRenderer({ a: { x: 400, y: 500 }, b: { x: 600, y: 500 } })
    const target = cameraToFit(renderer, ['a', 'b'], { width: 400, height: 600 }, false)
    expect(target?.ratio).toBe(1)
    expect(target?.x).toBeCloseTo(0.7)
  })

  it('fits instantly or eased, and zooms with the buttons', () => {
    const { renderer, camera } = fakeRenderer({ a: { x: 0, y: 0 }, b: { x: 1000, y: 1000 } })
    fitGraph(renderer, true)
    expect(camera.setState).toHaveBeenCalled()
    fitGraph(renderer)
    expect(camera.animate).toHaveBeenCalled()
    zoomGraph(renderer, 'in')
    zoomGraph(renderer, 'out')
    expect(camera.zoomIn).toHaveBeenCalled()
    expect(camera.zoomOut).toHaveBeenCalled()
  })

  it('moves the camera only when the revealed notes are covered or off-screen', () => {
    const { renderer, camera } = fakeRenderer({ a: { x: 500, y: 500 }, b: { x: 750, y: 500 } })
    revealNodes(renderer, ['a'], 600)
    expect(camera.animate).not.toHaveBeenCalled()
    revealNodes(renderer, ['a', 'b'], 600)
    expect(camera.animate).toHaveBeenCalledTimes(1)
    revealNodes(renderer, ['a', 'b'], 0)
    expect(camera.animate).toHaveBeenCalledTimes(1)
  })
})
