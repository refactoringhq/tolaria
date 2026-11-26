import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../SingleEditorView.testUtils'
import { FilenameCrumb } from './FilenameCrumb'

function renameTo(stem: string) {
  const onRenameFilename = vi.fn()
  const entry = makeEntry()
  render(<FilenameCrumb entry={entry} onRenameFilename={onRenameFilename} />)
  fireEvent.doubleClick(screen.getByTestId('breadcrumb-filename-trigger'))
  const input = screen.getByTestId('breadcrumb-filename-input')
  fireEvent.change(input, { target: { value: stem } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return { entry, onRenameFilename }
}

describe('FilenameCrumb rename', () => {
  it('renames to a plain filename', () => {
    const { entry, onRenameFilename } = renameTo('renamed-file')

    expect(onRenameFilename).toHaveBeenCalledWith(entry.path, 'renamed-file')
  })

  it.each(['../escaped', 'nested/name', 'back\\slash', '..', 'con'])('does not rename to the unsafe filename %j', (unsafeStem) => {
    const { onRenameFilename } = renameTo(unsafeStem)

    expect(onRenameFilename).not.toHaveBeenCalled()
  })
})

describe('FilenameCrumb title sync', () => {
  it('offers to rename the file to match its title', () => {
    render(<FilenameCrumb entry={makeEntry({ title: 'Fresh Title' })} onRenameFilename={vi.fn()} />)

    expect(screen.getByTestId('breadcrumb-sync-button')).toBeInTheDocument()
  })

  it('does not offer a title whose filename would not work on every desktop', () => {
    render(<FilenameCrumb entry={makeEntry({ title: 'CON' })} onRenameFilename={vi.fn()} />)

    expect(screen.queryByTestId('breadcrumb-sync-button')).not.toBeInTheDocument()
  })
})
