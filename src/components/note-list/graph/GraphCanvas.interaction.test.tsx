import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GraphCanvas from './GraphCanvas'
import { fitGraph, lastRenderer, layout, resetGraphCanvasDoubles, revealNodes, trackEvent, zoomGraph } from './graphCanvasDoubles'
import { DIM_NODE_OPACITY } from './graphEmphasis'
import { ada, label, launch, loner, mountEditorPanel, nextFrames, placeNodes, pressStage, renderCanvas } from './graphCanvasTestSupport'

vi.mock('../../../lib/telemetry', async () => (await import('./graphCanvasDoubles')).telemetryModule)
vi.mock('./graphLayoutClient', async () => (await import('./graphCanvasDoubles')).layoutClientModule)
vi.mock('./graphCamera', async () => (await import('./graphCanvasDoubles')).cameraModule)
vi.mock('./graphRenderer', async () => (await import('./graphCanvasDoubles')).rendererModule)

describe('GraphCanvas interaction', () => {
  beforeEach(resetGraphCanvasDoubles)

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
    renderCanvas({ selectedNotePath: ada.path, panelOpen: true })
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

  const closings = [
    { name: 'the panel closes', closed: { panelOpen: false }, reopened: { panelOpen: true } },
    { name: 'no note is selected', closed: { selectedNotePath: null }, reopened: { selectedNotePath: launch.path } },
  ]

  it.each(closings)('leaves focus once $name for good, but not through a brief blip', ({ closed, reopened }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { rerender, props } = renderCanvas({ selectedNotePath: launch.path, panelOpen: true })
      pressStage({ sigmaEvent: 'downNode', node: launch.path, release: { clientX: 10, clientY: 10 } })
      rerender(<GraphCanvas {...props} {...closed} />)
      act(() => vi.advanceTimersByTime(100))
      rerender(<GraphCanvas {...props} {...reopened} />)
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByRole('application')).toHaveAttribute('data-focused-node', launch.path)
      rerender(<GraphCanvas {...props} {...closed} />)
      act(() => vi.advanceTimersByTime(400))
      expect(screen.getByRole('application')).not.toHaveAttribute('data-focused-node')
    } finally {
      vi.useRealTimers()
    }
  })

  it('can take keyboard focus so its shortcuts are reachable with Tab', () => {
    renderCanvas()
    expect(screen.getByRole('application')).toHaveAttribute('tabindex', '0')
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
})
