import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { openNoteListPropertiesPicker } from './note-list/noteListPropertiesEvents'
import {
  allSelection,
  makeEntry,
  makeTypeDefinition,
  mockEntries,
  renderNoteList,
} from '../test-utils/noteListTestUtils'

describe('NoteList rendering', () => {
  it('shows an empty state when there are no entries', () => {
    renderNoteList({ entries: [] })
    expect(screen.getByText('No notes found')).toBeInTheDocument()
  })

  it('renders all entries in the all-notes view', () => {
    renderNoteList()
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('filters section groups by type', () => {
    renderNoteList({ selection: { kind: 'sectionGroup', type: 'Person' } })
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('supports event sections', () => {
    renderNoteList({ selection: { kind: 'sectionGroup', type: 'Event' } })
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('supports project sections', () => {
    renderNoteList({ selection: { kind: 'sectionGroup', type: 'Project' } })
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
  })

  it('passes the selected type when creating a note from a type section', () => {
    const { onCreateNote } = renderNoteList({ selection: { kind: 'sectionGroup', type: 'Project' } })
    fireEvent.click(screen.getByTitle('Create new note'))
    expect(onCreateNote).toHaveBeenCalledWith('Project')
  })

  it('creates an untyped note from all notes', () => {
    const { onCreateNote } = renderNoteList()
    fireEvent.click(screen.getByTitle('Create new note'))
    expect(onCreateNote).toHaveBeenCalledWith(undefined)
  })

  it('pins the current entity and shows grouped children', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    expect(screen.getAllByText('Build Laputa App').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText('Related to')).toBeInTheDocument()
  })

  it('shows referenced-by groups for topic entities', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[4] } })
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Referenced By')).toBeInTheDocument()
  })

  it('toggles the search input from the header action', () => {
    renderNoteList()
    expect(screen.queryByPlaceholderText('Search notes...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Search notes'))
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('filters by a case-insensitive search query', () => {
    renderNoteList()
    fireEvent.click(screen.getByTitle('Search notes'))
    fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'facebook' } })
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('sorts entries by last modified descending by default', () => {
    renderNoteList({
      entries: [
        { ...mockEntries[0], modifiedAt: 1000, title: 'Oldest' },
        { ...mockEntries[1], modifiedAt: 3000, title: 'Newest', path: '/p2' },
        { ...mockEntries[2], modifiedAt: 2000, title: 'Middle', path: '/p3' },
      ],
    })

    const titles = screen.getAllByText(/Oldest|Newest|Middle/).map((element) => element.textContent)
    expect(titles).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('hides standalone status badges inside note rows', () => {
    renderNoteList()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('shows search and create actions in the header instead of a count badge', () => {
    renderNoteList()
    expect(screen.getByTitle('Search notes')).toBeInTheDocument()
    expect(screen.getByTitle('Create new note')).toBeInTheDocument()
  })

  it('shows backlinks from outgoing links in entity view', () => {
    const entriesWithBacklink = mockEntries.map((entry) =>
      entry.path === mockEntries[2].path ? { ...entry, outgoingLinks: ['Build Laputa App'] } : entry,
    )

    renderNoteList({
      entries: entriesWithBacklink,
      selection: { kind: 'entity', entry: mockEntries[0] },
    })

    expect(screen.getByText('Backlinks')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('collapses and expands entity groups', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Children'))
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Children'))
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
  })

  it('shows the entity snippet in the prominent card', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    expect(screen.getByText('Build a personal knowledge management app.')).toBeInTheDocument()
  })

  it('shows the inbox customize-columns action and falls back to type-defined chips', () => {
    const entries = [
      makeTypeDefinition('Book', ['Priority']),
      makeEntry({
        path: '/vault/book.md',
        filename: 'book.md',
        title: 'Book Note',
        isA: 'Book',
        properties: { Priority: 'High', Owner: 'Luca' },
        createdAt: 1700000000,
      }),
    ]

    renderNoteList({
      entries,
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: null,
      onUpdateInboxNoteListProperties: () => undefined,
    })

    expect(screen.getByTitle('Customize Inbox columns')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByText('Luca')).not.toBeInTheDocument()
  })

  it('opens the inbox column picker from the global event and saves new columns', () => {
    const onUpdateInboxNoteListProperties = vi.fn()
    const entries = [
      makeTypeDefinition('Book', ['Priority']),
      makeEntry({
        path: '/vault/book.md',
        filename: 'book.md',
        title: 'Book Note',
        isA: 'Book',
        properties: { Priority: 'High', Owner: 'Luca' },
        createdAt: 1700000000,
      }),
    ]

    renderNoteList({
      entries,
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: null,
      onUpdateInboxNoteListProperties,
    })

    act(() => {
      openNoteListPropertiesPicker('inbox')
    })

    expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Priority' })).toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    expect(onUpdateInboxNoteListProperties).toHaveBeenCalledWith(['Priority', 'Owner'])
  })

  it('uses inbox overrides when configured', () => {
    const entries = [
      makeTypeDefinition('Book', ['Priority']),
      makeEntry({
        path: '/vault/book.md',
        filename: 'book.md',
        title: 'Book Note',
        isA: 'Book',
        properties: { Priority: 'High', Owner: 'Luca' },
        createdAt: 1700000000,
      }),
    ]

    renderNoteList({
      entries,
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: ['Owner'],
      onUpdateInboxNoteListProperties: () => undefined,
    })

    expect(screen.getByText('Luca')).toBeInTheDocument()
    expect(screen.queryByText('High')).not.toBeInTheDocument()
  })
})

describe('NoteList click behavior', () => {
  it('opens the current tab on a regular click', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'))
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('opens a new tab on Cmd+Click', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'), { metaKey: true })
    expect(onSelectNote).toHaveBeenCalledWith(mockEntries[0])
    expect(onReplaceActiveTab).not.toHaveBeenCalled()
  })

  it('opens a new tab on Ctrl+Click', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'), { ctrlKey: true })
    expect(onSelectNote).toHaveBeenCalledWith(mockEntries[0])
    expect(onReplaceActiveTab).not.toHaveBeenCalled()
  })

  it('supports Cmd+Click on the entity pinned card', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1], { metaKey: true })
    expect(onSelectNote).toHaveBeenCalledWith(mockEntries[0])
    expect(onReplaceActiveTab).not.toHaveBeenCalled()
  })

  it('opens the current tab from the entity pinned card on regular click', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1])
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('opens child notes from entity view in the current tab', () => {
    const { onReplaceActiveTab, onSelectNote } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    fireEvent.click(screen.getByText('Facebook Ads Strategy'))
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[1])
    expect(onSelectNote).not.toHaveBeenCalled()
  })
})

describe('NoteList type sections', () => {
  const typeEntry = {
    ...makeEntry({
      path: '/Users/luca/Laputa/types/project.md',
      filename: 'project.md',
      title: 'Project',
      isA: 'Type',
      snippet: 'Defines the Project type.',
      modifiedAt: 1700000000,
      fileSize: 200,
      wordCount: 50,
    }),
  }
  const entriesWithType = [...mockEntries, typeEntry]

  it('does not show a type note pinned card while browsing the section', () => {
    renderNoteList({
      entries: entriesWithType,
      selection: { kind: 'sectionGroup', type: 'Project' },
    })

    expect(screen.queryByText('Defines the Project type.')).not.toBeInTheDocument()
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('renders a clickable type header that opens the type note', () => {
    const { onReplaceActiveTab } = renderNoteList({
      entries: entriesWithType,
      selection: { kind: 'sectionGroup', type: 'Project' },
    })

    const headerLink = screen.getByTestId('type-header-link')
    expect(headerLink).toHaveTextContent('Project')
    fireEvent.click(headerLink)
    expect(onReplaceActiveTab).toHaveBeenCalledWith(typeEntry)
  })

  it('does not render a type header outside type sections', () => {
    renderNoteList({ entries: entriesWithType, selection: allSelection })
    expect(screen.queryByTestId('type-header-link')).not.toBeInTheDocument()
  })
})

describe('NoteList traffic-light padding', () => {
  it('adds left padding when the sidebar is collapsed', () => {
    const { container } = renderNoteList({ sidebarCollapsed: true })
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('80px')
  })

  it('does not add extra left padding when the sidebar is expanded', () => {
    const { container } = renderNoteList({ sidebarCollapsed: false })
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })

  it('defaults to no extra padding when sidebarCollapsed is omitted', () => {
    const { container } = renderNoteList()
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })
})
