import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoteList } from './NoteList'
import { getSortComparator, filterEntries } from '../utils/noteListHelpers'
import type { VaultEntry, SidebarSelection } from '../types'

const allSelection: SidebarSelection = { kind: 'filter', filter: 'all' }
const noopSelect = vi.fn()
const noopReplace = vi.fn()

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
    template: null,
    outgoingLinks: [],
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
    template: null,
    outgoingLinks: [],
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
    template: null,
    outgoingLinks: [],
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
    template: null,
    outgoingLinks: [],
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
    template: null,
    outgoingLinks: [],
  },
]

describe('NoteList', () => {
  it('shows empty state when no entries', () => {
    render(<NoteList entries={[]} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('No notes found')).toBeInTheDocument()
  })

  it('renders all entries with All Notes filter', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('filters by People (section group)', () => {
    render(<NoteList entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Person' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by Events (section group)', () => {
    render(<NoteList entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Event' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by section group type', () => {
    render(<NoteList entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
  })

  it('shows entity pinned at top with grouped children', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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

  it('filters by topic (relatedTo references)', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'topic', entry: mockEntries[4] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Build Laputa App has relatedTo: [[topic/software-development]]
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
  })

  it('shows search input when search icon is clicked', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    // Search is hidden by default
    expect(screen.queryByPlaceholderText('Search notes...')).not.toBeInTheDocument()
    // Click search icon to show it
    fireEvent.click(screen.getByTitle('Search notes'))
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('filters by search query (case-insensitive substring)', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
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
    render(<NoteList entries={entriesWithDifferentDates} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    const titles = screen.getAllByText(/Oldest|Newest|Middle/)
    const titleTexts = titles.map((el) => el.textContent)
    expect(titleTexts).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('does not render type badge or status on note items', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    // Type badges like "Project", "Note" etc. should not appear as separate badge elements
    // The word "Project" should only appear in the ALL CAPS pill "PROJECTS 1", not as a standalone badge
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('header shows search and plus icons instead of count badge', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByTitle('Search notes')).toBeInTheDocument()
    expect(screen.getByTitle('Create new note')).toBeInTheDocument()
  })

  it('context view shows backlinks from allContent', () => {
    const allContent = {
      [mockEntries[2].path]: 'Met with [[project/26q1-laputa-app]] team.',
    }
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={allContent} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Backlinks')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('context view collapses and expands groups', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[0])
    expect(noopSelect).not.toHaveBeenCalled()
  })

  it('Cmd+Click calls onSelectNote (opens in new tab)', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'), { metaKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('Ctrl+Click calls onSelectNote (Windows/Linux)', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'), { ctrlKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('Cmd+Click on entity pinned card calls onSelectNote', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1], { metaKey: true })
    expect(noopSelect).toHaveBeenCalledWith(mockEntries[0])
    expect(noopReplace).not.toHaveBeenCalled()
  })

  it('regular click on entity pinned card calls onReplaceActiveTab', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Title appears in both header and pinned card — use getAllByText and click the pinned card instance
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1])
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[0])
    expect(noopSelect).not.toHaveBeenCalled()
  })

  it('click on child note in entity view calls onReplaceActiveTab', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Facebook Ads Strategy'))
    expect(noopReplace).toHaveBeenCalledWith(mockEntries[1])
    expect(noopSelect).not.toHaveBeenCalled()
  })
})

describe('getSortComparator', () => {
  const makeEntry = (overrides: Partial<VaultEntry>): VaultEntry => ({
    path: '/test.md',
    filename: 'test.md',
    title: 'Test',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: null,
    createdAt: null,
    fileSize: 100,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null,
    outgoingLinks: [],
    ...overrides,
  })

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

  const makeEntry = (overrides: Partial<VaultEntry>): VaultEntry => ({
    path: '/test.md',
    filename: 'test.md',
    title: 'Test',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: null,
    createdAt: null,
    fileSize: 100,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null,
    outgoingLinks: [],
    ...overrides,
  })

  it('shows sort button in note list header for flat view', () => {
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('sort-button-__list__')).toBeInTheDocument()
  })

  it('shows sort dropdown per relationship subsection in entity view', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.getByTestId('sort-button-Children')).toBeInTheDocument()
  })

  it('opens sort menu on click and shows all options', () => {
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    expect(screen.getByTestId('sort-menu-__list__')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-created')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-title')).toBeInTheDocument()
    expect(screen.getByTestId('sort-option-status')).toBeInTheDocument()
  })

  it('changes sort order when an option is selected', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'Zebra', modifiedAt: 3000 }),
      makeEntry({ path: '/b.md', title: 'Alpha', modifiedAt: 1000 }),
      makeEntry({ path: '/c.md', title: 'Middle', modifiedAt: 2000 }),
    ]
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Default sort: by modified (Zebra first)
    let titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra', 'Middle', 'Alpha'])

    // Switch to title sort
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    fireEvent.click(screen.getByTestId('sort-option-title'))

    // Now should be alphabetical
    titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Alpha', 'Middle', 'Zebra'])
  })

  it('closes sort menu after selecting an option', () => {
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    expect(screen.getByTestId('sort-menu-__list__')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sort-option-title'))
    expect(screen.queryByTestId('sort-menu-__list__')).not.toBeInTheDocument()
  })

  it('shows direction arrows in sort dropdown menu', () => {
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
    // Each option should have asc and desc direction buttons
    expect(screen.getByTestId('sort-dir-asc-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-desc-modified')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-asc-title')).toBeInTheDocument()
    expect(screen.getByTestId('sort-dir-desc-title')).toBeInTheDocument()
  })

  it('reverses sort order when clicking direction arrow', () => {
    const entries = [
      makeEntry({ path: '/a.md', title: 'Zebra', modifiedAt: 3000 }),
      makeEntry({ path: '/b.md', title: 'Alpha', modifiedAt: 1000 }),
      makeEntry({ path: '/c.md', title: 'Middle', modifiedAt: 2000 }),
    ]
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Default sort: modified descending (Zebra first at 3000)
    let titles = screen.getAllByText(/Zebra|Alpha|Middle/).map((el) => el.textContent)
    expect(titles).toEqual(['Zebra', 'Middle', 'Alpha'])

    // Click the asc arrow for modified to reverse
    fireEvent.click(screen.getByTestId('sort-button-__list__'))
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
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
      <NoteList entries={entries} selection={{ kind: 'entity', entry: parent }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
  template: null,
  outgoingLinks: [],
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
  template: null,
  outgoingLinks: [],
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

  it('topic filter excludes trashed entries', () => {
    const topicEntry: VaultEntry = { ...mockEntries[4] } // Software Development topic
    const trashedWithTopic: VaultEntry = {
      ...trashedEntry,
      relatedTo: ['[[topic/software-development]]'],
    }
    const all = [...mockEntries, trashedWithTopic]
    const result = filterEntries(all, { kind: 'topic', entry: topicEntry })
    expect(result.find((e) => e.title === 'Old Draft Notes')).toBeUndefined()
    // Normal entry with that topic should still appear
    expect(result.find((e) => e.title === 'Build Laputa App')).toBeDefined()
  })
})

describe('NoteList — status indicators', () => {
  it('shows modified indicator dot for modified notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'modified' as const : 'clean' as const
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    const indicators = screen.getAllByTestId('modified-indicator')
    expect(indicators).toHaveLength(1)
    const noteRow = indicators[0].closest('[data-testid="modified-indicator"]')!.parentElement!.parentElement!
    expect(noteRow.textContent).toContain('Build Laputa App')
  })

  it('does not show indicator when all notes are clean', () => {
    const getNoteStatus = () => 'clean' as const
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows multiple modified indicators for multiple modified files', () => {
    const modifiedPaths = new Set([mockEntries[0].path, mockEntries[1].path])
    const getNoteStatus = (path: string) => modifiedPaths.has(path) ? 'modified' as const : 'clean' as const
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.getAllByTestId('modified-indicator')).toHaveLength(2)
  })

  it('does not show indicator when getNoteStatus prop is undefined', () => {
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument()
  })

  it('shows green new indicator for new notes', () => {
    const getNoteStatus = (path: string) => path === mockEntries[0].path ? 'new' as const : 'clean' as const
    render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} getNoteStatus={getNoteStatus} onCreateNote={vi.fn()} />
    )
    expect(screen.getAllByTestId('new-indicator')).toHaveLength(1)
    expect(screen.queryByTestId('modified-indicator')).not.toBeInTheDocument()
  })
})

describe('NoteList — trash view', () => {
  const trashSelection: SidebarSelection = { kind: 'filter', filter: 'trash' }

  it('shows "Trash" header when trash filter is active', () => {
    render(<NoteList entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Trash')).toBeInTheDocument()
  })

  it('shows only trashed entries in trash view', () => {
    render(<NoteList entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Old Draft Notes')).toBeInTheDocument()
    expect(screen.getByText('Deprecated API Notes')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('shows TRASHED badge on trashed entries', () => {
    render(<NoteList entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    const badges = screen.getAllByText('TRASHED')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows 30-day warning banner when expired notes exist', () => {
    render(<NoteList entries={entriesWithTrashed} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Notes in trash for 30+ days will be permanently deleted')).toBeInTheDocument()
    expect(screen.getByText(/1 note is past the 30-day retention period/)).toBeInTheDocument()
  })

  it('shows "Trash is empty" when no trashed entries', () => {
    render(<NoteList entries={mockEntries} selection={trashSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
  })
})

// --- Virtual list performance tests ---

describe('NoteList — virtual list with large datasets', () => {
  const makeEntry = (i: number, overrides?: Partial<VaultEntry>): VaultEntry => ({
    path: `/vault/note/note-${i}.md`,
    filename: `note-${i}.md`,
    title: `Note ${i}`,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000 - i * 60,
    createdAt: null,
    fileSize: 500,
    snippet: `Content of note ${i}`,
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    template: null,
    outgoingLinks: [],
    ...overrides,
  })

  it('renders 9000 entries without crashing', { timeout: 30000 }, () => {
    const largeDataset = Array.from({ length: 9000 }, (_, i) => makeEntry(i))
    const { container } = render(
      <NoteList entries={largeDataset} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Virtuoso mock renders all items; the real component only renders visible ones
    expect(container.querySelector('[data-testid="virtuoso-mock"]')).toBeInTheDocument()
  })

  it('renders items from a large dataset via Virtuoso', () => {
    const largeDataset = Array.from({ length: 500 }, (_, i) => makeEntry(i))
    render(
      <NoteList entries={largeDataset} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Note 0')).toBeInTheDocument()
    expect(screen.getByText('Note 499')).toBeInTheDocument()
  })

  it('search filters large dataset correctly', () => {
    const entries = [
      makeEntry(0, { title: 'Alpha Strategy' }),
      ...Array.from({ length: 998 }, (_, i) => makeEntry(i + 1, { title: `Filler Note ${i + 1}` })),
      makeEntry(999, { title: 'Beta Strategy' }),
    ]
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Search notes'))
    fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'Strategy' } })
    expect(screen.getByText('Alpha Strategy')).toBeInTheDocument()
    expect(screen.getByText('Beta Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Filler Note 1')).not.toBeInTheDocument()
  })

  it('sorting works with large dataset', () => {
    const entries = [
      makeEntry(0, { title: 'Zebra', modifiedAt: 1000 }),
      makeEntry(1, { title: 'Alpha', modifiedAt: 3000 }),
      ...Array.from({ length: 100 }, (_, i) => makeEntry(i + 2, { title: `Mid ${i}`, modifiedAt: 2000 - i })),
    ]
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Default sort is modified desc — Alpha (3000) should come first
    const firstTitle = screen.getAllByText(/^Alpha$|^Zebra$/)[0]
    expect(firstTitle.textContent).toBe('Alpha')
  })

  it('section group filter works with large mixed-type dataset', () => {
    const entries = [
      ...Array.from({ length: 100 }, (_, i) => makeEntry(i, { isA: 'Project', title: `Project ${i}` })),
      ...Array.from({ length: 200 }, (_, i) => makeEntry(100 + i, { isA: 'Note', title: `Note ${i}` })),
    ]
    render(
      <NoteList entries={entries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Project 0')).toBeInTheDocument()
    expect(screen.queryByText('Note 0')).not.toBeInTheDocument()
  })

  it('selection highlighting works in virtualized list', () => {
    const entries = Array.from({ length: 100 }, (_, i) => makeEntry(i))
    const selected = entries[5]
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={selected} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.getByText('Note 5')).toBeInTheDocument()
  })

  it('click handler works on virtualized items', () => {
    noopReplace.mockClear()
    const entries = Array.from({ length: 100 }, (_, i) => makeEntry(i))
    render(
      <NoteList entries={entries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
      expect(screen.queryByText('Kickoff Meeting')).not.toBeInTheDocument()
    })

    it('shows header title "Changes"', () => {
      render(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Changes')).toBeInTheDocument()
    })

    it('shows empty state when no modified files', () => {
      render(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={[]} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('No pending changes')).toBeInTheDocument()
    })

    it('updates list when modifiedFiles changes', () => {
      const { rerender } = render(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()

      // Simulate one file being committed (removed from modifiedFiles)
      const fewerModified = [modifiedFiles[0]]
      rerender(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={fewerModified} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
    })

    it('shows modified notes when both getNoteStatus and modifiedFiles are provided', () => {
      // Regression: App.tsx passes both getNoteStatus and modifiedFiles.
      // The changes filter must use modifiedFiles for filtering even when getNoteStatus is present.
      const getNoteStatus = (path: string) => modifiedFiles.some((f) => f.path === path) ? 'modified' as const : 'clean' as const
      render(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={modifiedFiles} getNoteStatus={getNoteStatus} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    })

    it('shows untracked (new) notes alongside modified notes in changes view', () => {
      const mixedFiles = [
        { path: mockEntries[0].path, relativePath: 'project/26q1-laputa-app.md', status: 'modified' as const },
        { path: mockEntries[2].path, relativePath: 'person/matteo-cellini.md', status: 'untracked' as const },
      ]
      render(
        <NoteList entries={mockEntries} selection={changesSelection} selectedNote={null} modifiedFiles={mixedFiles} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
      )
      expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
      expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
      expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
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
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    // Regular click to set anchor
    fireEvent.click(screen.getByText('Build Laputa App'))
    // Shift+Click to select range
    fireEvent.click(screen.getByText('Matteo Cellini'), { shiftKey: true })
    // Should select all notes between Build Laputa App and Matteo Cellini (inclusive)
    const selected = screen.getAllByTestId('multi-selected-item')
    expect(selected.length).toBeGreaterThanOrEqual(2)
  })

  it('regular click clears multi-select and opens note', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
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
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
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
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('bulk archive calls onBulkArchive and clears selection', () => {
    const onBulkArchive = vi.fn()
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} onBulkArchive={onBulkArchive} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('bulk-archive-btn'))
    expect(onBulkArchive).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('bulk trash calls onBulkTrash and clears selection', () => {
    const onBulkTrash = vi.fn()
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} onBulkTrash={onBulkTrash} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('bulk-trash-btn'))
    expect(onBulkTrash).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('clear button on bulk action bar clears selection', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('bulk-clear-btn'))
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('multi-selected-item')).not.toBeInTheDocument()
  })

  it('Cmd+E archives selected notes when multiselect is active', () => {
    const onBulkArchive = vi.fn()
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} onBulkArchive={onBulkArchive} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'e', metaKey: true })
    expect(onBulkArchive).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('Cmd+Backspace trashes selected notes when multiselect is active', () => {
    const onBulkTrash = vi.fn()
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} onBulkTrash={onBulkTrash} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Backspace', metaKey: true })
    expect(onBulkTrash).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('Cmd+Delete trashes selected notes when multiselect is active', () => {
    const onBulkTrash = vi.fn()
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} onBulkTrash={onBulkTrash} />)
    fireEvent.click(screen.getByText('Build Laputa App'))
    fireEvent.click(screen.getByText('Facebook Ads Strategy'), { shiftKey: true })
    fireEvent.keyDown(window, { key: 'Delete', metaKey: true })
    expect(onBulkTrash).toHaveBeenCalledWith([mockEntries[0].path, mockEntries[1].path])
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument()
  })

  it('no bulk action bar when nothing is selected', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />)
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
  template: null,
  outgoingLinks: [],
}

const entriesWithType = [...mockEntries, typeEntry]

describe('NoteList — type note filtering', () => {
  beforeEach(() => {
    noopSelect.mockClear()
    noopReplace.mockClear()
  })

  it('does not show type note PinnedCard when browsing a sectionGroup', () => {
    render(
      <NoteList entries={entriesWithType} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    // The type note snippet should NOT be visible (PinnedCard was removed)
    expect(screen.queryByText('Defines the Project type.')).not.toBeInTheDocument()
    // But the Project instance should still be in the list
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('shows clickable header title that navigates to type note', () => {
    render(
      <NoteList entries={entriesWithType} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
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
      <NoteList entries={entriesWithType} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    expect(screen.queryByTestId('type-header-link')).not.toBeInTheDocument()
  })
})

describe('NoteList — traffic light padding when sidebar collapsed', () => {
  it('adds left padding to header when sidebarCollapsed is true', () => {
    const { container } = render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} sidebarCollapsed={true} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('80px')
  })

  it('does not add extra left padding when sidebarCollapsed is false', () => {
    const { container } = render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} sidebarCollapsed={false} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })

  it('does not add extra left padding when sidebarCollapsed is not provided', () => {
    const { container } = render(
      <NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} onReplaceActiveTab={noopReplace} allContent={{}} onCreateNote={vi.fn()} />
    )
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })
})
