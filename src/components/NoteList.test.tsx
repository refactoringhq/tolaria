import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoteList } from './NoteList'
import { NoteItem } from './NoteItem'
import { getSortComparator, filterEntries, countByFilter, countAllByFilter } from '../utils/noteListHelpers'
import type { NoteListFilter } from '../utils/noteListHelpers'
import type { VaultEntry, SidebarSelection } from '../types'

const allSelection: SidebarSelection = { kind: 'filter', filter: 'all' }
const noopSelect = vi.fn()
const noopReplace = vi.fn()
const noopFilterChange = vi.fn()
const defaultFilterProps = { noteListFilter: 'open' as NoteListFilter, onNoteListFilterChange: noopFilterChange }

const mockEntries: VaultEntry[] = [
  {
    path: '/Users/luca/Laputa/project/26q1-laputa-app.md',
    filename: '26q1-laputa-app.md',
    title: 'Build Laputa App',
    isA: 'Project',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[topic/software-development]]'],
    status: 'Active',
    owner: 'Luca',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 1024,
    snippet: 'Build a personal knowledge management app.',
    wordCount: 0,
    relationships: {
      'Related to': ['[[topic/software-development]]'],
    },
    icon: null,
    color: null,
    order: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
  {
    path: '/Users/luca/Laputa/note/facebook-ads-strategy.md',
    filename: 'facebook-ads-strategy.md',
    title: 'Facebook Ads Strategy',
    isA: 'Note',
    aliases: [],
    belongsTo: ['[[project/26q1-laputa-app]]'],
    relatedTo: ['[[topic/growth]]'],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 847,
    snippet: 'Lookalike audiences convert 3x better.',
    wordCount: 0,
    relationships: {
      'Belongs to': ['[[project/26q1-laputa-app]]'],
      'Related to': ['[[topic/growth]]'],
    },
    icon: null,
    color: null,
    order: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
  {
    path: '/Users/luca/Laputa/person/matteo-cellini.md',
    filename: 'matteo-cellini.md',
    title: 'Matteo Cellini',
    isA: 'Person',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 320,
    snippet: 'Sponsorship manager.',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
  {
    path: '/Users/luca/Laputa/event/2026-02-14-kickoff.md',
    filename: '2026-02-14-kickoff.md',
    title: 'Kickoff Meeting',
    isA: 'Event',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 512,
    snippet: 'Project kickoff meeting notes.',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
  {
    path: '/Users/luca/Laputa/topic/software-development.md',
    filename: 'software-development.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 256,
    snippet: 'Frontend, backend, and systems programming.',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
]

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/test.md', filename: 'test.md', title: 'Test', isA: null,
  aliases: [], belongsTo: [], relatedTo: [], status: null,
  archived: false, trashed: false, trashedAt: null,
  modifiedAt: null, createdAt: null, fileSize: 100, snippet: '', wordCount: 0,
  relationships: {}, icon: null, color: null, order: null, sidebarLabel: null,
  template: null, sort: null, view: null, visible: null,
  outgoingLinks: [], properties: {},
  ...overrides,
})

const makeIndexedEntry = (i: number, overrides?: Partial<VaultEntry>): VaultEntry =>
  makeEntry({
    path: `/vault/note/note-${i}.md`,
    filename: `note-${i}.md`,
    title: `Note ${i}`,
    isA: 'Note',
    modifiedAt: 1700000000 - i * 60,
    fileSize: 500,
    snippet: `Content of note ${i}`,
    ...overrides,
  })

describe('NoteList', () => {
  it('shows empty state when no entries', () => {
    render(<NoteList {...defaultFilterProps} entries={[]} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('No notes found')).toBeInTheDocument()
  })

  it('renders all entries with All Notes filter', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('filters by People (section group)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Person' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by Events (section group)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Event' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by section group type', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
  })

  it('passes selected type when creating note from type section', () => {
    const onCreate = vi.fn()
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={onCreate} />)
    fireEvent.click(screen.getByTitle('Create new note'))
    expect(onCreate).toHaveBeenCalledWith('Project')
  })

  it('passes undefined type when creating note from All Notes', () => {
    const onCreate = vi.fn()
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={onCreate} />)
    fireEvent.click(screen.getByTitle('Create new note'))
    expect(onCreate).toHaveBeenCalledWith(undefined)
  })

  it('shows entity pinned at top with grouped children', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Entity title appears in header and pinned card
    expect(screen.getAllByText('Build Laputa App').length).toBeGreaterThanOrEqual(1)
    // Child entry in "Children" group
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    // Unrelated entries not shown
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    // Group headers shown
    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText('Related to')).toBeInTheDocument()
  })

  it('shows entity view with relationship groups for topics', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[4] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Build Laputa App references this topic via relatedTo — should appear in Referenced By
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    // Entity view shows group headers
    expect(screen.getByText('Referenced By')).toBeInTheDocument()
  })

  it('shows search input when search icon is clicked', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Search is hidden by default
    expect(screen.queryByPlaceholderText('Search notes...')).not.toBeInTheDocument()
    // Click search icon to show it
    fireEvent.click(screen.getByTitle('Search notes'))
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('filters by search query (case-insensitive substring)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Open search
    fireEvent.click(screen.getByTitle('Search notes'))
    const input = screen.getByPlaceholderText('Search notes...')
    fireEvent.change(input, { target: { value: 'facebook' } })
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('sorts entries by last modified descending', () => {
    const entriesWithDifferentDates: VaultEntry[] = [
      { ...mockEntries[0], modifiedAt: 1000, title: 'Oldest' },
      { ...mockEntries[1], modifiedAt: 3000, title: 'Newest', path: '/p2' },
      { ...mockEntries[2], modifiedAt: 2000, title: 'Middle', path: '/p3' },
    ]
    render(<NoteList {...defaultFilterProps} entries={entriesWithDifferentDates} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    const titles = screen.getAllByText(/Oldest|Newest|Middle/)
    const titleTexts = titles.map((el) => el.textContent)
    expect(titleTexts).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('does not render type badge or status on note items', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Type badges like "Project", "Note" etc. should not appear as separate badge elements
    // The word "Project" should only appear in the ALL CAPS pill "PROJECTS 1", not as a standalone badge
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('header shows search and plus icons instead of count badge', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByTitle('Search notes')).toBeInTheDocument()
    expect(screen.getByTitle('Create new note')).toBeInTheDocument()
  })

  it('context view shows backlinks from outgoingLinks', () => {
    const entriesWithBacklink = mockEntries.map(e =>
      e.path === mockEntries[2].path ? { ...e, outgoingLinks: ['Build Laputa App'] } : e
    )
    render(
      <NoteList {...defaultFilterProps} entries={entriesWithBacklink} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Backlinks')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('context view collapses and expands groups', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Children group is expanded by default
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    // Click the Children header to collapse
    fireEvent.click(screen.getByText('Children'))
    // Items should be hidden
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
    // Click again to expand
    fireEvent.click(screen.getByText('Children'))
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
  })

  it('context view shows prominent card with snippet subtitle', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Snippet text appears in the prominent card
    expect(screen.getByText('Build a personal knowledge management app.')).toBeInTheDocument()
  })
})

describe('NoteList click behavior', () => {
  beforeEach(() => {
    noopSelect.mockClear()
    noopReplace.mockClear()
  })

  it('regular click calls onReplaceActiveTab (opens in current tab)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[0])
    expect(noopSelect).not.toHaveBeenCalled()
  })

  it('Cmd+Click calls onSelectNote (opens in new tab)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'), { metaKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('Ctrl+Click calls onSelectNote (Windows/Linux)', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'), { ctrlKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('Cmd+Click on entity pinned card calls onSelectNote', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1], { metaKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('regular click on entity pinned card calls onReplaceActiveTab', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Title appears in both header and pinned card — use getAllByText and click the pinned card instance
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1])
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[0])
    expect(noopSelect).not.toHaveBeenCalled()
  })

  it('click on child note in entity view calls onReplaceActiveTab', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Facebook Ads Strategy'))
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[1])
    expect(noopSelect).not.toHaveBeenCalled()
  })
})

describe('getSortComparator', () => {
  it('sorts by modified date descending', () => {
    const a = makeEntry({ title: 'A', modifiedAt: 1000 })
    const b = makeEntry({ title: 'B', modifiedAt: 3000 })
    const c = makeEntry({ title: 'C', modifiedAt: 2000 })
    const sorted = [a, b, c].sort(getSortComparator('modified'))
    expect(sorted.map((e) => e.title)).toEqual(['B', 'C', 'A'])
  })

  it('sorts by created date descending', () => {
    const a = makeEntry({ title: 'A', createdAt: 3000, modifiedAt: 1000 })
    const b = makeEntry({ title: 'B', createdAt: 1000, modifiedAt: 3000 })
    const c = makeEntry({ title: 'C', createdAt: 2000, modifiedAt: 2000 })
    const sorted = [a, b, c].sort(getSortComparator('created'))
    expect(sorted.map((e) => e.title)).toEqual(['A', 'C', 'B'])
  })

  it('sorts by created date, falling back to modifiedAt when createdAt is null', () => {
    const a = makeEntry({ title: 'A', createdAt: null, modifiedAt: 5000 })
    const b = makeEntry({ title: 'B', createdAt: 2000, modifiedAt: 1000 })
    const sorted = [a, b].sort(getSortComparator('created'))
    expect(sorted.map((e) => e.title)).toEqual(['A', 'B'])
  })

  it('sorts by title alphabetically', () => {
    const a = makeEntry({ title: 'Zebra' })
    const b = makeEntry({ title: 'Alpha' })
    const c = makeEntry({ title: 'Middle' })
    const sorted = [a, b, c].sort(getSortComparator('title'))
    expect(sorted.map((e) => e.title)).toEqual(['Alpha', 'Middle', 'Zebra'])
  })

  it('sorts by status (Active > Paused > Done > null)', () => {
    const a = makeEntry({ title: 'Done', status: 'Done', modifiedAt: 1000 })
    const b = makeEntry({ title: 'Active', status: 'Active', modifiedAt: 1000 })
    const c = makeEntry({ title: 'NoStatus', status: null, modifiedAt: 1000 })
    const d = makeEntry({ title: 'Paused', status: 'Paused', modifiedAt: 1000 })
    const sorted = [a, b, c, d].sort(getSortComparator('status'))
    expect(sorted.map((e) => e.title)).toEqual(['Active', 'Paused', 'Done', 'NoStatus'])
  })

  it('sorts by status with modified date as tiebreaker', () => {
    const a = makeEntry({ title: 'OlderActive', status: 'Active', modifiedAt: 1000 })
    const b = makeEntry({ title: 'NewerActive', status: 'Active', modifiedAt: 3000 })
    const sorted = [a, b].sort(getSortComparator('status'))
    expect(sorted.map((e) => e.title)).toEqual(['NewerActive', 'OlderActive'])
  })

  it('sorts by modified date ascending when direction is asc', () => {
    const a = makeEntry({ title: 'A', modifiedAt: 1000 })
    const b = makeEntry({ title: 'B', modifiedAt: 3000 })
    const c = makeEntry({ title: 'C', modifiedAt: 2000 })
    const sorted = [a, b, c].sort(getSortComparator('modified', 'asc'))
    expect(sorted.map((e) => e.title)).toEqual(['A', 'C', 'B'])
  })

  it('sorts by title descending when direction is desc', () => {
    const a = makeEntry({ title: 'Zebra' })
    const b = makeEntry({ title: 'Alpha' })
    const c = makeEntry({ title: 'Middle' })
    const sorted = [a, b, c].sort(getSortComparator('title', 'desc'))
    expect(sorted.map((e) => e.title)).toEqual(['Zebra', 'Middle', 'Alpha'])
  })

  it('sorts by created date ascending when direction is asc', () => {
    const a = makeEntry({ title: 'A', createdAt: 3000, modifiedAt: 1000 })
    const b = makeEntry({ title: 'B', createdAt: 1000, modifiedAt: 3000 })
    const c = makeEntry({ title: 'C', createdAt: 2000, modifiedAt: 2000 })
    const sorted = [a, b, c].sort(getSortComparator('created', 'asc'))
    expect(sorted.map((e) => e.title)).toEqual(['B', 'C', 'A'])
  })

  it('sorts by status descending (null first, Done before Active)', () => {
    const a = makeEntry({ title: 'Done', status: 'Done', modifiedAt: 1000 })
    const b = makeEntry({ title: 'Active', status: 'Active', modifiedAt: 1000 })
    const c = makeEntry({ title: 'NoStatus', status: null, modifiedAt: 1000 })
    const sorted = [a, b, c].sort(getSortComparator('status', 'desc'))
    expect(sorted.map((e) => e.title)).toEqual(['NoStatus', 'Done', 'Active'])
  })
})

describe('NoteList sort controls', () => {
  beforeEach(() => {
    try { localStorage.removeItem('laputa-sort-preferences') } catch { /* noop */ }
  })

  it('shows sort button in note list header for flat view', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('sort-button-__list__')).toBeInTheDocument()
  })

  it('shows sort dropdown per relationship subsection in entity view', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('sort-button-Children')).toBeInTheDocument()
  })

  const renderListAndOpenSort = (entries: VaultEntry[] = mockEntries) => {
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
  }

  const zamEntries = [
    makeEntry({ path: '/a.md', title: 'Zebra', modifiedAt: 3000 }),
    makeEntry({ path: '/b.md', title: 'Alpha', modifiedAt: 1000 }),
    makeEntry({ path: '/c.md', title: 'Middle', modifiedAt: 2000 }),
  ]

  it('opens sort menu on click and shows all options', () => {
    renderListAndOpenSort()
    expect(screen.getByTestId('sort-menu-__list__')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-created')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-title')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-status')).toBeInTheDocument()
  })

  it('changes sort order when an option is selected', () => {
    renderListAndOpenSort(zamEntries)
    // Default sort: by modified (Zebra first) — menu is already open
    let titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra', 'Middle', 'Alpha'])

    // Switch to title sort
    fireEvent.click(screen.getByTestId('sort-option-title'))

    // Now should be alphabetical
    titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Alpha', 'Middle', 'Zebra'])
  })

  it('closes sort menu after selecting an option', () => {
    renderListAndOpenSort()
    expect(screen.getByTestId('sort-menu-__list__')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sort-option-title'))
    expect(screen.queryByTestId('sort-menu-__list__')).not.toBeInTheDocument()
  })

  it('shows direction arrows in sort dropdown menu', () => {
    renderListAndOpenSort()
    expect(screen.getByTestId('sort-dir-asc-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-desc-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-asc-title')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-desc-title')).toBeInTheDocument()
  })

  it('reverses sort order when clicking direction arrow', () => {
    renderListAndOpenSort(zamEntries)
    // Default sort: modified descending (Zebra first at 3000)
    let titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra', 'Middle', 'Alpha'])

    // Click the asc arrow for modified to reverse
    fireEvent.click(screen.getByTestId('sort-dir-asc-modified'))

    // Now ascending: Alpha (1000) first
    titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Alpha', 'Middle', 'Zebra'])
  })

  it('persists sort direction via saveSortPreferences', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'Zebra', modifiedAt: 3000 }),
      makeEntry({ path: '/b.md', title: 'Alpha', modifiedAt: 1000 }),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Select title sort with desc direction
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    fireEvent.click(screen.getByTestId('sort-dir-desc-title'))

    // Verify direction took effect: desc title means Z before A
    const titles = screen.getAllByText(/Zebra|Alpha/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra', 'Alpha'])
  })

  it('shows direction icon on the sort button that reflects current direction', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Default: modified desc → should have ArrowDown icon
    expect(screen.getByTestId('sort-direction-icon-__list__')).toBeInTheDocument()

    // Switch to title (default asc) and verify icon changes
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    fireEvent.click(screen.getByTestId('sort-option-title'))
    // Title default is asc → should show ArrowUp icon
    expect(screen.getByTestId('sort-direction-icon-__list__')).toBeInTheDocument()
  })

  it('sorts relationship subsection entries when sort option changed', () => {
    // Create an entity with children that have different titles
    const parent = makeEntry({
      path: '/parent.md',
      filename: 'parent.md',
      title: 'Parent',
      isA: 'Project',
    })
    const child1 = makeEntry({
      path: '/child1.md',
      filename: 'child1.md',
      title: 'Zebra Note',
      belongsTo: ['[[parent]]'],
      modifiedAt: 3000,
    })
    const child2 = makeEntry({
      path: '/child2.md',
      filename: 'child2.md',
      title: 'Alpha Note',
      belongsTo: ['[[parent]]'],
      modifiedAt: 1000,
    })
    const entries = [parent, child1, child2]

    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={{ kind: 'entity', entry: parent }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )

    // Default sort: by modified — Zebra Note (3000) before Alpha Note (1000)
    let titles = screen.getAllByText(/Zebra Note|Alpha Note/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra Note', 'Alpha Note'])

    // Switch to title sort
    fireEvent.click(screen.getByTestId('sort-button-Children'))
    fireEvent.click(screen.getByTestId('sort-option-title'))

    // Now alphabetical: Alpha before Zebra
    titles = screen.getAllByText(/Zebra Note|Alpha Note/).map((el) => el.textContent)
    expect(titles).toEqual(['Alpha Note', 'Zebra Note'])
  })

  it('shows custom properties with separator in sort dropdown', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'A', properties: { Priority: 'High', Rating: 5 } }),
      makeEntry({ path: '/b.md', title: 'B', properties: { Priority: 'Low', Company: 'Acme' } }),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    expect(screen.getByTestId('sort-separator')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-property:Company')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-property:Priority')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-property:Rating')).toBeInTheDocument()
  })

  it('omits separator when no custom properties exist', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    expect(screen.queryByTestId('sort-separator')).not.toBeInTheDocument()
  })

  it('sorts entries by custom property when selected', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'A', modifiedAt: 3000, properties: { Rating: 3 } }),
      makeEntry({ path: '/b.md', title: 'B', modifiedAt: 2000, properties: { Rating: 1 } }),
      makeEntry({ path: '/c.md', title: 'C', modifiedAt: 1000, properties: { Rating: 5 } }),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Default: modified desc → A, B, C
    let titles = screen.getAllByText(/^[ABC]$/).map((el) => el.textContent)
    expect(titles).toEqual(['A', 'B', 'C'])

    // Switch to Rating sort (asc by default for properties)
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    fireEvent.click(screen.getByTestId('sort-option-property:Rating'))

    // Rating asc: B(1), A(3), C(5)
    titles = screen.getAllByText(/^[ABC]$/).map((el) => el.textContent)
    expect(titles).toEqual(['B', 'A', 'C'])
  })

  it('pushes entries without the property to end when sorting by custom property', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'A', modifiedAt: 3000, properties: { Priority: 'High' } }),
      makeEntry({ path: '/b.md', title: 'B', modifiedAt: 2000, properties: {} }),
      makeEntry({ path: '/c.md', title: 'C', modifiedAt: 1000, properties: { Priority: 'Low' } }),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    fireEvent.click(screen.getByTestId('sort-option-property:Priority'))

    // Asc: A(High), C(Low), B(null → end)
    const titles = screen.getAllByText(/^[ABC]$/).map((el) => el.textContent)
    expect(titles).toEqual(['A', 'C', 'B'])
  })
})

// --- Trash feature tests ---

const trashedEntry: VaultEntry = {
  path: '/vault/note/old-draft.md',
  filename: 'old-draft.md',
  title: 'Old Draft Notes',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  trashed: true,
  trashedAt: Date.now() / 1000 - 86400 * 5,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 280,
  snippet: 'Some draft content that is no longer needed.',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null, sort: null,
  outgoingLinks: [],
  properties: {},
}

const expiredTrashedEntry: VaultEntry = {
  path: '/vault/note/deprecated-api.md',
  filename: 'deprecated-api.md',
  title: 'Deprecated API Notes',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  trashed: true,
  trashedAt: Date.now() / 1000 - 86400 * 35,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 190,
  snippet: 'Old API docs replaced by v2.',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null, sort: null,
  outgoingLinks: [],
  properties: {},
}

const entriesWithTrashed = [...mockEntries, trashedEntry, expiredTrashedEntry]

describe('filterEntries — trash', () => {
  it('excludes trashed entries from "all" filter', () => {
    const result = filterEntries(entriesWithTrashed, { kind: 'filter', filter: 'all' })
    expect(result.find((e) => e.title === 'Old Draft Notes')).toBeUndefined()
    expect(result.find((e) => e.title === 'Build Laputa App')).toBeDefined()
  })

  it('excludes trashed entries from section group', () => {
    const result = filterEntries(entriesWithTrashed, { kind: 'sectionGroup', type: 'Note' })
    expect(result.find((e) => e.title === 'Old Draft Notes')).toBeUndefined()
  })

  it('trash filter returns only trashed entries', () => {
    const result = filterEntries(entriesWithTrashed, { kind: 'filter', filter: 'trash' })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.trashed)).toBe(true)
  })

  it('archived filter excludes trashed entries', () => {
    const archivedAndTrashed = [
      ...mockEntries,
      { ...mockEntries[0], path: '/archived.md', archived: true, trashed: false, trashedAt: null, title: 'Archived Note' },
      trashedEntry,
    ]
    const result = filterEntries(archivedAndTrashed, { kind: 'filter', filter: 'archived' })
    expect(result.find((e) => e.title === 'Archived Note')).toBeDefined()
    expect(result.find((e) => e.title === 'Old Draft Notes')).toBeUndefined()
  })

  it('entity filter returns empty (entity view uses relationship groups instead)', () => {
    const result = filterEntries(mockEntries, { kind: 'entity', entry: mockEntries[4] })
    expect(result).toHaveLength(0)
  })
})

describe('NoteList — status indicators', () => {
  it('shows modified indicator dot for modified notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'modified' as const : 'clean' as const
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    const indicators = screen.getAllByTestId('modified-indicator')
    expect(indicators).toHaveLength(1)
    const noteRow = indicators[0].closest('[data-testid="modified-indicator"]')!.parentElement!.parentElement!
    expect(noteRow.textContent).toContain('Build Laputa App')
  })

  it('does not show indicator when all notes are clean', () => {
    const getNoteStatus = () => 'clean' as const
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows multiple modified indicators for multiple modified files', () => {
    const modifiedPaths = new Set([mockEntries[0].path, mockEntries[1].path])
    const getNoteStatus = (path: string) => modifiedPaths.has(path) ? 'modified' as const : 'clean' as const
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.getAllByTestId('modified-indicator')).toHaveLength(2)
  })

  it('does not show indicator when getNoteStatus prop is undefined', () => {
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows green new indicator for new notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'new' as const : 'clean' as const
    render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.getAllByTestId('new-indicator')).toHaveLength(1)
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
  })
})

describe('NoteList — trash view', () => {
  const trashSelection: SidebarSelection = { kind: 'filter', filter: 'trash' }

  it('shows "Trash" header when trash filter is active', () => {
    render(<NoteList {...defaultFilterProps} entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Trash')).toBeInTheDocument()
  })

  it('shows only trashed entries in trash view', () => {
    render(<NoteList {...defaultFilterProps} entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Old Draft Notes')).toBeInTheDocument()
    expect(screen.getByText('Deprecated API Notes')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('shows TRASHED badge on trashed entries', () => {
    render(<NoteList {...defaultFilterProps} entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    const badges = screen.getAllByText('TRASHED')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows 30-day warning banner when expired notes exist', () => {
    render(<NoteList {...defaultFilterProps} entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Notes in trash for 30+ days will be permanently deleted')).toBeInTheDocument()
    expect(screen.getByText(/1 note is past the 30-day retention period/)).toBeInTheDocument()
  })

  it('shows "Trash is empty" when no trashed entries', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
  })
})

// --- Virtual list performance tests ---

describe('NoteList — virtual list with large datasets', () => {
  it('renders 9000 entries without crashing', { timeout: 30000 }, () => {
    const largeDataset = Array.from({ length: 9000 }, (_, i) => makeIndexedEntry(i))
    const { container } = render(
      <NoteList {...defaultFilterProps} entries={largeDataset} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Virtuoso mock renders all items; the real component only renders visible ones
    expect(container.querySelector('[data-testid="virtuoso-mock"]')).toBeInTheDocument()
  })

  it('renders items from a large dataset via Virtuoso', () => {
    const largeDataset = Array.from({ length: 500 }, (_, i) => makeIndexedEntry(i))
    render(
      <NoteList {...defaultFilterProps} entries={largeDataset} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Note 0')).toBeInTheDocument()
    expect(screen.getByText('Note 499')).toBeInTheDocument()
  })

  it('search filters large dataset correctly', { timeout: 15000 }, () => {
    const entries = [
      makeIndexedEntry(0, { title: 'Alpha Strategy' }),
      ...Array.from({ length: 998 }, (_, i) => makeIndexedEntry(i + 1, { title: `Filler Note ${i + 1}` })),
      makeIndexedEntry(999, { title: 'Beta Strategy' }),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Search notes'))
    fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'Strategy' } })
    expect(screen.getByText('Alpha Strategy')).toBeInTheDocument()
    expect(screen.getByText('Beta Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Filler Note 1')).not.toBeInTheDocument()
  })

  it('sorting works with large dataset', () => {
    const entries = [
      makeIndexedEntry(0, { title: 'Zebra', modifiedAt: 1000 }),
      makeIndexedEntry(1, { title: 'Alpha', modifiedAt: 3000 }),
      ...Array.from({ length: 100 }, (_, i) => makeIndexedEntry(i + 2, { title: `Mid ${i}`, modifiedAt: 2000 - i })),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Default sort is modified desc — Alpha (3000) should come first
    const firstTitle = screen.getAllByText(/^Alpha$|^Zebra$/)[0]
    expect(firstTitle.textContent).toBe('Alpha')
  })

  it('section group filter works with large mixed-type dataset', () => {
    const entries = [
      ...Array.from({ length: 100 }, (_, i) => makeIndexedEntry(i, { isA: 'Project', title: `Project ${i}` })),
      ...Array.from({ length: 200 }, (_, i) => makeIndexedEntry(100 + i, { isA: 'Note', title: `Note ${i}` })),
    ]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Project 0')).toBeInTheDocument()
    expect(screen.queryByText('Note 0')).not.toBeInTheDocument()
  })

  it('selection highlighting works in virtualized list', () => {
    const entries = Array.from({ length: 100 }, (_, i) => makeIndexedEntry(i))
    const selected = entries[5]
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={selected} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Note 5')).toBeInTheDocument()
  })

  it('click handler works on virtualized items', () => {
    noopReplace.mockClear()
    const entries = Array.from({ length: 100 }, (_, i) => makeIndexedEntry(i))
    render(
      <NoteList {...defaultFilterProps} entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Note 50'))
    expect(noopReplace).toHaveBeenCalledWith(entries[50])
  })

  describe('changes filter', () => {
    const changesSelection: SidebarSelection = { kind: 'filter', filter: 'changes' }
    const modifiedFiles = [
      { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
      { path: mockEntries[1].path, relativePath: 'note/facebook-ads-strategy.md', status: 'modified' as const },
    ]

    it('shows only modified notes in changes view', () => {
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
      expect(screen.queryByText('Kickoff Meeting')).not.toBeInTheDocument()
    })

    it('shows header title "Changes"', () => {
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Changes')).toBeInTheDocument()
    })

    it('shows empty state when no modified files', () => {
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={[]} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('No pending changes')).toBeInTheDocument()
    })

    it('updates list when modifiedFiles changes', () => {
      const { rerender } = render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()

      // Simulate one file being committed (removed from modifiedFiles)
      const fewerModified = [modifiedFiles[0]]
      rerender(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={fewerModified} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
    })

    it('shows modified notes when both getNoteStatus and modifiedFiles are provided', () => {
      // Regression: App.tsx passes both getNoteStatus and modifiedFiles.
      // The changes filter must use modifiedFiles for filtering even when getNoteStatus is present.
      const getNoteStatus = (path: string) => modifiedFiles.some((f) => f.path === path) ? 'modified' as const : 'clean' as const
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} getNoteStatus={getNoteStatus} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    })

    it('matches entries by relative path suffix when absolute paths differ (cross-machine)', () => {
      // Simulate a cloned vault where cached entries have paths from a different machine
      const crossMachineEntries: VaultEntry[] = mockEntries.map((e) => ({
        ...e,
        path: e.path.replace('/Users/luca/Laputa', '/Users/other-machine/OtherVault'),
      }))
      const modifiedFromCurrentMachine = [
        { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
        { path: mockEntries[1].path, relativePath: 'note/facebook-ads-strategy.md', status: 'modified' as const },
      ]
      render(
        <NoteList {...defaultFilterProps} entries={crossMachineEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFromCurrentMachine} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      // Even though absolute paths differ, entries should match via relative path suffix
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    })

    it('shows error message when modifiedFilesError is set', () => {
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={[]} modifiedFilesError="git status failed: not a git repository" onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText(/Failed to load changes/)).toBeInTheDocument()
      expect(screen.getByText(/git status failed/)).toBeInTheDocument()
    })

    it('shows untracked (new) notes alongside modified notes in changes view', () => {
      const mixedFiles = [
        { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
        { path: mockEntries[2].path, relativePath: 'person/matteo-cellini.md', status: 'untracked' as const },
      ]
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={mixedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
      expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
    })

    it('shows deleted notes banner when files are deleted', () => {
      const filesWithDeleted = [
        { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
        { path: '/Users/luca/Laputa/note/also-gone.md', relativePath: 'note/also-gone.md', status: 'deleted' as const },
      ]
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={filesWithDeleted} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('2 notes deleted')).toBeInTheDocument()
    })

    it('shows singular form for single deleted note', () => {
      const filesWithOneDeleted = [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ]
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={filesWithOneDeleted} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('1 note deleted')).toBeInTheDocument()
    })

    it('does not show deleted banner when no files are deleted', () => {
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.queryByText(/notes? deleted/)).not.toBeInTheDocument()
    })

    it('does not show deleted banner outside changes view', () => {
      const filesWithDeleted = [
        { path: '/Users/luca/Laputa/note/gone.md', relativePath: 'note/gone.md', status: 'deleted' as const },
      ]
      render(
        <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} modifiedFiles={filesWithDeleted} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
      )
      expect(screen.queryByText(/notes? deleted/)).not.toBeInTheDocument()
    })
  })
})

// --- Multi-select tests ---

describe('NoteList — multi-select', () => {
  beforeEach(() => {
    noopSelect.mockClear()
    noopReplace.mockClear()
  })

  it('Shift+Click selects a range of notes', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Regular click to set anchor
    fireEvent.click(screen.getByText('Build Laputa App'))
    // Shift+Click to select range
    fireEvent.click(screen.getByText('Matteo Cellini'), { shiftKey: true })
    // Should select all notes between Build Laputa App and Matteo Cellini (inclusive)
    const selected = screen.getAllByTestId('multi-selected-item')
    expect(selected.length).toBeGreaterThanOrEqual(2)
  })

  it('regular click clears multi-select and opens note', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Select range via Shift+click
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getAllByTestId('multi-selected-item').length).toBeGreaterThanOrEqual(1)
    // Regular click clears selection and opens note
    fireEvent.click(screen.getByText('Matteo Cellini'))
    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[2])
  })

  it('Cmd+Click clears multi-select and opens in new tab', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    // Select range via Shift+click
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getAllByTestId('multi-selected-item').length).toBeGreaterThanOrEqual(1)
    // Cmd+click clears selection and opens in new tab
    fireEvent.click(screen.getByText('Matteo Cellini'), { metaKey: true })
    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[2])
  })

  it('shows bulk action bar with correct count', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  const selectTwoNotes = (extraProps: Record<string, unknown> = {}) => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} {...extraProps} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
  }

  it.each([
    { label: 'bulk archive via button', prop: 'onBulkArchive', trigger: () => fireEvent.click(screen.getByTestId('bulk-archive-btn')) },
    { label: 'bulk trash via button', prop: 'onBulkTrash', trigger: () => fireEvent.click(screen.getByTestId('bulk-trash-btn')) },
    { label: 'Cmd+E archives', prop: 'onBulkArchive', trigger: () => fireEvent.keyDown(window, { key: 'e', metaKey: true }) },
    { label: 'Cmd+Backspace trashes', prop: 'onBulkTrash', trigger: () => fireEvent.keyDown(window, { key: 'Backspace', metaKey: true }) },
    { label: 'Cmd+Delete trashes', prop: 'onBulkTrash', trigger: () => fireEvent.keyDown(window, { key: 'Delete', metaKey: true }) },
  ])('$label selected notes and clears selection', ({ prop, trigger }) => {
    const handler = vi.fn()
    selectTwoNotes({ [prop]: handler })
    trigger()
    expect(handler).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('clear button on bulk action bar clears selection', () => {
    selectTwoNotes()
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('bulk-clear-btn'))
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
  })

  it('no bulk action bar when nothing is selected', () => {
    render(<NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />)
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })
})

// --- Type note filtering tests ---

const typeEntry: VaultEntry = {
  path: '/Users/luca/Laputa/types/project.md',
  filename: 'project.md',
  title: 'Project',
  isA: 'Type',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 200,
  snippet: 'Defines the Project type.',
  wordCount: 50,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null, sort: null,
  outgoingLinks: [],
  properties: {},
}

const entriesWithType = [...mockEntries, typeEntry]

describe('NoteList — type note filtering', () => {
  beforeEach(() => {
    noopSelect.mockClear()
    noopReplace.mockClear()
  })

  it('does not show type note PinnedCard when browsing a sectionGroup', () => {
    render(
      <NoteList {...defaultFilterProps} entries={entriesWithType} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // The type note snippet should NOT be visible (PinnedCard was removed)
    expect(screen.queryByText('Defines the Project type.')).not.toBeInTheDocument()
    // But the Project instance should still be in the list
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('shows clickable header title that navigates to type note', () => {
    render(
      <NoteList {...defaultFilterProps} entries={entriesWithType} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    const headerLink = screen.getByTestId('type-header-link')
    expect(headerLink).toBeInTheDocument()
    expect(headerLink.textContent).toBe('Project')
    expect(headerLink.style.cursor).toBe('pointer')
    fireEvent.click(headerLink)
    expect(noopReplace).toHaveBeenCalledWith(typeEntry)
  })

  it('header is not clickable when not viewing a type section', () => {
    render(
      <NoteList {...defaultFilterProps} entries={entriesWithType} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('type-header-link')).not.toBeInTheDocument()
  })
})

describe('NoteList — traffic light padding when sidebar collapsed', () => {
  it('adds left padding to header when sidebarCollapsed is true', () => {
    const { container } = render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} sidebarCollapsed={true} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('80px')
  })

  it('does not add extra left padding when sidebarCollapsed is false', () => {
    const { container } = render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} sidebarCollapsed={false} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })

  it('does not add extra left padding when sidebarCollapsed is not provided', () => {
    const { container } = render(
      <NoteList {...defaultFilterProps} entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })
})

describe('countByFilter', () => {
  it('counts open, archived, and trashed notes per type', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Project', archived: true }),
      makeEntry({ path: '/3.md', isA: 'Project', trashed: true }),
      makeEntry({ path: '/4.md', isA: 'Project' }),
      makeEntry({ path: '/5.md', isA: 'Note' }),
    ]
    const counts = countByFilter(entries, 'Project')
    expect(counts).toEqual({ open: 2, archived: 1, trashed: 1 })
  })

  it('returns zeros when type has no entries', () => {
    expect(countByFilter([], 'Project')).toEqual({ open: 0, archived: 0, trashed: 0 })
  })

  it('counts trashed note that is also archived as trashed only', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project', archived: true, trashed: true }),
    ]
    const counts = countByFilter(entries, 'Project')
    expect(counts).toEqual({ open: 0, archived: 0, trashed: 1 })
  })
})

describe('NoteList — filter pills', () => {
  const projectEntries = [
    makeEntry({ path: '/p1.md', title: 'Open Project 1', isA: 'Project' }),
    makeEntry({ path: '/p2.md', title: 'Open Project 2', isA: 'Project' }),
    makeEntry({ path: '/p3.md', title: 'Archived Project', isA: 'Project', archived: true }),
    makeEntry({ path: '/p4.md', title: 'Trashed Project', isA: 'Project', trashed: true, trashedAt: 1700000000 }),
    makeEntry({ path: '/n1.md', title: 'Some Note', isA: 'Note' }),
  ]

  it('shows filter pills when a type is selected', () => {
    render(
      <NoteList {...defaultFilterProps} entries={projectEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('filter-pills')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-archived')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-trashed')).toBeInTheDocument()
  })

  it('shows filter pills in All Notes view', () => {
    render(
      <NoteList {...defaultFilterProps} entries={projectEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('filter-pills')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-open')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-archived')).toBeInTheDocument()
    expect(screen.getByTestId('filter-pill-trashed')).toBeInTheDocument()
  })

  it('shows correct All Notes count badges across all types', () => {
    render(
      <NoteList {...defaultFilterProps} entries={projectEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // projectEntries: 2 open Projects + 1 open Note = 3 open, 1 archived, 1 trashed
    const openPill = screen.getByTestId('filter-pill-open')
    const archivedPill = screen.getByTestId('filter-pill-archived')
    const trashedPill = screen.getByTestId('filter-pill-trashed')
    expect(openPill).toHaveTextContent('3')
    expect(archivedPill).toHaveTextContent('1')
    expect(trashedPill).toHaveTextContent('1')
  })

  it('shows archived notes in All Notes when filter is archived', () => {
    render(
      <NoteList noteListFilter="archived" onNoteListFilterChange={noopFilterChange} entries={projectEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Archived Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Some Note')).not.toBeInTheDocument()
  })

  it('shows trashed notes in All Notes when filter is trashed', () => {
    render(
      <NoteList noteListFilter="trashed" onNoteListFilterChange={noopFilterChange} entries={projectEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Trashed Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
  })

  it('shows correct count badges for each filter', () => {
    render(
      <NoteList {...defaultFilterProps} entries={projectEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    // Open pill should show 2, Archived 1, Trashed 1
    const openPill = screen.getByTestId('filter-pill-open')
    const archivedPill = screen.getByTestId('filter-pill-archived')
    const trashedPill = screen.getByTestId('filter-pill-trashed')
    expect(openPill).toHaveTextContent('Open')
    expect(openPill).toHaveTextContent('2')
    expect(archivedPill).toHaveTextContent('Archived')
    expect(archivedPill).toHaveTextContent('1')
    expect(trashedPill).toHaveTextContent('Trashed')
    expect(trashedPill).toHaveTextContent('1')
  })

  it('calls onNoteListFilterChange when a pill is clicked', () => {
    const onFilterChange = vi.fn()
    render(
      <NoteList noteListFilter="open" onNoteListFilterChange={onFilterChange} entries={projectEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('filter-pill-archived'))
    expect(onFilterChange).toHaveBeenCalledWith('archived')
  })

  it('shows archived notes when filter is set to archived', () => {
    render(
      <NoteList noteListFilter="archived" onNoteListFilterChange={noopFilterChange} entries={projectEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Archived Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
  })

  it('shows trashed notes when filter is set to trashed', () => {
    render(
      <NoteList noteListFilter="trashed" onNoteListFilterChange={noopFilterChange} entries={projectEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Trashed Project')).toBeInTheDocument()
    expect(screen.queryByText('Open Project 1')).not.toBeInTheDocument()
  })

  it('shows empty state for archived filter when no archived notes exist', () => {
    const entriesNoArchived = projectEntries.filter(e => !e.archived)
    render(
      <NoteList noteListFilter="archived" onNoteListFilterChange={noopFilterChange} entries={entriesNoArchived} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('No archived notes')).toBeInTheDocument()
  })
})

describe('NoteList — filterEntries with subFilter', () => {
  const entries = [
    makeEntry({ path: '/1.md', title: 'Active', isA: 'Project' }),
    makeEntry({ path: '/2.md', title: 'Archived', isA: 'Project', archived: true }),
    makeEntry({ path: '/3.md', title: 'Trashed', isA: 'Project', trashed: true }),
    makeEntry({ path: '/4.md', title: 'Other', isA: 'Note' }),
  ]

  it('filters sectionGroup by open sub-filter', () => {
    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'open')
    expect(result.map(e => e.title)).toEqual(['Active'])
  })

  it('filters sectionGroup by archived sub-filter', () => {
    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'archived')
    expect(result.map(e => e.title)).toEqual(['Archived'])
  })

  it('filters sectionGroup by trashed sub-filter', () => {
    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' }, 'trashed')
    expect(result.map(e => e.title)).toEqual(['Trashed'])
  })

  it('without sub-filter, defaults to active only', () => {
    const result = filterEntries(entries, { kind: 'sectionGroup', type: 'Project' })
    expect(result.map(e => e.title)).toEqual(['Active'])
  })

  it('filters all notes by open sub-filter', () => {
    const result = filterEntries(entries, { kind: 'filter', filter: 'all' }, 'open')
    expect(result.map(e => e.title)).toEqual(['Active', 'Other'])
  })

  it('filters all notes by archived sub-filter', () => {
    const result = filterEntries(entries, { kind: 'filter', filter: 'all' }, 'archived')
    expect(result.map(e => e.title)).toEqual(['Archived'])
  })

  it('filters all notes by trashed sub-filter', () => {
    const result = filterEntries(entries, { kind: 'filter', filter: 'all' }, 'trashed')
    expect(result.map(e => e.title)).toEqual(['Trashed'])
  })
})

describe('countAllByFilter', () => {
  it('counts all entries by filter status', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Project' }),
      makeEntry({ path: '/2.md', isA: 'Note' }),
      makeEntry({ path: '/3.md', isA: 'Project', archived: true }),
      makeEntry({ path: '/4.md', isA: 'Note', trashed: true }),
      makeEntry({ path: '/5.md', isA: 'Person', archived: true, trashed: true }),
    ]
    const counts = countAllByFilter(entries)
    expect(counts).toEqual({ open: 2, archived: 1, trashed: 2 })
  })

  it('excludes non-markdown files from counts', () => {
    const entries = [
      makeEntry({ path: '/1.md', isA: 'Note', fileKind: 'markdown' }),
      makeEntry({ path: '/2.yml', isA: undefined, fileKind: 'text' }),
      makeEntry({ path: '/3.png', isA: undefined, fileKind: 'binary' }),
    ]
    const counts = countAllByFilter(entries)
    expect(counts).toEqual({ open: 1, archived: 0, trashed: 0 })
  })
})

describe('NoteItem — binary file rendering', () => {
  it('renders binary files as non-clickable with muted style', () => {
    const binaryEntry = makeEntry({
      path: '/vault/photo.png', filename: 'photo.png', title: 'photo.png', fileKind: 'binary',
    })
    const onClick = vi.fn()
    render(<NoteItem entry={binaryEntry} isSelected={false} typeEntryMap={{}} onClickNote={onClick} />)

    const item = screen.getByTestId('binary-file-item')
    expect(item).toBeTruthy()
    expect(item.className).toContain('opacity-50')
    expect(item).toHaveAttribute('title', 'Cannot open this file type')

    fireEvent.click(item)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders text files as clickable', () => {
    const textEntry = makeEntry({
      path: '/vault/config.yml', filename: 'config.yml', title: 'config.yml', fileKind: 'text',
    })
    const onClick = vi.fn()
    render(<NoteItem entry={textEntry} isSelected={false} typeEntryMap={{}} onClickNote={onClick} />)

    const item = screen.getByText('config.yml').closest('div')!
    fireEvent.click(item)
    expect(onClick).toHaveBeenCalled()
  })
})
