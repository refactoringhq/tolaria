import { act, fireEvent, render, screen } from '@testing-library/react'
import type Graph from 'graphology'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/graphSettings'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import GraphCanvas from './GraphCanvas'
import { DIM_NODE_OPACITY } from './graphEmphasis'
import type { GraphNodeModel, VisibleGraph } from './graphModel'

type Handler = (payload: { node: string }) => void

interface Press {
  sigmaEvent: 'downNode' | 'downStage'
  node?: string
  release: { clientX: number; clientY: number }
}

interface FakeRenderer {
  graph: Graph
  handlers: Map<string, Set<Handler>>
  camera: { ratio: number }
  kill: () => void
  refresh: () => void
  scheduleRender: () => void
  emit: (event: string, payload?: { node: string }) => void
}

const { renderers, layout, createLayoutController, zoomGraph, fitGraph, revealNodes, trackEvent } = vi.hoisted(() => {
  const layout = { load: vi.fn(), hold: vi.fn(), release: vi.fn(), setForces: vi.fn(), dispose: vi.fn() }
  return {
    renderers: [] as FakeRenderer[],
    layout,
    createLayoutController: vi.fn(() => layout),
    zoomGraph: vi.fn(),
    fitGraph: vi.fn(),
    revealNodes: vi.fn(),
    trackEvent: vi.fn(),
  }
})

vi.mock('../../../lib/telemetry', () => ({ trackEvent }))
vi.mock('./graphLayoutClient', () => ({ createLayoutController, FIRST_LAYOUT_ALPHA: 1, RELAYOUT_ALPHA: 0.3 }))
vi.mock('./graphCamera', () => ({ zoomGraph, fitGraph, revealNodes }))
vi.mock('./graphRenderer', () => ({
  // WebGL is not available in JSDOM: a fake renderer keeps the event and state API the canvas uses.
  createGraphRenderer: (graph: Graph) => {
    const handlers = new Map<string, Set<Handler>>()
    const camera = { ratio: 1 }
    const renderer = {
      graph,
      handlers,
      camera,
      kill: vi.fn(),
      emit: (event: string, payload = { node: '' }) => {
        for (const handler of handlers.get(event) ?? []) handler(payload)
      },
      getGraph: () => graph,
      on: (event: string, handler: Handler) => handlers.set(event, (handlers.get(event) ?? new Set()).add(handler)),
      off: (event: string, handler: Handler) => handlers.get(event)?.delete(handler),
      getNodeDisplayData: (node: string) => (graph.hasNode(node) ? { size: 6 } : undefined),
      graphToViewport: (point: { x: number; y: number }) => point,
      getDimensions: () => ({ width: 800, height: 600 }),
      getSetting: () => (ratio: number) => Math.sqrt(ratio),
      getCamera: () => camera,
      refresh: vi.fn(),
      scheduleRender: vi.fn(),
    }
    renderers.push(renderer)
    return renderer
  },
}))

const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', isA: 'Project' })
const ada = makeEntry({ path: '/v/ada.md', title: 'Ada', isA: 'Person', icon: '🙂' })
const loner = makeEntry({ path: '/v/loner.md', title: 'Loner', isA: null })

function node(entry: typeof launch, degree: number): GraphNodeModel {
  return { id: entry.path, entry, typeKey: entry.isA ?? '', degree, size: 5 + degree }
}

const visible: VisibleGraph = {
  nodes: [node(launch, 1), node(ada, 1), node(loner, 0)],
  edges: [{ id: 'e', source: launch.path, target: ada.path, kind: 'relationship', labels: ['owner'], direction: 'forward' }],
}

function renderCanvas(overrides: Partial<Parameters<typeof GraphCanvas>[0]> = {}) {
  const props = {
    visible,
    settings: DEFAULT_GRAPH_SETTINGS,
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

/** A press on the stage that sigma reports on a node or on empty space, released at `release`. */
function pressStage({ sigmaEvent, node = '', release }: Press) {
  const stage = screen.getByTestId('graph-stage')
  fireEvent.pointerDown(stage, { clientX: 10, clientY: 10 })
  act(() => lastRenderer().emit(sigmaEvent, { node }))
  fireEvent.click(stage, release)
}

/** Moves nodes in the renderer graph and lets one frame pass. */
function placeNodes(positions: Record<string, { x: number; y: number }>) {
  const renderer = lastRenderer()
  for (const [id, position] of Object.entries(positions)) renderer.graph.mergeNodeAttributes(id, position)
  act(() => renderer.emit('afterRender'))
}

function label(title: string): HTMLElement {
  const element = screen.getByText(title).closest<HTMLElement>('[data-testid="graph-label"]')
  if (!element) throw new Error(`No label for ${title}`)
  return element
}

/** The app shell with the slid-in editor panel: `panelWidth` wide, flush with the shell's right edge. */
function mountEditorPanel(panelWidth: number, shellRight: number): HTMLElement {
  const shell = document.createElement('div')
  shell.getBoundingClientRect = () => ({ right: shellRight }) as DOMRect
  const panel = document.createElement('div')
  panel.className = 'app__editor'
  Object.defineProperty(panel, 'offsetWidth', { value: panelWidth })
  shell.appendChild(panel)
  document.body.appendChild(shell)
  return shell
}

async function setTheme(theme: string | null) {
  await act(async () => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    await Promise.resolve()
  })
}

async function nextFrames(count = 20) {
  for (let frame = 0; frame < count; frame += 1) await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
}

describe('GraphCanvas', () => {
  beforeEach(() => {
    renderers.length = 0
    for (const mock of [zoomGraph, fitGraph, revealNodes, trackEvent, createLayoutController, ...Object.values(layout)]) mock.mockClear()
  })

  it('mirrors the visible notes into the renderer graph and starts the live layout once', () => {
    const { rerender, props } = renderCanvas()
    const { graph } = lastRenderer()
    expect(graph.order).toBe(3)
    expect(graph.getEdgeAttribute('e', 'kind')).toBe('relationship')
    expect(graph.getEdgeAttribute('e', 'direction')).toBe('forward')
    expect(layout.load).toHaveBeenCalledTimes(1)
    expect(layout.load).toHaveBeenCalledWith(1)
    rerender(<GraphCanvas {...props} visible={{ ...visible }} />)
    expect(layout.load).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('application')).toHaveAccessibleName('Graph of 3 notes')
  })

  it('reheats the running layout gently when notes come or go', () => {
    const { rerender, props } = renderCanvas()
    rerender(<GraphCanvas {...props} visible={{ nodes: visible.nodes.slice(0, 2), edges: visible.edges }} />)
    expect(layout.load).toHaveBeenLastCalledWith(0.3)
  })

  it('sends force changes to the live layout and display changes to the renderer', () => {
    const { rerender, props } = renderCanvas()
    vi.mocked(lastRenderer().refresh).mockClear()
    rerender(<GraphCanvas {...props} settings={{ ...DEFAULT_GRAPH_SETTINGS, repelForce: 4, showArrows: true }} />)
    expect(layout.setForces).toHaveBeenCalledWith(expect.objectContaining({ repelForce: 4 }))
    expect(lastRenderer().refresh).toHaveBeenCalled()
  })

  it('opens and focuses a clicked node, and leaves focus on an empty-canvas click', () => {
    const { props } = renderCanvas()
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 11, clientY: 10 } })
    expect(props.onOpen).toHaveBeenCalledWith(ada, expect.objectContaining({ type: 'click' }))
    expect(screen.getByRole('application')).toHaveAttribute('data-focused-node', ada.path)
    expect(trackEvent).toHaveBeenCalledWith('graph_node_focused', { neighbour_count: 1 })
    pressStage({ sigmaEvent: 'downStage', release: { clientX: 10, clientY: 10 } })
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('application')).not.toHaveAttribute('data-focused-node')
  })

  it('fades everything outside the focused neighbourhood and keeps its labels at any zoom', async () => {
    renderCanvas({ selectedNotePath: ada.path })
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 10, clientY: 10 } })
    await nextFrames()
    const { graph } = lastRenderer()
    expect(graph.getNodeAttribute(loner.path, 'fade')).toBeCloseTo(DIM_NODE_OPACITY)
    expect(graph.getNodeAttribute(launch.path, 'fade')).toBeCloseTo(1)
    expect(label('Loner')).toHaveAttribute('data-emphasis', 'dim')
    lastRenderer().camera.ratio = 40
    placeNodes({ [launch.path]: { x: 100, y: 50 }, [ada.path]: { x: 300, y: 50 }, [loner.path]: { x: 500, y: 50 } })
    expect(label('Launch').style.display).toBe('')
    expect(label('Loner').style.display).toBe('none')
  })

  it('leaves focus with Escape even when the keyboard focus is elsewhere', () => {
    const { props } = renderCanvas({ selectedNotePath: ada.path })
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 10, clientY: 10 } })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('application')).not.toHaveAttribute('data-focused-node')
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1)
  })

  it('leaves focus when the editor panel closes', () => {
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 10, clientY: 10 } })
    rerender(<GraphCanvas {...props} selectedNotePath={null} />)
    expect(screen.getByRole('application')).not.toHaveAttribute('data-focused-node')
  })

  it('treats a press that travels as a pan or drag, never a click', () => {
    const { props } = renderCanvas()
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 80, clientY: 40 } })
    expect(props.onOpen).not.toHaveBeenCalled()
    expect(props.onBackgroundClick).not.toHaveBeenCalled()
  })

  it('holds a dragged node in the live layout and lets it go on release', () => {
    renderCanvas()
    const renderer = lastRenderer()
    renderer.graph.mergeNodeAttributes(ada.path, { x: 40, y: 60 })
    act(() => renderer.emit('nodeDragStart', { node: ada.path }))
    renderer.graph.mergeNodeAttributes(ada.path, { x: 70, y: 90 })
    act(() => renderer.emit('nodeDrag', { node: ada.path }))
    act(() => renderer.emit('nodeDragEnd', { node: ada.path }))
    expect(layout.hold).toHaveBeenNthCalledWith(1, ada.path, 40, 60)
    expect(layout.hold).toHaveBeenNthCalledWith(2, ada.path, 70, 90)
    expect(layout.release).toHaveBeenCalledWith(ada.path)
    expect(trackEvent).toHaveBeenCalledWith('graph_node_dragged', { node_count: 3 })
  })

  it('emphasises a hovered node and its neighbours, then lets go after a short grace period', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      renderCanvas()
      act(() => lastRenderer().emit('enterNode', { node: ada.path }))
      expect(screen.getByRole('application')).toHaveAttribute('data-hovered-node', ada.path)
      expect(label('Ada')).toHaveAttribute('data-emphasis', 'hover')
      expect(label('Launch').dataset.emphasis ?? '').toBe('')
      expect(label('Loner')).toHaveAttribute('data-emphasis', 'dim')
      act(() => lastRenderer().emit('leaveNode', { node: ada.path }))
      act(() => lastRenderer().emit('enterNode', { node: launch.path }))
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole('application')).toHaveAttribute('data-hovered-node', launch.path)
      act(() => lastRenderer().emit('leaveNode', { node: launch.path }))
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole('application')).not.toHaveAttribute('data-hovered-node')
    } finally {
      vi.useRealTimers()
    }
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

  it('labels every note with its icon and title, marks the open note, and hides labels when off', () => {
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    expect(screen.getAllByTestId('graph-label').map((chip) => chip.textContent)).toEqual(['🙂Ada', 'Launch', 'Loner'])
    expect(screen.getAllByTestId('graph-label-icon')).toHaveLength(3)
    expect(label('Ada')).toHaveAttribute('data-selected', 'true')
    const { graph } = lastRenderer()
    expect(graph.getNodeAttribute(ada.path, 'highlighted')).toBe(true)
    vi.mocked(lastRenderer().refresh).mockClear()
    rerender(<GraphCanvas {...props} selectedNotePath={launch.path} />)
    expect(lastRenderer().refresh).toHaveBeenCalledTimes(1)
    expect(graph.getNodeAttribute(ada.path, 'highlighted')).toBe(false)
    expect(graph.getNodeAttribute(launch.path, 'highlighted')).toBe(true)
    rerender(<GraphCanvas {...props} selectedNotePath={launch.path} settings={{ ...DEFAULT_GRAPH_SETTINGS, showLabels: false }} />)
    expect(screen.queryByTestId('graph-labels')).not.toBeInTheDocument()
  })

  it('draws a new ring at once and again on the next animation frame', async () => {
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    const renderer = lastRenderer()
    vi.mocked(renderer.refresh).mockClear()
    rerender(<GraphCanvas {...props} selectedNotePath={launch.path} />)
    expect(renderer.refresh).toHaveBeenCalledTimes(1)
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(renderer.scheduleRender).toHaveBeenCalled()
  })

  it('places labels under their node after each frame', () => {
    renderCanvas()
    placeNodes({ [launch.path]: { x: 100, y: 50 }, [ada.path]: { x: 300, y: 50 }, [loner.path]: { x: 500, y: 50 } })
    expect(label('Launch')).toHaveProperty('style.transform', 'translate(100px, 61px)')
  })

  it('drops unforced labels when zoomed out past the fade threshold, keeping the open note', () => {
    renderCanvas({ selectedNotePath: ada.path })
    lastRenderer().camera.ratio = 40
    placeNodes({ [launch.path]: { x: 100, y: 50 }, [ada.path]: { x: 300, y: 50 }, [loner.path]: { x: 500, y: 50 } })
    expect(label('Launch').style.display).toBe('none')
    expect(label('Ada').style.display).toBe('')
    expect(label('Ada').style.opacity).toBe('1')
  })

  it('hides a lower-ranked label that would cover a higher-ranked one', () => {
    renderCanvas()
    for (const chip of screen.getAllByTestId('graph-label')) chip.dataset.width = '80'
    placeNodes({ [launch.path]: { x: 100, y: 50 }, [ada.path]: { x: 110, y: 52 }, [loner.path]: { x: 600, y: 300 } })
    expect([label('Launch').style.display, label('Ada').style.display].sort()).toEqual(['', 'none'])
  })

  it('eases the open note out from under the editor panel once the panel opens', () => {
    const shell = mountEditorPanel(300, 1000)
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    expect(revealNodes).not.toHaveBeenCalled()
    screen.getByTestId('graph-stage').getBoundingClientRect = () => ({ left: 250, width: 750 }) as DOMRect
    rerender(<GraphCanvas {...props} selectedNotePath={ada.path} panelOpen />)
    expect(revealNodes).toHaveBeenCalledWith(expect.anything(), [ada.path], 450)
    shell.remove()
  })

  it('reveals the whole focused neighbourhood beside the panel', () => {
    const { rerender, props } = renderCanvas({ selectedNotePath: ada.path })
    pressStage({ sigmaEvent: 'downNode', node: ada.path, release: { clientX: 10, clientY: 10 } })
    rerender(<GraphCanvas {...props} panelOpen />)
    expect(revealNodes).toHaveBeenLastCalledWith(expect.anything(), [ada.path, launch.path], expect.any(Number))
  })

  it('zooms, fits and leaves focus from the keyboard while focus is inside the graph', () => {
    const { props } = renderCanvas()
    const canvas = screen.getByRole('application')
    for (const key of [{ key: '+' }, { key: '-' }, { key: '0' }, { key: 'Escape' }, { key: '0', ctrlKey: true }, { key: 'a' }]) fireEvent.keyDown(canvas, key)
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'in')
    expect(zoomGraph).toHaveBeenCalledWith(expect.anything(), 'out')
    expect(fitGraph).toHaveBeenCalledTimes(1)
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1)
  })

  it('recolors on a theme switch without rebuilding the renderer', async () => {
    renderCanvas()
    await setTheme('dark')
    expect(renderers).toHaveLength(1)
    expect(lastRenderer().refresh).toHaveBeenCalled()
    await setTheme(null)
  })

  it('keeps the whole graph in view while the first layout settles, until the user takes over', () => {
    renderCanvas()
    const onFrame = (createLayoutController.mock.calls[0] as unknown as [unknown, unknown, (resting: boolean) => void])[2]
    act(() => onFrame(false))
    expect(fitGraph).toHaveBeenLastCalledWith(expect.anything(), true)
    fireEvent.wheel(screen.getByTestId('graph-stage'))
    act(() => onFrame(false))
    expect(fitGraph).toHaveBeenCalledTimes(1)
  })

  it('stops fitting once the first layout comes to rest', () => {
    renderCanvas()
    const onFrame = (createLayoutController.mock.calls[0] as unknown as [unknown, unknown, (resting: boolean) => void])[2]
    act(() => onFrame(true))
    act(() => onFrame(false))
    expect(fitGraph).toHaveBeenCalledTimes(1)
  })

  it('kills the renderer and stops the layout on unmount', () => {
    const { unmount } = renderCanvas()
    const renderer = lastRenderer()
    unmount()
    expect(renderer.kill).toHaveBeenCalled()
    expect(layout.dispose).toHaveBeenCalled()
  })
})
