import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteList } from './NoteList'
import type { SidebarSelection, VaultEntry } from '../types'
import { allSelection, mockEntries, renderNoteList } from '../test-utils/noteListTestUtils'

const changesSelection: SidebarSelection = { kind: 'filter', filter: 'changes' }
const modifiedFiles = [
  { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
  { path: mockEntries[1].path, relativePath: 'note/facebook-ads-strategy.md', status: 'modified' as const },
]

describe('NoteList changes view', () => {
  it('shows only modified notes in changes view with filenames', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles })
    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('facebook-ads-strategy.md')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    expect(screen.queryByText('Kickoff Meeting')).not.toBeInTheDocument()
  })

  it('shows the changes header title', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles })
    expect(screen.getByText('Changes')).toBeInTheDocument()
  })

  it('shows an empty state when no modified files exist', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles: [] })
    expect(screen.getByText('No pending changes')).toBeInTheDocument()
  })

  it('updates the list when modifiedFiles changes', () => {
    const { rerender, props } = renderNoteList({ selection: changesSelection, modifiedFiles })
    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('facebook-ads-strategy.md')).toBeInTheDocument()

    rerender(<NoteList {...props} modifiedFiles={[modifiedFiles[0]]} />)
    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.queryByText('facebook-ads-strategy.md')).not.toBeInTheDocument()
  })

  it('uses modifiedFiles for filtering even when getNoteStatus is also provided', () => {
    const getNoteStatus = (path: string) => modifiedFiles.some((file) => file.path === path) ? 'modified' as const : 'clean' as const
    renderNoteList({ selection: changesSelection, modifiedFiles, getNoteStatus })

    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('facebook-ads-strategy.md')).toBeInTheDocument()
    expect(screen.queryByText('matteo-cellini.md')).not.toBeInTheDocument()
  })

  it('matches entries by relative path suffix across machines', () => {
    const crossMachineEntries: VaultEntry[] = mockEntries.map((entry) => ({
      ...entry,
      path: entry.path.replace('/Users/luca/Laputa', '/Users/other-machine/OtherVault'),
    }))

    renderNoteList({
      entries: crossMachineEntries,
      selection: changesSelection,
      modifiedFiles,
    })

    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('facebook-ads-strategy.md')).toBeInTheDocument()
    expect(screen.queryByText('matteo-cellini.md')).not.toBeInTheDocument()
  })

  it('shows the load error when modifiedFilesError is set', () => {
    renderNoteList({
      selection: changesSelection,
      modifiedFiles: [],
      modifiedFilesError: 'git status failed: not a git repository',
    })

    expect(screen.getByText(/Failed to load changes/)).toBeInTheDocument()
    expect(screen.getByText(/git status failed/)).toBeInTheDocument()
  })

  it('shows untracked notes alongside modified notes', () => {
    const mixedFiles = [
      { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
      { path: mockEntries[2].path, relativePath: 'person/matteo-cellini.md', status: 'untracked' as const },
    ]

    renderNoteList({ selection: changesSelection, modifiedFiles: mixedFiles })
    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('matteo-cellini.md')).toBeInTheDocument()
    expect(screen.queryByText('facebook-ads-strategy.md')).not.toBeInTheDocument()
  })

  it('shows change-status icons for each modified file', () => {
    const mixedFiles = [
      { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
      { path: mockEntries[2].path, relativePath: 'person/matteo-cellini.md', status: 'untracked' as const },
    ]

    renderNoteList({ selection: changesSelection, modifiedFiles: mixedFiles })
    expect(screen.getAllByTestId('change-status-icon')).toHaveLength(2)
  })

  it('shows deleted notes as rows when files are deleted', () => {
    const filesWithDeleted = [
      { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
      { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      { path: '/Users/luca/Laputa/note/also-gone.md', relativePath: 'note/also-gone.md', status: 'deleted' as const },
    ]

    renderNoteList({ selection: changesSelection, modifiedFiles: filesWithDeleted })
    expect(screen.getByText('26q1-laputa-app.md')).toBeInTheDocument()
    expect(screen.getByText('gone.md')).toBeInTheDocument()
    expect(screen.getByText('also-gone.md')).toBeInTheDocument()
    expect(screen.queryByText(/notes? deleted/)).not.toBeInTheDocument()
  })

  it('renders deleted rows with dimmed strikethrough styling', () => {
    renderNoteList({
      selection: changesSelection,
      modifiedFiles: [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ],
    })

    expect(screen.getByText('gone.md')).toHaveClass('line-through')
    expect(screen.getByText('gone.md')).toHaveClass('opacity-70')
  })

  it('does not show a deleted banner in or outside changes view', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles })
    expect(screen.queryByText(/notes? deleted/)).not.toBeInTheDocument()

    renderNoteList({
      selection: allSelection,
      modifiedFiles: [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ],
    })
    expect(screen.queryByText(/notes? deleted/)).not.toBeInTheDocument()
  })

  it('shows the discard context menu when onDiscardFile is provided', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles, onDiscardFile: vi.fn() })
    const noteItem = screen.getByText('26q1-laputa-app.md').closest('[class*="border-b"]')!
    fireEvent.contextMenu(noteItem)

    expect(screen.getByTestId('changes-context-menu')).toBeInTheDocument()
    expect(screen.getByTestId('discard-changes-button')).toBeInTheDocument()
  })

  it('shows the restore action for deleted rows in the context menu', () => {
    renderNoteList({
      selection: changesSelection,
      modifiedFiles: [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ],
      onDiscardFile: vi.fn(),
    })

    const noteItem = screen.getByText('gone.md').closest('[class*="border-b"]')!
    fireEvent.contextMenu(noteItem)

    expect(screen.getByTestId('changes-context-menu')).toBeInTheDocument()
    expect(screen.getByTestId('restore-note-button')).toBeInTheDocument()
  })

  it('does not show a context menu when discard is unavailable', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles })
    const noteItem = screen.getByText('26q1-laputa-app.md').closest('[class*="border-b"]')!
    fireEvent.contextMenu(noteItem)

    expect(screen.queryByTestId('changes-context-menu')).not.toBeInTheDocument()
  })

  it('shows the confirmation dialog after clicking discard changes', () => {
    renderNoteList({ selection: changesSelection, modifiedFiles, onDiscardFile: vi.fn() })
    const noteItem = screen.getByText('26q1-laputa-app.md').closest('[class*="border-b"]')!

    fireEvent.contextMenu(noteItem)
    fireEvent.click(screen.getByTestId('discard-changes-button'))

    const dialog = screen.getByTestId('discard-confirm-dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog.textContent).toContain('Build Laputa App')
  })

  it('opens the restore context-menu action from Shift+F10 on highlighted deleted rows', () => {
    renderNoteList({
      selection: changesSelection,
      modifiedFiles: [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ],
      onDiscardFile: vi.fn(),
    })

    const container = screen.getByTestId('note-list-container')
    act(() => {
      fireEvent.focus(container)
    })
    act(() => {
      fireEvent.keyDown(container, { key: 'F10', shiftKey: true })
    })

    expect(screen.getByTestId('changes-context-menu')).toBeInTheDocument()
    expect(screen.getByTestId('restore-note-button')).toBeInTheDocument()
  })

  it('calls onDiscardFile with the relative path when discard is confirmed', async () => {
    const onDiscardFile = vi.fn().mockResolvedValue(undefined)
    renderNoteList({ selection: changesSelection, modifiedFiles, onDiscardFile })

    const noteItem = screen.getByText('26q1-laputa-app.md').closest('[class*="border-b"]')!
    act(() => {
      fireEvent.contextMenu(noteItem)
    })
    act(() => {
      fireEvent.click(screen.getByTestId('discard-changes-button'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-confirm-button'))
      await Promise.resolve()
    })

    expect(onDiscardFile).toHaveBeenCalledWith('project/26q1-laputa-app.md')
  })

  it('does not call onDiscardFile when cancel is clicked', () => {
    const onDiscardFile = vi.fn()
    renderNoteList({ selection: changesSelection, modifiedFiles, onDiscardFile })

    const noteItem = screen.getByText('26q1-laputa-app.md').closest('[class*="border-b"]')!
    fireEvent.contextMenu(noteItem)
    fireEvent.click(screen.getByTestId('discard-changes-button'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onDiscardFile).not.toHaveBeenCalled()
  })
})
