import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/graphSettings'
import GraphCanvas from './GraphCanvas'
import { lastRenderer, resetGraphCanvasDoubles } from './graphCanvasDoubles'
import { ada, label, launch, loner, placeNodes, renderCanvas } from './graphCanvasTestSupport'

vi.mock('../../../lib/telemetry', async () => (await import('./graphCanvasDoubles')).telemetryModule)
vi.mock('./graphLayoutClient', async () => (await import('./graphCanvasDoubles')).layoutClientModule)
vi.mock('./graphCamera', async () => (await import('./graphCanvasDoubles')).cameraModule)
vi.mock('./graphRenderer', async () => (await import('./graphCanvasDoubles')).rendererModule)

describe('GraphCanvas labels', () => {
  beforeEach(resetGraphCanvasDoubles)

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
})
