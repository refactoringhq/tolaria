import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Sidebar } from './Sidebar'
import type { VaultEntry, SidebarSelection } from '../types'

// Mock localStorage for section visibility tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const mockEntries: VaultEntry[] = [
  {
    path: '/vault/project/build-app.md',
    filename: 'build-app.md',
    title: 'Build Laputa App',
    isA: 'Project',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    owner: 'Luca',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 1024,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/responsibility/grow-newsletter.md',
    filename: 'grow-newsletter.md',
    title: 'Grow Newsletter',
    isA: 'Responsibility',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    owner: 'Luca',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 512,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/experiment/stock-screener.md',
    filename: 'stock-screener.md',
    title: 'Stock Screener',
    isA: 'Experiment',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    owner: 'Luca',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 256,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/procedure/weekly-essays.md',
    filename: 'weekly-essays.md',
    title: 'Write Weekly Essays',
    isA: 'Procedure',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    owner: 'Luca',
    cadence: 'Weekly',
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 128,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/topic/software-development.md',
    filename: 'software-development.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: ['Dev', 'Coding'],
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
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/topic/trading.md',
    filename: 'trading.md',
    title: 'Trading',
    isA: 'Topic',
    aliases: ['Algorithmic Trading'],
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
    fileSize: 180,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/person/alice.md',
    filename: 'alice.md',
    title: 'Alice',
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
    fileSize: 100,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
  {
    path: '/vault/event/kickoff.md',
    filename: 'kickoff.md',
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
    fileSize: 200,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
  },
]

const defaultSelection: SidebarSelection = { kind: 'filter', filter: 'all' }

describe('Sidebar', () => {
  it('renders top nav items (All Notes and Favorites)', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('renders section group headers only for types present in entries', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Experiments')).toBeInTheDocument()
    expect(screen.getByText('Responsibilities')).toBeInTheDocument()
    expect(screen.getByText('Procedures')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.getByText('Topics')).toBeInTheDocument()
    // No entries with isA: 'Type' in mockEntries → Types section absent
    expect(screen.queryByText('Types')).not.toBeInTheDocument()
  })

  it('shows entity names under their section groups after expanding', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    // Sections start collapsed by default — expand them first
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    fireEvent.click(screen.getByLabelText('Expand Responsibilities'))
    fireEvent.click(screen.getByLabelText('Expand Experiments'))
    fireEvent.click(screen.getByLabelText('Expand Procedures'))
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Grow Newsletter')).toBeInTheDocument()
    expect(screen.getByText('Stock Screener')).toBeInTheDocument()
    expect(screen.getByText('Write Weekly Essays')).toBeInTheDocument()
  })

  it('shows People and Events items after expanding', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    fireEvent.click(screen.getByLabelText('Expand People'))
    fireEvent.click(screen.getByLabelText('Expand Events'))
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument()
  })

  it('collapses and expands sections', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    // Start collapsed — items hidden
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()

    // Expand
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()

    // Collapse
    fireEvent.click(screen.getByLabelText('Collapse Projects'))
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('calls onSelect when clicking an entity', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    fireEvent.click(screen.getByText('Build Laputa App'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'entity',
      entry: mockEntries[0],
    })
  })

  it('calls onSelect when clicking a section header', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Projects'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'sectionGroup',
      type: 'Project',
    })
  })

  it('expands a collapsed section when clicking its header', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    // Sections start collapsed — items hidden
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
    // Click the section header text (not the chevron)
    fireEvent.click(screen.getByText('Projects'))
    // Section should now be expanded
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('collapses an expanded+selected section when clicking its header again', () => {
    const projectSelection: SidebarSelection = { kind: 'sectionGroup', type: 'Project' }
    render(<Sidebar entries={mockEntries} selection={projectSelection} onSelect={() => {}} />)
    // First click expands (starts collapsed) and selects
    fireEvent.click(screen.getByText('Projects'))
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    // Second click: section is expanded + selected → should collapse
    fireEvent.click(screen.getByText('Projects'))
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('selects but keeps expanded an unselected expanded section when clicking its header', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    // Expand via chevron first
    fireEvent.click(screen.getByLabelText('Expand Projects'))
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    // Click the header — section is expanded but not selected → should select and stay expanded
    fireEvent.click(screen.getByText('Projects'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'sectionGroup', type: 'Project' })
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('calls onSelect with sectionGroup for People', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('People'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'sectionGroup',
      type: 'Person',
    })
  })

  it('renders Topics section with topic entries after expanding', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.getByText('Topics')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Expand Topics'))
    expect(screen.getByText('Software Development')).toBeInTheDocument()
    expect(screen.getByText('Trading')).toBeInTheDocument()
  })

  it('calls onSelect with topic kind when clicking a topic', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Expand Topics'))
    fireEvent.click(screen.getByText('Software Development'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'topic',
      entry: mockEntries[4],
    })
  })

  it('renders + buttons for each section group when onCreateType is provided', () => {
    const onCreateType = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} onCreateType={onCreateType} />)
    const createButtons = screen.getAllByTitle(/^New /)
    expect(createButtons.length).toBe(7) // Projects, Experiments, Responsibilities, Procedures, People, Events, Topics (no Type entries → no Types section)
  })

  it('calls onCreateType with correct type when + button is clicked', () => {
    const onCreateType = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} onCreateType={onCreateType} />)
    fireEvent.click(screen.getByTitle('New Project'))
    expect(onCreateType).toHaveBeenCalledWith('Project')
  })

  it('does not render + buttons when onCreateType is not provided', () => {
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.queryByTitle('New Project')).not.toBeInTheDocument()
  })

  it('renders commit button even when no modified files', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} onCommitPush={() => {}} />)
    expect(screen.getByText('Commit & Push')).toBeInTheDocument()
  })

  it('shows badge on commit button when modified files exist', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} modifiedCount={3} onCommitPush={() => {}} />)
    expect(screen.getByText('Commit & Push')).toBeInTheDocument()
    const badges = screen.getAllByText('3')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows Changes nav item when modifiedCount > 0', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} modifiedCount={5} />)
    expect(screen.getByText('Changes')).toBeInTheDocument()
  })

  it('hides Changes nav item when modifiedCount is 0', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} modifiedCount={0} />)
    expect(screen.queryByText('Changes')).not.toBeInTheDocument()
  })

  it('calls onSelect with changes filter when clicking Changes', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={onSelect} modifiedCount={3} />)
    fireEvent.click(screen.getByText('Changes'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'filter', filter: 'changes' })
  })

  describe('dynamic custom type sections', () => {
    const entriesWithCustomTypes: VaultEntry[] = [
      ...mockEntries,
      {
        path: '/vault/type/recipe.md',
        filename: 'recipe.md',
        title: 'Recipe',
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
        snippet: '',
        wordCount: 0,
        relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
      },
      {
        path: '/vault/type/book.md',
        filename: 'book.md',
        title: 'Book',
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
        snippet: '',
        wordCount: 0,
        relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
      },
      {
        path: '/vault/recipe/pasta.md',
        filename: 'pasta.md',
        title: 'Pasta Carbonara',
        isA: 'Recipe',
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
        fileSize: 300,
        snippet: '',
        wordCount: 0,
        relationships: {},
        icon: null,
        color: null,
        order: null,
        template: null,
        outgoingLinks: [],
      },
      {
        path: '/vault/book/ddia.md',
        filename: 'ddia.md',
        title: 'Designing Data-Intensive Applications',
        isA: 'Book',
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
        fileSize: 400,
        snippet: '',
        wordCount: 0,
        relationships: {},
        icon: null,
        color: null,
        order: null,
        template: null,
        outgoingLinks: [],
      },
    ]

    it('renders custom type sections derived from actual entries', () => {
      render(<Sidebar entries={entriesWithCustomTypes} selection={defaultSelection} onSelect={() => {}} onCreateType={() => {}} />)
      expect(screen.getByText('Books')).toBeInTheDocument()
      expect(screen.getByText('Recipes')).toBeInTheDocument()
    })

    it('shows instances of custom types under their section after expanding', () => {
      render(<Sidebar entries={entriesWithCustomTypes} selection={defaultSelection} onSelect={() => {}} onCreateType={() => {}} />)
      fireEvent.click(screen.getByLabelText('Expand Recipes'))
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
    })

    it('renders + button on custom type sections for creating instances', () => {
      const onCreateType = vi.fn()
      render(<Sidebar entries={entriesWithCustomTypes} selection={defaultSelection} onSelect={() => {}} onCreateType={onCreateType} />)
      fireEvent.click(screen.getByTitle('New Recipe'))
      expect(onCreateType).toHaveBeenCalledWith('Recipe')
    })

    it('calls onCreateNewType when + is clicked on Types section', () => {
      const onCreateNewType = vi.fn()
      render(<Sidebar entries={entriesWithCustomTypes} selection={defaultSelection} onSelect={() => {}} onCreateNewType={onCreateNewType} />)
      fireEvent.click(screen.getByTitle('New Type'))
      expect(onCreateNewType).toHaveBeenCalled()
    })

    it('does not show section for type with zero active entries', () => {
      // Only Type definitions exist for Book, no actual Book instances
      const entriesNoBookInstance = entriesWithCustomTypes.filter((e) => !(e.isA === 'Book' && e.title !== 'Book'))
      render(<Sidebar entries={entriesNoBookInstance} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.queryByText('Books')).not.toBeInTheDocument()
      // Recipes still has an instance (Pasta Carbonara)
      expect(screen.getByText('Recipes')).toBeInTheDocument()
    })

    it('hides type section when all entries of that type are trashed', () => {
      const entriesWithTrashedOnly: VaultEntry[] = [
        {
          path: '/vault/event/cancelled.md', filename: 'cancelled.md', title: 'Cancelled Event',
          isA: 'Event', aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
          cadence: null, archived: false, trashed: true, trashedAt: 1700000000,
          modifiedAt: 1700000000, createdAt: null, fileSize: 100, snippet: '', wordCount: 0,
          relationships: {}, icon: null, color: null, order: null, sidebarLabel: null, outgoingLinks: [],
        },
      ]
      render(<Sidebar entries={entriesWithTrashedOnly} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.queryByText('Events')).not.toBeInTheDocument()
    })

    it('shows no sections when entries list is empty', () => {
      render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.queryByText('Projects')).not.toBeInTheDocument()
      expect(screen.queryByText('People')).not.toBeInTheDocument()
      expect(screen.queryByText('Events')).not.toBeInTheDocument()
    })

    it('does not show built-in types as custom sections', () => {
      const projectTypeEntry: VaultEntry = {
        path: '/vault/type/project.md',
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
        snippet: '',
        wordCount: 0,
        relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    outgoingLinks: [],
      }
      render(<Sidebar entries={[...mockEntries, projectTypeEntry]} selection={defaultSelection} onSelect={() => {}} />)
      // "Projects" should appear once (the built-in section), not twice
      const projectLabels = screen.getAllByText('Projects')
      expect(projectLabels.length).toBe(1)
    })

    it('uses sidebarLabel from Type entry instead of auto-pluralization', () => {
      const entriesWithLabel: VaultEntry[] = [
        ...mockEntries,
        {
          path: '/vault/type/news.md', filename: 'news.md', title: 'News', isA: 'Type',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 200, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: 'News', outgoingLinks: [],
        },
        {
          path: '/vault/news/breaking.md', filename: 'breaking.md', title: 'Breaking Story', isA: 'News',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 300, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: null, outgoingLinks: [],
        },
      ]
      render(<Sidebar entries={entriesWithLabel} selection={defaultSelection} onSelect={() => {}} />)
      // Should show "News" (custom label), not "Newses" (auto-pluralized)
      expect(screen.getByText('News')).toBeInTheDocument()
      expect(screen.queryByText('Newses')).not.toBeInTheDocument()
    })

    it('uses sidebarLabel to override built-in type label', () => {
      const entriesWithBuiltInOverride: VaultEntry[] = [
        ...mockEntries,
        {
          path: '/vault/type/person.md', filename: 'person.md', title: 'Person', isA: 'Type',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 200, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: 'Contacts', outgoingLinks: [],
        },
      ]
      render(<Sidebar entries={entriesWithBuiltInOverride} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('Contacts')).toBeInTheDocument()
      expect(screen.queryByText('People')).not.toBeInTheDocument()
    })

    it('falls back to auto-pluralization when sidebarLabel is null', () => {
      render(<Sidebar entries={entriesWithCustomTypes} selection={defaultSelection} onSelect={() => {}} />)
      // Recipe has no sidebarLabel → should auto-pluralize to "Recipes"
      expect(screen.getByText('Recipes')).toBeInTheDocument()
    })
  })

  describe('customize section visibility', () => {
    beforeEach(() => {
      localStorageMock.clear()
    })

    it('renders a "Customize sections" button', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByTitle('Customize sections')).toBeInTheDocument()
    })

    it('opens popover with toggle for each section when clicking customize button', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      fireEvent.click(screen.getByTitle('Customize sections'))
      expect(screen.getByText('Show in sidebar')).toBeInTheDocument()
      expect(screen.getByLabelText('Toggle Projects')).toBeInTheDocument()
      expect(screen.getByLabelText('Toggle People')).toBeInTheDocument()
      expect(screen.getByLabelText('Toggle Topics')).toBeInTheDocument()
    })

    it('hides a section when its toggle is clicked off', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      // People section header should be visible initially
      expect(screen.getByText('People')).toBeInTheDocument()

      // Open customize popover and toggle People off
      fireEvent.click(screen.getByTitle('Customize sections'))
      fireEvent.click(screen.getByLabelText('Toggle People'))

      // People section header should be gone (use getAllByText to handle popover)
      const peopleElements = screen.queryAllByText('People')
      // Only the toggle label in the popover should remain, not the section header
      expect(peopleElements.length).toBeLessThanOrEqual(1)
    })

    it('re-shows a section when its toggle is clicked on again', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)

      // Hide People
      fireEvent.click(screen.getByTitle('Customize sections'))
      fireEvent.click(screen.getByLabelText('Toggle People'))

      // Show People again
      fireEvent.click(screen.getByLabelText('Toggle People'))
      // People section should be visible again — popover toggle + section header = 2 "People" texts
      const peopleElements = screen.getAllByText('People')
      expect(peopleElements.length).toBe(2)
    })

    it('persists hidden sections in localStorage', () => {
      const { unmount } = render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      fireEvent.click(screen.getByTitle('Customize sections'))
      fireEvent.click(screen.getByLabelText('Toggle Events'))
      unmount()

      // Verify localStorage was updated
      const stored = JSON.parse(localStorage.getItem('laputa-hidden-sections') || '[]')
      expect(stored).toContain('Event')
    })

    it('restores hidden sections from localStorage on mount', () => {
      localStorage.setItem('laputa-hidden-sections', JSON.stringify(['Person', 'Event']))
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)

      // People and Events section headers should be hidden
      expect(screen.queryByText('People')).not.toBeInTheDocument()
      expect(screen.queryByText('Events')).not.toBeInTheDocument()

      // Other section headers should still be visible
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Topics')).toBeInTheDocument()
    })

    it('does not affect All Notes or other sidebar filters when sections are hidden', () => {
      localStorage.setItem('laputa-hidden-sections', JSON.stringify(['Project', 'Person']))
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)

      // Top nav items still present
      expect(screen.getByText('All Notes')).toBeInTheDocument()
      expect(screen.getByText('Favorites')).toBeInTheDocument()
    })

    it('closes popover when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside">outside</div>
          <Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />
        </div>
      )
      fireEvent.click(screen.getByTitle('Customize sections'))
      expect(screen.getByText('Show in sidebar')).toBeInTheDocument()

      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(screen.queryByText('Show in sidebar')).not.toBeInTheDocument()
    })
  })

  describe('section ordering by type order property', () => {
    const entriesWithOrder: VaultEntry[] = [
      ...mockEntries,
      // Type entries with order values — reversed from default
      {
        path: '/vault/type/project.md', filename: 'project.md', title: 'Project', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 5, sidebarLabel: null, outgoingLinks: [],
      },
      {
        path: '/vault/type/topic.md', filename: 'topic.md', title: 'Topic', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 0, sidebarLabel: null, outgoingLinks: [],
      },
      {
        path: '/vault/type/person.md', filename: 'person.md', title: 'Person', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 1, sidebarLabel: null, outgoingLinks: [],
      },
    ]

    it('sorts sections by order from Type entries', () => {
      render(<Sidebar entries={entriesWithOrder} selection={defaultSelection} onSelect={() => {}} />)
      // Get all section header labels
      const headers = screen.getAllByText(/^(Topics|People|Projects|Experiments|Responsibilities|Procedures|Events|Types)$/)
      const labels = headers.map((el) => el.textContent)

      // Topics (order: 0) and People (order: 1) should come before Projects (order: 5)
      const topicsIdx = labels.indexOf('Topics')
      const peopleIdx = labels.indexOf('People')
      const projectsIdx = labels.indexOf('Projects')

      expect(topicsIdx).toBeLessThan(projectsIdx)
      expect(peopleIdx).toBeLessThan(projectsIdx)
      expect(topicsIdx).toBeLessThan(peopleIdx)
    })

    it('does not render drag handle icons on section headers', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      const dragHandles = screen.queryAllByLabelText(/^Drag to reorder/)
      expect(dragHandles.length).toBe(0)
    })
  })

  describe('rename section via context menu', () => {
    it('shows Rename section option in context menu on right-click', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      expect(screen.getByText('Rename section…')).toBeInTheDocument()
    })

    it('shows Customize icon option in context menu on right-click', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      expect(screen.getByText('Customize icon & color…')).toBeInTheDocument()
    })

    it('shows inline input when Rename section is clicked', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      fireEvent.click(screen.getByText('Rename section…'))
      expect(screen.getByRole('textbox', { name: 'Section name' })).toBeInTheDocument()
    })

    it('inline input is pre-filled with current label', () => {
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      fireEvent.click(screen.getByText('Rename section…'))
      const input = screen.getByRole('textbox', { name: 'Section name' }) as HTMLInputElement
      expect(input.value).toBe('Projects')
    })

    it('calls onRenameSection with new name on Enter', () => {
      const onRenameSection = vi.fn()
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} onRenameSection={onRenameSection} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      fireEvent.click(screen.getByText('Rename section…'))
      const input = screen.getByRole('textbox', { name: 'Section name' })
      fireEvent.change(input, { target: { value: 'My Projects' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onRenameSection).toHaveBeenCalledWith('Project', 'My Projects')
    })

    it('cancels rename on Escape and hides input', () => {
      const onRenameSection = vi.fn()
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} onRenameSection={onRenameSection} />)
      const projectHeader = screen.getByText('Projects').closest('div')!
      fireEvent.contextMenu(projectHeader)
      fireEvent.click(screen.getByText('Rename section…'))
      const input = screen.getByRole('textbox', { name: 'Section name' })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onRenameSection).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox', { name: 'Section name' })).not.toBeInTheDocument()
    })
  })
})
