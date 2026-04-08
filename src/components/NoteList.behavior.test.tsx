import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry, makeIndexedEntry, mockEntries, renderNoteList } from '../test-utils/noteListTestUtils'

describe('NoteList status indicators', () => {
  it('shows a modified indicator for modified notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'modified' as const : 'clean' as const
    renderNoteList({ getNoteStatus })

    const indicators = screen.getAllByTestId('modified-indicator')
    expect(indicators).toHaveLength(1)
    const noteRow = indicators[0].closest('[data-testid="modified-indicator"]')!.parentElement!.parentElement!
    expect(noteRow.textContent).toContain('Build Laputa App')
  })

  it('does not show indicators when everything is clean', () => {
    renderNoteList({ getNoteStatus: () => 'clean' as const })
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows multiple modified indicators when multiple notes are dirty', () => {
    const modifiedPaths = new Set([mockEntries[0].path, mockEntries[1].path])
    const getNoteStatus = (path: string) => modifiedPaths.has(path) ? 'modified' as const : 'clean' as const

    renderNoteList({ getNoteStatus })
    expect(screen.getAllByTestId('modified-indicator')).toHaveLength(2)
  })

  it('does not show indicators when getNoteStatus is undefined', () => {
    renderNoteList()
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows the green new indicator for new notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'new' as const : 'clean' as const
    renderNoteList({ getNoteStatus })
    expect(screen.getAllByTestId('new-indicator')).toHaveLength(1)
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
  })
})

describe('NoteList virtualized datasets', () => {
  it('renders 9000 entries without crashing', { timeout: 30000 }, () => {
    const largeDataset = Array.from({ length: 9000 }, (_, index) => makeIndexedEntry(index))
    const { container } = renderNoteList({ entries: largeDataset })
    expect(container.querySelector('[data-testid="virtuoso-mock"]')).toBeInTheDocument()
  })

  it('renders both ends of a large dataset through the Virtuoso mock', () => {
    const largeDataset = Array.from({ length: 500 }, (_, index) => makeIndexedEntry(index))
    renderNoteList({ entries: largeDataset })
    expect(screen.getByText('Note 0')).toBeInTheDocument()
    expect(screen.getByText('Note 499')).toBeInTheDocument()
  })

  it('filters large datasets by search query', () => {
    const entries = [
      makeIndexedEntry(0, { title: 'Alpha Strategy' }),
      ...Array.from({ length: 998 }, (_, index) => makeIndexedEntry(index + 1, { title: `Filler Note ${index + 1}` })),
      makeIndexedEntry(999, { title: 'Beta Strategy' }),
    ]

    renderNoteList({ entries })
    fireEvent.click(screen.getByTitle('Search notes'))
    fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'Strategy' } })

    expect(screen.getByText('Alpha Strategy')).toBeInTheDocument()
    expect(screen.getByText('Beta Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Filler Note 1')).not.toBeInTheDocument()
  })

  it('sorts large datasets correctly', () => {
    const entries = [
      makeIndexedEntry(0, { title: 'Zebra', modifiedAt: 1000 }),
      makeIndexedEntry(1, { title: 'Alpha', modifiedAt: 3000 }),
      ...Array.from({ length: 100 }, (_, index) => makeIndexedEntry(index + 2, { title: `Mid ${index}`, modifiedAt: 2000 - index })),
    ]

    renderNoteList({ entries })
    expect(screen.getAllByText(/^Alpha$|^Zebra$/)[0].textContent).toBe('Alpha')
  })

  it('filters section groups inside large mixed datasets', () => {
    const entries = [
      ...Array.from({ length: 100 }, (_, index) => makeIndexedEntry(index, { isA: 'Project', title: `Project ${index}` })),
      ...Array.from({ length: 200 }, (_, index) => makeIndexedEntry(100 + index, { isA: 'Note', title: `Note ${index}` })),
    ]

    renderNoteList({ entries, selection: { kind: 'sectionGroup', type: 'Project' } })
    expect(screen.getByText('Project 0')).toBeInTheDocument()
    expect(screen.queryByText('Note 0')).not.toBeInTheDocument()
  })

  it('keeps selection highlighting in virtualized lists', () => {
    const entries = Array.from({ length: 100 }, (_, index) => makeIndexedEntry(index))
    renderNoteList({ entries, selectedNote: entries[5] })
    expect(screen.getByText('Note 5')).toBeInTheDocument()
  })

  it('keeps click behavior working on virtualized items', () => {
    const entries = Array.from({ length: 100 }, (_, index) => makeIndexedEntry(index))
    const { onReplaceActiveTab } = renderNoteList({ entries })
    fireEvent.click(screen.getByText('Note 50'))
    expect(onReplaceActiveTab).toHaveBeenCalledWith(entries[50])
  })
})

describe('NoteList multi-select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function selectTwoNotes(extraProps: Record<string, unknown> = {}) {
    renderNoteList(extraProps)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
  }

  it('selects a range on Shift+Click', () => {
    selectTwoNotes()
    expect(screen.getAllByTestId('multi-selected-item').length).toBeGreaterThanOrEqual(2)
  })

  it('clears multi-select and opens the note on regular click', () => {
    const { onReplaceActiveTab } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    fireEvent.click(screen.getByText('Matteo Cellini'))

    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[2])
  })

  it('clears multi-select and opens a new tab on Cmd+Click', () => {
    const { onSelectNote } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    fireEvent.click(screen.getByText('Matteo Cellini'), { metaKey: true })

    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
    expect(onSelectNote).toHaveBeenCalledWith(mockEntries[2])
  })

  it('shows the bulk action bar with the selected count', () => {
    selectTwoNotes()
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it.each([
    { label: 'archives via button', prop: 'onBulkArchive', trigger: () => fireEvent.click(screen.getByTestId('bulk-archive-btn')) },
    { label: 'deletes via button', prop: 'onBulkDeletePermanently', trigger: () => fireEvent.click(screen.getByTestId('bulk-delete-btn')) },
    { label: 'archives via Cmd+E', prop: 'onBulkArchive', trigger: () => fireEvent.keyDown(window, { key: 'e', metaKey: true }) },
    { label: 'deletes via Cmd+Backspace', prop: 'onBulkDeletePermanently', trigger: () => fireEvent.keyDown(window, { key: 'Backspace', metaKey: true }) },
    { label: 'deletes via Cmd+Delete', prop: 'onBulkDeletePermanently', trigger: () => fireEvent.keyDown(window, { key: 'Delete', metaKey: true }) },
  ])('bulk-select $label and clears the selection', ({ prop, trigger }) => {
    const handler = vi.fn()
    selectTwoNotes({ [prop]: handler })
    trigger()
    expect(handler).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('clears the selection from the bulk action bar', () => {
    selectTwoNotes()
    fireEvent.click(screen.getByTestId('bulk-clear-btn'))
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
  })

  it('does not show a bulk action bar when nothing is selected', () => {
    renderNoteList()
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })
})

describe('NoteList filter pills', () => {
  const projectEntries = [
    makeEntry({ path: '/p1.md', title: 'Open Project 1', isA: 'Project' }),
    makeEntry({ path: '/p2.md', title: 'Open Project 2', isA: 'Project' }),
    makeEntry({ path: '/p3.md', title: 'Archived Project', isA: 'Project', archived: true }),
    makeEntry({ path: '/n1.md', title: 'Some Note', isA: 'Note' }),
  ]

  it('shows filter pills for type sections', () => {
    renderNoteList({ entries: projectEntries, selection: { kind: 'sectionGroup', type: 'Project' } })
    expect(screen.getByTestId('filter-pills')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-archived')).toBeInTheDocument()
  })

  it('shows filter pills in all-notes view', () => {
    renderNoteList({ entries: projectEntries })
    expect(screen.getByTestId('filter-pills')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-archived')).toBeInTheDocument()
  })

  it('shows the correct all-notes count badges', () => {
    renderNoteList({ entries: projectEntries })
    expect(screen.getByTestId('filter-pill-open')).toHaveTextContent('3')
    expect(screen.getByTestId('filter-pill-archived')).toHaveTextContent('1')
  })

  it('shows archived notes in all-notes archived mode', () => {
    renderNoteList({ entries: projectEntries, noteListFilter: 'archived' })
    expect(screen.getByText('Archived Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Some Note')).not.toBeInTheDocument()
  })

  it('shows the correct counts for a type filter', () => {
    renderNoteList({ entries: projectEntries, selection: { kind: 'sectionGroup', type: 'Project' } })
    const openPill = screen.getByTestId('filter-pill-open')
    const archivedPill = screen.getByTestId('filter-pill-archived')

    expect(openPill).toHaveTextContent('Open')
    expect(openPill).toHaveTextContent('2')
    expect(archivedPill).toHaveTextContent('Archived')
    expect(archivedPill).toHaveTextContent('1')
  })

  it('calls onNoteListFilterChange when a filter pill is clicked', () => {
    const onNoteListFilterChange = vi.fn()
    renderNoteList({
      entries: projectEntries,
      selection: { kind: 'sectionGroup', type: 'Project' },
      onNoteListFilterChange,
    })

    fireEvent.click(screen.getByTestId('filter-pill-archived'))
    expect(onNoteListFilterChange).toHaveBeenCalledWith('archived')
  })

  it('shows archived notes when the type filter switches to archived', () => {
    renderNoteList({
      entries: projectEntries,
      selection: { kind: 'sectionGroup', type: 'Project' },
      noteListFilter: 'archived',
    })

    expect(screen.getByText('Archived Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
  })

  it('shows the archived empty state when a section has no archived notes', () => {
    renderNoteList({
      entries: projectEntries.filter((entry) => !entry.archived),
      selection: { kind: 'sectionGroup', type: 'Project' },
      noteListFilter: 'archived',
    })

    expect(screen.getByText('No archived notes')).toBeInTheDocument()
  })
})
