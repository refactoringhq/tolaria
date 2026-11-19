import { act, fireEvent, render, screen } from '@testing-library/react'
import type Graph from 'graphology'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import GraphCanvas from './GraphCanvas'
import { type GraphNodeModel, LABEL_BUDGET, labelledNodes, type VisibleGraph } from './graphModel'

type Handler = (payload: { node: string }) => void

const { renderers, settleGraph, zoomGraph, fitGraph, revealNode } = vi.hoisted(() => ({
  renderers: [] as Array<{ graph: Graph; handlers: Map<string, Set<Handler>>; states: Map<string, { isHighlighted: boolean }>; kill: () => void; emit: (event: string, payload?: { node: string }) => void }>,
  settleGraph: vi.fn(() => () => undefined),
  zoomGraph: vi.fn(),
  fitGraph: vi.fn(),
  revealNode: vi.fn(),
}))

vi.mock('./graphLayoutClient', () => ({ settleGraph }))
vi.mock('./graphRenderer', () => {
  return {
    zoomGraph,
    fitGraph,
    revealNode,
    // WebGL is not available in JSDOM: a fake renderer keeps the event and state API the canvas uses.
    createGraphRenderer: (graph: Graph) => {
      const handlers = new Map<string, Set<Handler>>()
      const states = new Map<string, { isHighlighted: boolean }>()
      const renderer = {
        graph,
        handlers,
        states,
        kill: vi.fn(),
        emit: (event: string, payload = { node: '' }) => {
          for (const handler of handlers.get(event) ?? []) handler(payload)
        },
        getGraph: () => graph,
        on: (event: string, handler: Handler) => handlers.set(event, (handlers.get(event) ?? new Set()).add(handler)),
        off: (event: string, handler: Handler) => handlers.get(event)?.delete(handler),
        getNodeDisplayData: (node: string) => (graph.hasNode(node) ? { size: 6 } : undefined),
        graphToViewport: (point: { x: number; y: number }) => point,
        getNodeState: (node: string) => states.get(node) ?? { isHighlighted: false },
        setNodeState: (node: string, state: { isHighlighted: boolean }) => states.set(node, state),
      }
      renderers.push(renderer)
      return renderer
    },
  }
})

const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', isA: 'Project' })
const ada = makeEntry({ path: '/v/ada.md', title: 'Ada', isA: 'Person', icon: '🙂' })

function node(entry: typeof launch, degree: number): GraphNodeModel {
  return { id: entry.path, entry, typeKey: entry.isA ?? '', degree, size: 5 + degree }
}

const visible: VisibleGraph = {
  nodes: [node(launch, 1), node(ada, 1)],
  edges: [{ id: 'e', source: launch.path, target: ada.path, kind: 'relationship', labels: ['owner'] }],
}

function renderCanvas(overrides: Partial<Parameters<typeof GraphCanvas>[0]> = {}) {
  const props = {
    visible,
    showLabels: true,
    typeEntryMap: {},
    selectedNotePath: null,
    panelOpen: false,
    locale: 'en' as const,
    onOpen: vi.fn(),
    onBackgroundClick: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<GraphCanvas {...props} />) }
}

function lastRenderer() {
  const renderer = renderers.at(-1)
  if (!renderer) throw new Error('No renderer')
  return renderer
}

describe('GraphCanvas', () => {
  beforeEach(() => {
    renderers.length = 0
    for (const mock of [settleGraph, zoomGraph, fitGraph, revealNode]) mock.mockClear()
  })

  it('mirrors the visible notes into the renderer graph and settles the layout once', () => {
    const { rerender, props } = renderCanvas()
    const { graph } = lastRenderer()
    expect(graph.order).toBe(2)
    expect(graph.getEdgeAttribute('e', 'kind')).toBe('relationship')
    expect(settleGraph).toHaveBeenCalledTimes(1)
    rerender(<GraphCanvas {...props} visible={{ ...visible }} />)
    expect(settleGraph).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('application')).toHaveAccessibleName('Graph of 2 notes')
  })

  it('opens a pressed node with the click event and closes the panel on an empty-canvas click', () => {
    const { props } = renderCanvas()
    const stage = screen.getByTestId('graph-stage')
    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10 })
    act(() => lastRenderer().emit('downNode', { node: ada.path }))
    fireEvent.click(stage, { clientX: 11, clientY: 10 })
    expect(props.onOpen).toHaveBeenCalledWith(ada, expect.objectContaining({ type: 'click' }))

    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10 })
    act(() => lastRenderer().emit('downStage'))
    fireEvent.click(stage, { clientX: 10, clientY: 10 })
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1)
  })

  it('treats a drag as a pan, never a click', () => {
    const { props } = renderCanvas()
    const stage = screen.getByTestId('graph-stage')
    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10 })
    act(() => lastRenderer().emit('downNode', { node: ada.path }))
    fireEvent.click(stage, { clientX: 80, clientY: 40 })
    expect(props.onOpen).not.toHaveBeenCalled()
    expect(props.onBackgroundClick).not.toHaveBeenCalled()
  })

  it('zooms and fits from the corner buttons without closing the panel', () => {
    const { props } = renderCanvas()
    fireEvent.click(screen.getByTestId('graph-zoom-in'))
    fireEvent.click(screen.getByTestId('graph-zoom-out'))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to fit' }))
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'in')
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'out')
    expect(fitGraph).toHaveBeenCalledTimes(1)
    expect(props.onBackgroundClick).not.toHaveBeenCalled()
  })

  it('labels nodes with their icon and title, marks the open note, and hides labels when off', () => {
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    expect(screen.getAllByTestId('graph-label').map((label) => label.textContent)).toEqual(['🙂Ada', 'Launch'])
    expect(screen.getAllByTestId('graph-label-icon')).toHaveLength(2)
    expect(screen.getByText('Ada').closest('[data-testid="graph-label"]')).toHaveAttribute('data-selected', 'true')
    expect(lastRenderer().states.get(ada.path)).toEqual({ isHighlighted: true })
    rerender(<GraphCanvas {...props} selectedNotePath={ada.path} showLabels={false} />)
    expect(screen.queryByTestId('graph-labels')).not.toBeInTheDocument()
  })

  it('places labels under their node after each frame', () => {
    renderCanvas()
    const renderer = lastRenderer()
    renderer.graph.mergeNodeAttributes(launch.path, { x: 100, y: 50 })
    act(() => renderer.emit('afterRender'))
    const label = screen.getByText('Launch').closest('[data-testid="graph-label"]') as HTMLElement
    expect(label.style.transform).toBe('translate(100px, 60px) translateX(-50%)')
  })

  it('pans the open note out from under the editor panel once the panel opens', () => {
    const shell = document.createElement('div')
    const panel = document.createElement('div')
    panel.className = 'app__editor'
    Object.defineProperty(panel, 'offsetWidth', { value: 300 })
    shell.getBoundingClientRect = () => ({ right: 1000 }) as DOMRect
    shell.appendChild(panel)
    document.body.appendChild(shell)
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    expect(revealNode).not.toHaveBeenCalled()
    screen.getByTestId('graph-stage').getBoundingClientRect = () => ({ left: 250, width: 750 }) as DOMRect
    rerender(<GraphCanvas {...props} selectedNotePath={ada.path} panelOpen />)
    expect(revealNode).toHaveBeenCalledWith(expect.anything(), ada.path, 450)
    shell.remove()
  })

  it('zooms, fits and closes the panel from the keyboard while focus is inside the graph', () => {
    const { props } = renderCanvas()
    const canvas = screen.getByRole('application')
    fireEvent.keyDown(canvas, { key: '+' })
    fireEvent.keyDown(canvas, { key: '-' })
    fireEvent.keyDown(canvas, { key: '0' })
    fireEvent.keyDown(canvas, { key: 'Escape' })
    fireEvent.keyDown(canvas, { key: '0', ctrlKey: true })
    fireEvent.keyDown(canvas, { key: 'a' })
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'in')
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'out')
    expect(fitGraph).toHaveBeenCalledTimes(1)
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1)
  })

  it('kills the renderer on unmount', () => {
    const { unmount } = renderCanvas()
    const renderer = lastRenderer()
    unmount()
    expect(renderer.kill).toHaveBeenCalled()
  })

  it('labels only the best-connected notes, always including the open one', () => {
    const many = Array.from({ length: LABEL_BUDGET + 5 }, (_, index) => node(makeEntry({ path: `/v/${index}.md`, title: `N${index}` }), index))
    const labelled = labelledNodes(many, '/v/0.md')
    expect(labelled).toHaveLength(LABEL_BUDGET + 1)
    expect(labelled[0].entry.title).toBe(`N${LABEL_BUDGET + 4}`)
    expect(labelled.at(-1)?.entry.title).toBe('N0')
  })
})
