import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteListHeader } from './NoteListHeader'

const baseProps = {
  title: 'Inbox',
  typeDocument: null,
  isEntityView: false,
  listSort: 'modified' as const,
  listDirection: 'desc' as const,
  customProperties: [],
  searchVisible: false,
  search: '',
  isSearching: false,
  searchInputRef: { current: null },
  onSortChange: vi.fn(),
  onCreateNote: vi.fn(),
  onOpenType: vi.fn(),
  onToggleSearch: vi.fn(),
  onSearchChange: vi.fn(),
  onSearchKeyDown: vi.fn(),
}

function renderHeader(overrides: Partial<Parameters<typeof NoteListHeader>[0]> = {}) {
  return render(<NoteListHeader {...baseProps} {...overrides} />)
}

describe('NoteListHeader title space', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the list title visible when the sidebar is collapsed', () => {
    renderHeader({ sidebarCollapsed: true })

    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument()
  })

  it('uses the latest create callback after focus-driven state updates settle', async () => {
    vi.useFakeTimers()
    const staleCreate = vi.fn()
    const latestCreate = vi.fn()
    const { rerender } = renderHeader({ onCreateNote: staleCreate })
    const rawEditor = document.createElement('div')
    rawEditor.className = 'raw-editor-codemirror'
    const rawInput = document.createElement('textarea')
    rawEditor.append(rawInput)
    document.body.append(rawEditor)
    rawInput.focus()

    const createButton = screen.getByRole('button', { name: 'Create new note' })
    fireEvent.mouseDown(createButton)
    fireEvent.click(createButton)
    rerender(<NoteListHeader {...baseProps} onCreateNote={latestCreate} />)
    await act(async () => vi.runAllTimersAsync())

    expect(staleCreate).not.toHaveBeenCalled()
    expect(latestCreate).toHaveBeenCalledOnce()
    rawEditor.remove()
    vi.useRealTimers()
  })
})
