import { afterEach, describe, expect, it, vi } from 'vitest'
import { SET_COLLECTION_LAYOUT_EVENT } from '../../collections/collectionTypes'
import { buildCollectionLayoutCommands } from './collectionLayoutCommands'

describe('collection layout commands', () => {
  it('offers List, Kanban and Calendar and switches the note list through the layout event', () => {
    const commands = buildCollectionLayoutCommands()
    expect(commands.map((command) => command.label)).toEqual(['Show Note List as List', 'Show Note List as Kanban', 'Show Note List as Calendar'])
    const listener = vi.fn()
    window.addEventListener(SET_COLLECTION_LAYOUT_EVENT, listener)
    commands[2].execute()
    window.removeEventListener(SET_COLLECTION_LAYOUT_EVENT, listener)
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe('calendar')
  })
})

describe('graph layout command', () => {
  afterEach(() => localStorage.removeItem('ff_graph_layout'))

  it('is offered only while the graph_layout flag is on', () => {
    localStorage.setItem('ff_graph_layout', 'false')
    expect(buildCollectionLayoutCommands().map((command) => command.id)).not.toContain('show-collection-as-graph')
    localStorage.setItem('ff_graph_layout', 'true')
    const graph = buildCollectionLayoutCommands().find((command) => command.id === 'show-collection-as-graph')
    expect(graph?.label).toBe('Show Note List as Graph')
  })
})
