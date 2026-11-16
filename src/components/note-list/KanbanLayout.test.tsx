import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import { KanbanLayout } from './KanbanLayout'

const entries = [
  makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing', properties: { owner: 'Ada' } }),
  makeEntry({ path: '/vault/b.md', title: 'Beta', status: null }),
]

function renderBoard(overrides: Partial<Parameters<typeof KanbanLayout>[0]> = {}) {
  const props = {
    entries,
    groupBy: 'status',
    properties: ['owner'],
    columnOrder: [],
    onColumnOrderChange: vi.fn(),
    onOpen: vi.fn(),
    onMove: vi.fn(),
    locale: 'en' as const,
    typeEntryMap: {},
    selectedNotePath: '/vault/a.md',
    ...overrides,
  }
  render(<KanbanLayout {...props} />)
  return props
}

describe('KanbanLayout', () => {
  it('shows every value as a column, including notes without a value', () => {
    renderBoard()
    const columns = screen.getAllByTestId('kanban-column')
    expect(columns.map((column) => column.dataset.kanbanColumn)).toEqual(['Doing', ''])
    expect(within(columns[1]).getByText('No value')).toBeInTheDocument()
    expect(within(columns[1]).getByText('Beta')).toBeInTheDocument()
  })

  it('renders card fields with the note-list property chips', () => {
    renderBoard()
    const alphaCard = screen.getByRole('button', { name: 'Alpha' })
    expect(within(alphaCard).getByTestId('property-chips')).toHaveTextContent('Ada')
    expect(alphaCard).toHaveAttribute('data-selected', 'true')
  })

  it('opens a card on click and on Enter', () => {
    const props = renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    expect(props.onOpen).toHaveBeenCalledWith(entries[0], expect.anything())
    fireEvent.keyDown(screen.getByRole('button', { name: 'Beta' }), { key: 'Enter' })
    expect(props.onOpen).toHaveBeenLastCalledWith(entries[1], expect.anything())
  })

  it('hides board and column scrollbars without disabling scrolling', () => {
    renderBoard({ columnOrder: ['', 'Doing'] })
    const board = screen.getByTestId('kanban-board')
    expect(board).toHaveClass('kanban-scroll', 'overflow-x-auto')
    expect(screen.getAllByTestId('kanban-column').map((column) => column.dataset.kanbanColumn)).toEqual(['', 'Doing'])
  })
})
