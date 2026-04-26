import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../../types'
import { useNoteContextMenu } from './useNoteContextMenu'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: 'notes/foo.md',
    filename: 'foo.md',
    title: 'Foo',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    ...overrides,
  }
}

interface HarnessProps {
  vaultPath: string | null
  setToastMessage: (message: string | null) => void
  entry?: VaultEntry
}

function Harness({ vaultPath, setToastMessage, entry = makeEntry() }: HarnessProps) {
  const { handleNoteContextMenu, contextMenuNode } = useNoteContextMenu({ vaultPath, setToastMessage })
  return (
    <>
      <div
        data-testid="note-row"
        onContextMenu={(event) => handleNoteContextMenu(entry, event)}
      >
        row
      </div>
      {contextMenuNode}
    </>
  )
}

describe('useNoteContextMenu', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('opens the menu on right-click and renders the copy entry', () => {
    render(<Harness vaultPath="/home/alex/Laputa" setToastMessage={vi.fn()} />)
    fireEvent.contextMenu(screen.getByTestId('note-row'))
    expect(screen.getByTestId('note-context-menu')).toBeInTheDocument()
    expect(screen.getByTestId('copy-system-path-menu-item')).toBeInTheDocument()
  })

  it('copies the absolute path and emits a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const setToastMessage = vi.fn()
    render(
      <Harness
        vaultPath="/home/alex/Laputa"
        setToastMessage={setToastMessage}
        entry={makeEntry({ path: 'notes/claude/foo.md' })}
      />,
    )

    fireEvent.contextMenu(screen.getByTestId('note-row'))
    fireEvent.click(screen.getByTestId('copy-system-path-menu-item'))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/home/alex/Laputa/notes/claude/foo.md'))
    await waitFor(() => expect(setToastMessage).toHaveBeenCalledWith('System path copied to clipboard'))
    expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(<Harness vaultPath="/home/alex/Laputa" setToastMessage={vi.fn()} />)
    fireEvent.contextMenu(screen.getByTestId('note-row'))
    expect(screen.getByTestId('note-context-menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument()
  })

  it('does nothing when vaultPath is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const setToastMessage = vi.fn()
    render(<Harness vaultPath={null} setToastMessage={setToastMessage} />)

    fireEvent.contextMenu(screen.getByTestId('note-row'))
    fireEvent.click(screen.getByTestId('copy-system-path-menu-item'))

    await waitFor(() => expect(setToastMessage).toHaveBeenCalledWith('Could not resolve vault path'))
    expect(writeText).not.toHaveBeenCalled()
  })
})
