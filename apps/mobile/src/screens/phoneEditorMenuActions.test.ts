import { expect, it, vi } from 'vitest'
import { phoneEditorMenuActions, runPhoneEditorMenuAction } from './phoneEditorMenuActions'

vi.mock('../i18n/mobileText', () => ({ mobileText: (key: string) => key }))

it('exposes only the requested phone editor actions and reflects note state', () => {
  const actions = phoneEditorMenuActions(true, false)

  expect(actions.map(({ id }) => id)).toEqual(['favorite', 'source', 'properties', 'rename', 'move', 'find', 'pdf', 'delete'])
  expect(actions[0]).toMatchObject({
    state: 'on',
    title: 'command.note.removeFavorite',
  })
  expect(actions[1]).toMatchObject({ title: 'editor.toolbar.rawOpen' })
  expect(actions[7]?.attributes).toEqual({ destructive: true })
})
it('routes each menu action to its existing workspace callback', () => {
  const callbacks = {
    favorite: vi.fn(),
    toggleSourceMode: vi.fn(),
    openProperties: vi.fn(),
    rename: vi.fn(),
    move: vi.fn(),
    find: vi.fn(),
    exportPdf: vi.fn(),
    delete: vi.fn(),
  }

  for (const action of ['favorite', 'source', 'properties', 'rename', 'move', 'find', 'pdf', 'delete']) {
    runPhoneEditorMenuAction(action, callbacks)
  }

  for (const callback of Object.values(callbacks)) expect(callback).toHaveBeenCalledOnce()
  expect(() => runPhoneEditorMenuAction('unsupported', callbacks)).not.toThrow()
})
