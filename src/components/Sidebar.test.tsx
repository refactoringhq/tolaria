import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import type { VaultEntry, SidebarSelection } from '../types'

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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  },
]

const defaultSelection: SidebarSelection = { kind: 'filter', filter: 'all' }

describe('Sidebar', () => {
  it('renders top nav items (All Notes)', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.queryByText('Favorites')).not.toBeInTheDocument()
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

  it('calls onSelect with entity kind when clicking a topic', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Expand Topics'))
    fireEvent.click(screen.getByText('Software Development'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'entity',
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

  it('does not render Changes or Pulse in sidebar', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} />)
    expect(screen.queryByText('Changes')).not.toBeInTheDocument()
    expect(screen.queryByText('Pulse')).not.toBeInTheDocument()
    expect(screen.queryByText('Commit & Push')).not.toBeInTheDocument()
  })

  describe('dynamic custom type sections', () => {
    const entriesWithCustomTypes: VaultEntry[] = [
      ...mockEntries,
      {
        path: '/vault/recipe.md',
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
      },
      {
        path: '/vault/book.md',
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
        template: null, sort: null,
        outgoingLinks: [],
        properties: {},
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
        template: null, sort: null,
        outgoingLinks: [],
        properties: {},
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
          properties: {},
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
        path: '/vault/project.md',
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
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
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
          path: '/vault/news.md', filename: 'news.md', title: 'News', isA: 'Type',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 200, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: 'News', outgoingLinks: [],
          properties: {},
        },
        {
          path: '/vault/news/breaking.md', filename: 'breaking.md', title: 'Breaking Story', isA: 'News',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 300, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: null, outgoingLinks: [],
          properties: {},
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
          path: '/vault/person.md', filename: 'person.md', title: 'Person', isA: 'Type',
          aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
          archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
          fileSize: 200, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: 'Contacts', outgoingLinks: [],
          properties: {},
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

  describe('type visibility via visible property', () => {
    const makeTypeEntry = (title: string, visible: boolean | null): VaultEntry => ({
      path: `/vault/${title.toLowerCase()}.md`,
      filename: `${title.toLowerCase()}.md`,
      title,
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
      sort: null,
      view: null,
      visible,
      outgoingLinks: [],
      properties: {},
    })

    it('hides a section when its Type entry has visible: false', () => {
      const entries: VaultEntry[] = [
        ...mockEntries,
        makeTypeEntry('Person', false),
      ]
      render(<Sidebar entries={entries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.queryByText('People')).not.toBeInTheDocument()
      // Other sections should still be visible
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('shows a section when its Type entry has visible: true', () => {
      const entries: VaultEntry[] = [
        ...mockEntries,
        makeTypeEntry('Person', true),
      ]
      render(<Sidebar entries={entries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('People')).toBeInTheDocument()
    })

    it('shows a section when its Type entry has visible: null (default)', () => {
      const entries: VaultEntry[] = [
        ...mockEntries,
        makeTypeEntry('Person', null),
      ]
      render(<Sidebar entries={entries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('People')).toBeInTheDocument()
    })

    it('shows a section when there is no Type entry at all (default visible)', () => {
      // mockEntries has Person instances but no Type entry for Person
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('People')).toBeInTheDocument()
    })

    it('hides multiple sections when their Type entries have visible: false', () => {
      const entries: VaultEntry[] = [
        ...mockEntries,
        makeTypeEntry('Person', false),
        makeTypeEntry('Event', false),
      ]
      render(<Sidebar entries={entries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.queryByText('People')).not.toBeInTheDocument()
      expect(screen.queryByText('Events')).not.toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Topics')).toBeInTheDocument()
    })

    it('does not affect All Notes or other sidebar filters when sections are hidden', () => {
      const entries: VaultEntry[] = [
        ...mockEntries,
        makeTypeEntry('Project', false),
        makeTypeEntry('Person', false),
      ]
      render(<Sidebar entries={entries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('All Notes')).toBeInTheDocument()
      expect(screen.queryByText('Favorites')).not.toBeInTheDocument()
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

    it('calls onToggleTypeVisibility when toggling a section in the popover', () => {
      const onToggleTypeVisibility = vi.fn()
      render(<Sidebar entries={mockEntries} selection={defaultSelection} onSelect={() => {}} onToggleTypeVisibility={onToggleTypeVisibility} />)
      fireEvent.click(screen.getByTitle('Customize sections'))
      fireEvent.click(screen.getByLabelText('Toggle People'))
      expect(onToggleTypeVisibility).toHaveBeenCalledWith('Person')
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
        path: '/vault/project.md', filename: 'project.md', title: 'Project', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 5, sidebarLabel: null, outgoingLinks: [],
        properties: {},
      },
      {
        path: '/vault/topic.md', filename: 'topic.md', title: 'Topic', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 0, sidebarLabel: null, outgoingLinks: [],
        properties: {},
      },
      {
        path: '/vault/person.md', filename: 'person.md', title: 'Person', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null, fileSize: 200, snippet: '',
        wordCount: 0,
        relationships: {}, icon: null, color: null, order: 1, sidebarLabel: null, outgoingLinks: [],
        properties: {},
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

  describe('Note type in sidebar', () => {
    const noteEntries: VaultEntry[] = [
      ...mockEntries,
      {
        path: '/vault/note.md', filename: 'note.md', title: 'Note', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
        fileSize: 200, snippet: '', wordCount: 0, relationships: {},
        icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
        outgoingLinks: [], properties: {},
      },
      {
        path: '/vault/explicit-note.md', filename: 'explicit-note.md', title: 'Explicit Note',
        isA: 'Note', aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
        cadence: null, archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000,
        createdAt: null, fileSize: 300, snippet: '', wordCount: 0, relationships: {},
        icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
        outgoingLinks: [], properties: {},
      },
      {
        path: '/vault/untyped-note.md', filename: 'untyped-note.md', title: 'Untyped Note',
        isA: null, aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
        cadence: null, archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000,
        createdAt: null, fileSize: 150, snippet: '', wordCount: 0, relationships: {},
        icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
        outgoingLinks: [], properties: {},
      },
    ]

    it('shows Notes section when Note entries exist', () => {
      render(<Sidebar entries={noteEntries} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })

    it('includes both explicit and untyped notes under Notes section', () => {
      render(<Sidebar entries={noteEntries} selection={defaultSelection} onSelect={() => {}} />)
      fireEvent.click(screen.getByLabelText('Expand Notes'))
      expect(screen.getByText('Explicit Note')).toBeInTheDocument()
      expect(screen.getByText('Untyped Note')).toBeInTheDocument()
    })

    it('shows Notes section for untyped entries even without explicit Note entries', () => {
      const untypedOnly: VaultEntry[] = [
        {
          path: '/vault/plain.md', filename: 'plain.md', title: 'Plain Note',
          isA: null, aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
          cadence: null, archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000,
          createdAt: null, fileSize: 100, snippet: '', wordCount: 0, relationships: {},
          icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
          outgoingLinks: [], properties: {},
        },
      ]
      render(<Sidebar entries={untypedOnly} selection={defaultSelection} onSelect={() => {}} />)
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })
  })

  it('renders exactly one section for a hyphenated custom type like Monday Ideas', () => {
    const entriesWithMondayIdeas: VaultEntry[] = [
      ...mockEntries,
      {
        path: '/vault/monday-ideas/standup-bingo.md',
        filename: 'standup-bingo.md',
        title: 'Standup Bingo',
        isA: 'Monday Ideas',
        aliases: [], belongsTo: [], relatedTo: [],
        status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null,
        modifiedAt: 1700000000, createdAt: null,
        fileSize: 310, snippet: '', wordCount: 120,
        relationships: {}, icon: null, color: null, order: null,
        sidebarLabel: null, template: null, sort: null, view: null,
        outgoingLinks: [], properties: {},
      },
      {
        path: '/vault/monday-ideas/theme-days.md',
        filename: 'theme-days.md',
        title: 'Theme Days',
        isA: 'Monday Ideas',
        aliases: [], belongsTo: [], relatedTo: [],
        status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null,
        modifiedAt: 1700000000, createdAt: null,
        fileSize: 280, snippet: '', wordCount: 95,
        relationships: {}, icon: null, color: null, order: null,
        sidebarLabel: null, template: null, sort: null, view: null,
        outgoingLinks: [], properties: {},
      },
    ]
    render(<Sidebar entries={entriesWithMondayIdeas} selection={defaultSelection} onSelect={() => {}} />)
    // "Monday Ideas" pluralized → "Monday Ideases" (the pluralizeType function)
    const mondaySections = screen.getAllByText(/Monday Ideas/i)
    expect(mondaySections).toHaveLength(1)
  })

  it('renders Inbox as the first item in the top nav', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} inboxCount={5} />)
    const topNav = screen.getByTestId('sidebar-top-nav')
    const items = topNav.children
    expect(items[0].textContent).toContain('Inbox')
    expect(items[1].textContent).toContain('All Notes')
  })

  it('displays inbox count badge', () => {
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={() => {}} inboxCount={12} />)
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('calls onSelect with inbox filter when clicking Inbox', () => {
    const onSelect = vi.fn()
    render(<Sidebar entries={[]} selection={defaultSelection} onSelect={onSelect} inboxCount={3} />)
    fireEvent.click(screen.getByText('Inbox'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'filter', filter: 'inbox' })
  })

  describe('emoji icon in sidebar section children', () => {
    const entriesWithEmoji: VaultEntry[] = [
      {
        path: '/vault/project.md', filename: 'project.md', title: 'Project', isA: 'Type',
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null, cadence: null,
        archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000, createdAt: null,
        fileSize: 200, snippet: '', wordCount: 0, relationships: {},
        icon: 'rocket-launch', color: 'purple', order: null, sidebarLabel: null, template: null,
        sort: null, view: null, visible: null, outgoingLinks: [], properties: {},
      },
      {
        path: '/vault/project/build-app.md', filename: 'build-app.md', title: 'Build App',
        isA: 'Project', aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
        cadence: null, archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000,
        createdAt: null, fileSize: 300, snippet: '', wordCount: 0, relationships: {},
        icon: '🚀', color: null, order: null, sidebarLabel: null, template: null,
        sort: null, view: null, visible: null, outgoingLinks: [], properties: {},
      },
      {
        path: '/vault/project/no-icon.md', filename: 'no-icon.md', title: 'No Icon Project',
        isA: 'Project', aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
        cadence: null, archived: false, trashed: false, trashedAt: null, modifiedAt: 1700000000,
        createdAt: null, fileSize: 150, snippet: '', wordCount: 0, relationships: {},
        icon: null, color: null, order: null, sidebarLabel: null, template: null,
        sort: null, view: null, visible: null, outgoingLinks: [], properties: {},
      },
    ]

    it('shows emoji icon before title in expanded section child', () => {
      render(<Sidebar entries={entriesWithEmoji} selection={defaultSelection} onSelect={() => {}} />)
      fireEvent.click(screen.getByLabelText('Expand Projects'))
      const buildApp = screen.getByText('Build App')
      const parent = buildApp.closest('div')!
      expect(parent.textContent).toBe('🚀Build App')
    })

    it('does not show emoji for notes without icon', () => {
      render(<Sidebar entries={entriesWithEmoji} selection={defaultSelection} onSelect={() => {}} />)
      fireEvent.click(screen.getByLabelText('Expand Projects'))
      const noIcon = screen.getByText('No Icon Project')
      const parent = noIcon.closest('div')!
      expect(parent.textContent).toBe('No Icon Project')
    })
  })
})
