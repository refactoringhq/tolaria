import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { presentationFromViewDefinition } from '../../collections/presentationConfig'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import type { SidebarSelection, ViewFile } from '../../types'
import { CollectionLayoutBody } from './CollectionLayoutBody'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

function props(selection: SidebarSelection = { kind: 'filter', filter: 'all' }, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  } as never
}

function savedView(presentation: ViewFile['definition']['presentation']): ViewFile {
  return {
    filename: 'active-projects.yml',
    definition: { name: 'Active Projects', icon: null, color: null, sort: 'modified', listPropertiesDisplay: ['priority'], filters: { all: [] }, presentation },
  }
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

  it('preserves Kanban View settings while List is active and restores them after reopening', () => {
    const view = savedView({ type: 'kanban', groupBy: 'status', properties: ['owner'], columnOrder: ['Done', 'Doing'] })
    const selection: SidebarSelection = { kind: 'view', filename: view.filename }
    const updateView = vi.fn()
    const visibleEntries = [makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing', properties: { owner: 'Luca', priority: 'High' } })]
    const initialProps = props(selection, {
      presentation: presentationFromViewDefinition(view.definition),
      views: [view],
      onUpdateViewDefinition: updateView,
      visibleEntries,
    })

    const firstMount = render(<CollectionLayoutBody {...initialProps} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), { target: { value: 'list' } })

    const savedPresentation = updateView.mock.calls[0]?.[1]?.presentation
    expect(savedPresentation).toEqual(expect.objectContaining({
      type: 'list',
      properties: ['priority'],
      kanbanConfig: { groupBy: 'status', properties: ['owner'], columnOrder: ['Done', 'Doing'] },
    }))

    firstMount.unmount()
    const reopenedView: ViewFile = {
      ...view,
      definition: { ...view.definition, presentation: savedPresentation },
    }
    render(<CollectionLayoutBody {...props(selection, {
      presentation: presentationFromViewDefinition(reopenedView.definition),
      views: [reopenedView],
      onUpdateViewDefinition: updateView,
      visibleEntries,
    })} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), { target: { value: 'kanban' } })

    expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveValue('status')
    fireEvent.click(screen.getByText('Card fields'))
    expect(screen.getByRole('checkbox', { name: 'owner' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'priority' })).not.toBeChecked()
    expect(updateView.mock.calls[1]?.[1]?.presentation).toEqual(expect.objectContaining({
      type: 'kanban',
      groupBy: 'status',
      properties: ['owner'],
      columnOrder: ['Done', 'Doing'],
    }))
  })

  it('switches layouts through the keyboard and command event', () => {
    render(<CollectionLayoutBody {...props({ kind: 'filter', filter: 'all' })} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('laputa:toggle-collection-layout')))

    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })
})
