import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../../hooks/appCommandDispatcher'
import { trackEvent } from '../../lib/telemetry'
import { NoteListHeader } from './NoteListHeader'

vi.mock('../../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

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

describe('NoteListHeader expand sidebar button', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear()
  })

  it('keeps the expand-sidebar button hidden when the sidebar is open', () => {
    renderHeader({ sidebarCollapsed: false })

    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument()
  })

  it('dispatches the full-layout app command from the collapsed note-list header', () => {
    const commandListener = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, commandListener)

    try {
      renderHeader({ sidebarCollapsed: true })

      fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

      expect(commandListener).toHaveBeenCalledTimes(1)
      expect((commandListener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe(APP_COMMAND_IDS.viewAll)
      expect(trackEvent).toHaveBeenCalledWith('sidebar_expanded_from_note_list_header')
    } finally {
      window.removeEventListener(APP_COMMAND_EVENT_NAME, commandListener)
    }
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
