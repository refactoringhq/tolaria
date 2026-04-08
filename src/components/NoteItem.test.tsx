import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteItem } from './NoteItem'
import { makeEntry } from '../test-utils/noteListTestUtils'

describe('NoteItem', () => {
  it('renders binary files as non-clickable muted rows', () => {
    const binaryEntry = makeEntry({
      path: '/vault/photo.png',
      filename: 'photo.png',
      title: 'photo.png',
      fileKind: 'binary',
    })
    const onClickNote = vi.fn()

    render(<NoteItem entry={binaryEntry} isSelected={false} typeEntryMap={{}} onClickNote={onClickNote} />)

    const item = screen.getByTestId('binary-file-item')
    expect(item.className).toContain('opacity-50')
    expect(item).toHaveAttribute('title', 'Cannot open this file type')

    fireEvent.click(item)
    expect(onClickNote).not.toHaveBeenCalled()
  })

  it('renders text files as clickable rows', () => {
    const textEntry = makeEntry({
      path: '/vault/config.yml',
      filename: 'config.yml',
      title: 'config.yml',
      fileKind: 'text',
    })
    const onClickNote = vi.fn()

    render(<NoteItem entry={textEntry} isSelected={false} typeEntryMap={{}} onClickNote={onClickNote} />)

    const item = screen.getByText('config.yml').closest('div')!
    fireEvent.click(item)
    expect(onClickNote).toHaveBeenCalled()
  })

  it('shows filenames instead of titles when a change status is present', () => {
    const entry = makeEntry({ filename: 'my-note.md', title: 'My Note Title' })

    render(<NoteItem entry={entry} isSelected={false} typeEntryMap={{}} onClickNote={vi.fn()} changeStatus="modified" />)

    expect(screen.getByText('my-note.md')).toBeInTheDocument()
    expect(screen.queryByText('My Note Title')).not.toBeInTheDocument()
  })

  it('renders the correct symbol for modified files', () => {
    const entry = makeEntry({ filename: 'note.md' })

    render(<NoteItem entry={entry} isSelected={false} typeEntryMap={{}} onClickNote={vi.fn()} changeStatus="modified" />)

    expect(screen.getByTestId('change-status-icon').textContent).toBe('·')
  })

  it('renders the correct symbol for added files', () => {
    const entry = makeEntry({ filename: 'new-note.md' })

    render(<NoteItem entry={entry} isSelected={false} typeEntryMap={{}} onClickNote={vi.fn()} changeStatus="added" />)

    expect(screen.getByTestId('change-status-icon').textContent).toBe('+')
  })

  it('renders the regular title when no change status is set', () => {
    const entry = makeEntry({ filename: 'note.md', title: 'My Note' })

    render(<NoteItem entry={entry} isSelected={false} typeEntryMap={{}} onClickNote={vi.fn()} />)

    expect(screen.getByText('My Note')).toBeInTheDocument()
    expect(screen.queryByText('note.md')).not.toBeInTheDocument()
    expect(screen.queryByTestId('change-status-icon')).not.toBeInTheDocument()
  })
})
