import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { DEFAULT_GRAPH_SETTINGS } from '../../../collections/graphSettings'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import GraphCanvas from './GraphCanvas'
import { lastRenderer } from './graphCanvasDoubles'
import type { GraphNodeModel, VisibleGraph } from './graphModel'

/** Fixtures and helpers shared by the GraphCanvas tests (the doubles live in graphCanvasDoubles). */
interface Press {
  sigmaEvent: 'downNode' | 'downStage'
  node?: string
  release: { clientX: number; clientY: number }
}

export const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', isA: 'Project' })
export const ada = makeEntry({ path: '/v/ada.md', title: 'Ada', isA: 'Person', icon: '🙂' })
export const loner = makeEntry({ path: '/v/loner.md', title: 'Loner', isA: null })

function node(entry: typeof launch, degree: number): GraphNodeModel {
  return { id: entry.path, entry, typeKey: entry.isA ?? '', degree, size: 5 + degree }
}

export const visible: VisibleGraph = {
  nodes: [node(launch, 1), node(ada, 1), node(loner, 0)],
  edges: [{ id: 'e', source: launch.path, target: ada.path, kind: 'relationship', labels: ['owner'], direction: 'forward' }],
}

export function renderCanvas(overrides: Partial<Parameters<typeof GraphCanvas>[0]> = {}) {
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


/** A press on the stage that sigma reports on a node or on empty space, released at `release`. */
export function pressStage({ sigmaEvent, node = '', release }: Press) {
  const stage = screen.getByTestId('graph-stage')
  fireEvent.pointerDown(stage, { clientX: 10, clientY: 10 })
  act(() => lastRenderer().emit(sigmaEvent, { node }))
  fireEvent.click(stage, release)
}

/** Moves nodes in the renderer graph and lets one frame pass. */
export function placeNodes(positions: Record<string, { x: number; y: number }>) {
  const renderer = lastRenderer()
  for (const [id, position] of Object.entries(positions)) renderer.graph.mergeNodeAttributes(id, position)
  act(() => renderer.emit('afterRender'))
}

export function label(title: string): HTMLElement {
  const element = screen.getByText(title).closest<HTMLElement>('[data-testid="graph-label"]')
  if (!element) throw new Error(`No label for ${title}`)
  return element
}

/** The app shell with the slid-in editor panel: `panelWidth` wide, flush with the shell's right edge. */
export function mountEditorPanel(panelWidth: number, shellRight: number): HTMLElement {
  const shell = document.createElement('div')
  shell.getBoundingClientRect = () => ({ right: shellRight }) as DOMRect
  const panel = document.createElement('div')
  panel.className = 'app__editor'
  Object.defineProperty(panel, 'offsetWidth', { value: panelWidth })
  shell.appendChild(panel)
  document.body.appendChild(shell)
  return shell
}

export async function setTheme(theme: string | null) {
  await act(async () => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    await Promise.resolve()
  })
}

/** Lets `count` animation frames pass, one after another. */
export function nextFrames(count = 20): Promise<void> {
  const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return Array.from({ length: count }).reduce<Promise<void>>((previous) => previous.then(frame), Promise.resolve())
}

