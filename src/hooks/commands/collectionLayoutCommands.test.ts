import { describe, expect, it, vi } from 'vitest'
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
