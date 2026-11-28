import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CREATE_NOTE_IN_FOLDER_EVENT } from '../hooks/noteCreationRequests'
import type { FolderNode } from '../types'
import { FolderTree } from './FolderTree'
import { defaultSelection, mockFolders, vaultRootPath } from './folder-tree/folderTreeTestFixtures'

describe('FolderTree context menu', () => {
  it('opens a context menu with a delete action on right-click', () => {
    const onDeleteFolder = vi.fn()
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        onDeleteFolder={onDeleteFolder}
        onStartRenameFolder={vi.fn()}
      />,
    )
    fireEvent.contextMenu(screen.getByText('projects'))
    expect(screen.getByTestId('folder-context-menu')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('delete-folder-menu-item'))
    expect(onDeleteFolder).toHaveBeenCalledWith('projects', undefined)
  })

  it('sizes the folder context menu to visible actions instead of filling the viewport', () => {
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        folderFileActions={{
          copyFolderPath: vi.fn(),
          revealFolder: vi.fn(),
        }}
        onDeleteFolder={vi.fn()}
        onStartRenameFolder={vi.fn()}
      />,
    )

    fireEvent.contextMenu(screen.getByText('projects'))

    const menu = screen.getByTestId('folder-context-menu')
    expect(menu).toHaveClass('w-max')
    expect(menu).toHaveClass('min-w-[min(11.25rem,calc(100vw-16px))]')
    expect(menu).toHaveClass('max-w-[min(22rem,calc(100vw-16px))]')
  })

  it('dismisses the folder context menu on Escape', () => {
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        onDeleteFolder={vi.fn()}
        onStartRenameFolder={vi.fn()}
      />,
    )
    fireEvent.contextMenu(screen.getByText('projects'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('folder-context-menu')).not.toBeInTheDocument()
  })

  it('opens folder file actions from the context menu', () => {
    const onRevealFolder = vi.fn()
    const onCopyFolderPath = vi.fn()
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        folderFileActions={{
          copyFolderPath: onCopyFolderPath,
          revealFolder: onRevealFolder,
        }}
        onStartRenameFolder={vi.fn()}
      />,
    )

    fireEvent.contextMenu(screen.getByText('projects'))
    fireEvent.click(screen.getByTestId('reveal-folder-menu-item'))
    expect(onRevealFolder).toHaveBeenCalledWith('projects', undefined)

    fireEvent.contextMenu(screen.getByText('projects'))
    fireEvent.click(screen.getByTestId('copy-folder-path-menu-item'))
    expect(onCopyFolderPath).toHaveBeenCalledWith('projects', undefined)
  })

  it('creates a note in the right-clicked mounted folder', () => {
    const onCreateNoteInFolder = vi.fn()
    const folders: FolderNode[] = [
      {
        name: 'Personal',
        path: '',
        rootPath: '/Users/luca/Personal',
        children: [{ name: 'projects', path: 'projects', rootPath: '/Users/luca/Personal', children: [] }],
      },
      {
        name: 'Team',
        path: '',
        rootPath: '/Users/luca/Team',
        children: [{ name: 'projects', path: 'projects', rootPath: '/Users/luca/Team', children: [] }],
      },
    ]

    render(
      <FolderTree
        folders={folders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        vaultRootPath="/Users/luca/Team"
      />,
    )

    window.addEventListener(CREATE_NOTE_IN_FOLDER_EVENT, onCreateNoteInFolder)
    fireEvent.contextMenu(screen.getAllByTestId('folder-row:projects')[1])
    fireEvent.click(screen.getByTestId('create-note-in-folder-menu-item'))

    expect(onCreateNoteInFolder).toHaveBeenCalledOnce()
    expect((onCreateNoteInFolder.mock.calls[0][0] as CustomEvent).detail).toEqual({
      folderPath: 'projects',
      rootPath: '/Users/luca/Team',
    })
    window.removeEventListener(CREATE_NOTE_IN_FOLDER_EVENT, onCreateNoteInFolder)
  })

  it('creates a folder inside the right-clicked folder', async () => {
    const onCreateFolder = vi.fn().mockResolvedValue(true)
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        onCreateFolder={onCreateFolder}
      />,
    )

    fireEvent.contextMenu(screen.getByText('projects'))
    fireEvent.click(screen.getByTestId('create-folder-in-folder-menu-item'))

    const parentRow = screen.getByTestId('folder-create-parent:projects')
    const input = within(parentRow).getByTestId('new-folder-input')
    fireEvent.change(input, { target: { value: 'research' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await vi.waitFor(() => {
      expect(onCreateFolder).toHaveBeenCalledWith('research', { path: 'projects' })
    })
  })

  it('keeps destructive folder actions off the vault root row and menu', () => {
    render(
      <FolderTree
        folders={mockFolders}
        selection={defaultSelection}
        onSelect={vi.fn()}
        folderFileActions={{
          copyFolderPath: vi.fn(),
          revealFolder: vi.fn(),
        }}
        onDeleteFolder={vi.fn()}
        onRenameFolder={vi.fn().mockResolvedValue(true)}
        onStartRenameFolder={vi.fn()}
        onCancelRenameFolder={vi.fn()}
        vaultRootPath={vaultRootPath}
      />,
    )

    expect(screen.queryByTestId('rename-folder-btn:')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-folder-btn:')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Laputa'))

    expect(screen.getByTestId('reveal-folder-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('copy-folder-path-menu-item')).toBeInTheDocument()
    expect(screen.queryByText('Rename folder...')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-folder-menu-item')).not.toBeInTheDocument()
  })
})
