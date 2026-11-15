import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import { KanbanLayout } from './KanbanLayout'

describe('KanbanLayout', () => {
  it('keeps missing values visible, renders card fields, opens cards, and writes dropped groups', () => {
    const onOpen = vi.fn()
    const onMove = vi.fn()
    const onColumnOrderChange = vi.fn()
    const entries = [
      makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing', properties: { owner: 'Ada' } }),
      makeEntry({ path: '/vault/b.md', title: 'Beta', status: null }),
    ]
    render(<KanbanLayout entries={entries} groupBy="status" properties={['owner']} columnOrder={[]} onColumnOrderChange={onColumnOrderChange} onOpen={onOpen} onMove={onMove} locale="en" />)

    expect(screen.getByText('owner: Ada')).toBeInTheDocument()
    expect(screen.getByText('No value')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }))
    expect(onOpen).toHaveBeenCalledWith(entries[0], expect.anything())

    fireEvent.pointerDown(screen.getByRole('button', { name: /Alpha/ }), { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(screen.getByRole('region', { name: 'No value, 1 notes' }), { pointerId: 1, clientX: 200, clientY: 10 })
    expect(onMove).toHaveBeenCalledWith(entries[0], null)
    fireEvent.click(screen.getByRole('region', { name: 'No value, 1 notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Doing column right' }))
    expect(onColumnOrderChange).toHaveBeenCalledWith(['', 'Doing'])
  })
})
