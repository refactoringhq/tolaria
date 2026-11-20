import Graph from 'graphology'
import type { Attributes } from 'graphology-types'
import { describe, expect, it, vi } from 'vitest'
import { createGraphRenderer, type GraphDisplay } from './graphRenderer'

type StyleFunction = (attributes: Attributes, state?: Record<string, boolean>) => unknown

interface CapturedOptions {
  styles: { nodes: Record<string, StyleFunction | unknown>; edges: Record<string, StyleFunction | unknown>; stage: { cursor: (state: Record<string, boolean>) => string } }
  settings: Record<string, unknown>
}

const { constructed } = vi.hoisted(() => ({ constructed: [] as CapturedOptions[] }))

// WebGL is not available in JSDOM: capture the options sigma would be built with.
vi.mock('sigma', () => ({
  default: function FakeSigma(_graph: Graph, _container: HTMLElement, options: CapturedOptions) {
    constructed.push(options)
  },
}))
vi.mock('sigma/rendering', () => ({ extremityArrow: () => ({ name: 'arrow' }), layerDashed: () => ({ name: 'dashed' }) }))

function build(display: GraphDisplay) {
  createGraphRenderer(new Graph(), document.createElement('div'), {
    colors: () => ({ highlight: 'rgba(0, 0, 255, 0.35)', accent: 'rgb(0, 0, 255)' }),
    display: () => display,
  })
  const options = constructed.at(-1)
  if (!options) throw new Error('No renderer')
  const style = (kind: 'nodes' | 'edges', key: string) => options.styles[kind][key] as StyleFunction
  return { options, style }
}

describe('graph renderer styles', () => {
  it('draws in fixed graph coordinates with node drag on', () => {
    const { options } = build({ nodeSizeScale: 1, linkThickness: 1, showArrows: false })
    expect(options.settings).toMatchObject({ autoRescale: false, enableNodeDrag: true, renderLabels: false })
    expect(options.styles.stage.cursor({ isPanning: true })).toBe('grabbing')
    expect(options.styles.stage.cursor({})).toBe('grab')
  })

  it('sizes nodes by the display scale, the open note and the hover accent', () => {
    const { style } = build({ nodeSizeScale: 2, linkThickness: 1, showArrows: false })
    const size = style('nodes', 'size')
    expect(size({ size: 5 })).toBe(10)
    expect(size({ size: 5, highlighted: true })).toBe(15)
    expect(size({ size: 5, accent: 1 })).toBeCloseTo(13)
    expect(style('nodes', 'opacity')({ fade: 0.12 })).toBe(0.12)
    expect(style('nodes', 'opacity')({})).toBe(1)
    expect(style('nodes', 'depth')({ accent: 0.5 })).toBe('topNodes')
    expect(style('nodes', 'depth')({})).toBe('nodes')
  })

  it('blends the hovered node toward the accent color', () => {
    const { style } = build({ nodeSizeScale: 1, linkThickness: 1, showArrows: false })
    const color = style('nodes', 'color')
    expect(color({ color: 'rgba(255, 0, 0, 1)' })).toBe('rgba(255, 0, 0, 1)')
    expect(color({ color: 'rgba(255, 0, 0, 1)', accent: 1 })).toBe('rgba(0, 0, 255, 1)')
  })

  it('scales link thickness and draws arrowheads the way links point, only when arrows are on', () => {
    const off = build({ nodeSizeScale: 1, linkThickness: 2, showArrows: false })
    expect(off.style('edges', 'size')({ size: 1.5 })).toBe(3)
    expect(off.style('edges', 'head')({ direction: 'forward' })).toBe('none')
    const on = build({ nodeSizeScale: 1, linkThickness: 1, showArrows: true })
    expect(on.style('edges', 'head')({ direction: 'forward' })).toBe('arrow')
    expect(on.style('edges', 'tail')({ direction: 'forward' })).toBe('none')
    expect(on.style('edges', 'tail')({ direction: 'backward' })).toBe('arrow')
    expect([on.style('edges', 'head')({ direction: 'both' }), on.style('edges', 'tail')({ direction: 'both' })]).toEqual(['arrow', 'arrow'])
    expect(on.style('edges', 'opacity')({ fade: 0.06 })).toBe(0.06)
  })
})
