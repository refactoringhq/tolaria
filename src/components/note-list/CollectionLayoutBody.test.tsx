import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import { CollectionLayoutBody } from './CollectionLayoutBody'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

function props(selection: { kind: 'filter'; filter: 'all' | 'archived' }) {
  return {
    presentation: { type: 'list', sort: null, properties: [] },
    selection,
    visibleEntries: [makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing' })],
    views: [],
    onUpdateViewDefinition: () => undefined,
    handleClickNote: () => undefined,
    onUpdateTypeSort: () => undefined,
    vaultPath: '/vault',
    locale: 'en',
    listContent: <div data-testid="classic-list">Classic list</div>,
  } as never
}

describe('CollectionLayoutBody', () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({}))

  it('keeps each collection on List until that collection selects another layout', () => {
    const rendered = render(<CollectionLayoutBody {...props({ kind: 'filter', filter: 'all' })} />)
    expect(screen.getByTestId('classic-list').parentElement).toHaveClass('flex', 'min-h-0', 'flex-1')
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), { target: { value: 'kanban' } })
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()

    rendered.rerender(<CollectionLayoutBody {...props({ kind: 'filter', filter: 'archived' })} />)
    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
  })

  it('loads and saves non-View layout config through the owning vault', async () => {
    invoke.mockResolvedValueOnce({ 'builtin:all': { type: 'kanban', groupBy: 'status', properties: ['owner'] } })
    const view = render(<CollectionLayoutBody {...props({ kind: 'filter', filter: 'all' })} />)
    await waitFor(() => expect(screen.getByTestId('kanban-board')).toBeInTheDocument())
    expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveValue('status')

    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), { target: { value: 'list' } })

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('save_collection_layout_cmd', expect.objectContaining({
      vaultPath: '/vault',
      collection: 'builtin:all',
      presentation: expect.objectContaining({ type: 'list' }),
    })))
    view.unmount()
  })

  it('switches layouts through the keyboard and command event', () => {
    render(<CollectionLayoutBody {...props({ kind: 'filter', filter: 'all' })} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('laputa:toggle-collection-layout')))

    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })
})
