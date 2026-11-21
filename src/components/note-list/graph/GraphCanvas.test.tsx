import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/graphSettings'
import GraphCanvas from './GraphCanvas'
import { createLayoutController, fitGraph, lastRenderer, layout, renderers, resetGraphCanvasDoubles, zoomGraph } from './graphCanvasDoubles'
import { renderCanvas, setTheme, visible } from './graphCanvasTestSupport'

vi.mock('../../../lib/telemetry', async () => (await import('./graphCanvasDoubles')).telemetryModule)
vi.mock('./graphLayoutClient', async () => (await import('./graphCanvasDoubles')).layoutClientModule)
vi.mock('./graphCamera', async () => (await import('./graphCanvasDoubles')).cameraModule)
vi.mock('./graphRenderer', async () => (await import('./graphCanvasDoubles')).rendererModule)

describe('GraphCanvas', () => {
  beforeEach(resetGraphCanvasDoubles)

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
