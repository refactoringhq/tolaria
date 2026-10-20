import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteList } from './NoteList'
import { buildNoteListProps, makeEntry, renderNoteList } from '../test-utils/noteListTestUtils'
import type { SidebarSelection } from '../types'

vi.mock('../hooks/useTabManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTabManagement')>()
  return { ...actual, prefetchNoteContent: vi.fn() }
})

const ROOT = '/Users/luca/Laputa'
const projectsSelection: SidebarSelection = { kind: 'folder', path: 'projects', rootPath: ROOT }
const folderEntries = [
  makeEntry({ path: `${ROOT}/projects/direct.md`, filename: 'direct.md', title: 'Direct Note' }),
  makeEntry({ path: `${ROOT}/projects/2024/nested.md`, filename: 'nested.md', title: 'Nested Note' }),
  makeEntry({ path: `${ROOT}/projects/2024/old.md`, filename: 'old.md', title: 'Old Nested Note', archived: true }),
  makeEntry({ path: `${ROOT}/other/elsewhere.md`, filename: 'elsewhere.md', title: 'Elsewhere Note' }),
]

function StatefulFolderNoteList({ initialIncludeSubfolders = true }: { initialIncludeSubfolders?: boolean }) {
  const [includeSubfolders, setIncludeSubfolders] = useState(initialIncludeSubfolders)
  const { props } = buildNoteListProps({
    entries: folderEntries,
    selection: projectsSelection,
    folderIncludeSubfolders: includeSubfolders,
    onFolderIncludeSubfoldersChange: setIncludeSubfolders,
  })
  return <NoteList {...props} />
}

function subfolderToggle() {
  return screen.getByRole('button', { name: 'Show subfolder notes' })
}

describe('NoteList subfolder notes toggle', () => {
  it('lists nested subfolder notes by default with the toggle pressed', () => {
    render(<StatefulFolderNoteList />)

    expect(subfolderToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Direct Note')).toBeInTheDocument()
    expect(screen.getByText('Nested Note')).toBeInTheDocument()
    expect(screen.queryByText('Elsewhere Note')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toHaveTextContent('2')
    expect(screen.getByTestId('filter-pill-archived')).toHaveTextContent('1')
  })

  it('hides nested subfolder notes and their counts when turned off', () => {
    render(<StatefulFolderNoteList />)

    fireEvent.click(subfolderToggle())

    expect(subfolderToggle()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Direct Note')).toBeInTheDocument()
    expect(screen.queryByText('Nested Note')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toHaveTextContent('1')
    expect(screen.getByTestId('filter-pill-archived')).toHaveTextContent('0')
  })

  it('reports the next value to the persistence handler', () => {
    const onFolderIncludeSubfoldersChange = vi.fn()
    renderNoteList({
      entries: folderEntries,
      selection: projectsSelection,
      folderIncludeSubfolders: false,
      onFolderIncludeSubfoldersChange,
    })

    expect(screen.queryByText('Nested Note')).not.toBeInTheDocument()
    fireEvent.click(subfolderToggle())

    expect(onFolderIncludeSubfoldersChange).toHaveBeenCalledWith(true)
  })

  it('does not offer the toggle outside nested folder views', () => {
    const onFolderIncludeSubfoldersChange = vi.fn()
    const { rerender, props } = renderNoteList({
      entries: folderEntries,
      selection: { kind: 'folder', path: '', rootPath: ROOT },
      onFolderIncludeSubfoldersChange,
    })
    expect(screen.queryByRole('button', { name: 'Show subfolder notes' })).not.toBeInTheDocument()

    rerender(<NoteList {...props} selection={{ kind: 'filter', filter: 'all' }} />)
    expect(screen.queryByRole('button', { name: 'Show subfolder notes' })).not.toBeInTheDocument()
  })
})
