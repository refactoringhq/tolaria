import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry, renderNoteList } from '../test-utils/noteListTestUtils'

function openContextMenuForTitle(title: string) {
  const row = screen.getByText(title).closest('[data-note-path]')
  expect(row).not.toBeNull()
  fireEvent.contextMenu(row!, { clientX: 120, clientY: 160 })
}

describe('NoteList note context menu', () => {
  it('shows note actions when a regular note is right-clicked', () => {
    renderNoteList({
      onToggleFavorite: vi.fn(),
      onToggleOrganized: vi.fn(),
      onArchiveNote: vi.fn(),
      onDeleteNote: vi.fn(),
      onRevealFile: vi.fn(),
      onCopyFilePath: vi.fn(),
      onOpenInNewWindow: vi.fn(),
      canChangeNoteType: () => true,
      onChangeNoteType: vi.fn(),
      canMoveNoteToFolder: () => true,
      onMoveNoteToFolder: vi.fn(),
    })

    openContextMenuForTitle('Build Laputa App')

    expect(screen.getByTestId('note-context-menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add to Favorites/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark as Organized/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change Note Type…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Note to Folder…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal in Finder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy file path' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive Note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete Note/ })).toBeInTheDocument()
  })

  it('runs row-specific note actions from the context menu', () => {
    const onToggleFavorite = vi.fn()
    const onArchiveNote = vi.fn()
    const onDeleteNote = vi.fn()
    const onOpenInNewWindow = vi.fn()

    const { props } = renderNoteList({
      onToggleFavorite,
      onArchiveNote,
      onDeleteNote,
      onOpenInNewWindow,
    })

    openContextMenuForTitle('Build Laputa App')
    fireEvent.click(screen.getByTestId('note-context-toggle-favorite'))
    expect(onToggleFavorite).toHaveBeenCalledWith(props.entries[0].path)

    openContextMenuForTitle('Build Laputa App')
    fireEvent.click(screen.getByTestId('note-context-toggle-archive'))
    expect(onArchiveNote).toHaveBeenCalledWith(props.entries[0].path)

    openContextMenuForTitle('Build Laputa App')
    fireEvent.click(screen.getByTestId('note-context-delete'))
    expect(onDeleteNote).toHaveBeenCalledWith(props.entries[0].path)

    openContextMenuForTitle('Build Laputa App')
    fireEvent.click(screen.getByTestId('note-context-open-window'))
    expect(onOpenInNewWindow).toHaveBeenCalledWith(props.entries[0])
  })

  it('shows stateful labels for favorited, organized, and archived notes', () => {
    renderNoteList({
      entries: [
        makeEntry({
          archived: true,
          favorite: true,
          organized: true,
          path: '/vault/note/stateful.md',
          title: 'Stateful Note',
          filename: 'stateful.md',
        }),
      ],
      selection: { kind: 'filter', filter: 'archived' },
      noteListFilter: 'archived',
      onToggleFavorite: vi.fn(),
      onToggleOrganized: vi.fn(),
      onUnarchiveNote: vi.fn(),
    })

    openContextMenuForTitle('Stateful Note')

    expect(screen.getByRole('button', { name: /Remove from Favorites/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark as Unorganized/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unarchive Note' })).toBeInTheDocument()
  })
})
