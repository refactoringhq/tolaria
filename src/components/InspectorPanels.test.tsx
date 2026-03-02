import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DynamicRelationshipsPanel, BacklinksPanel, ReferencedByPanel, GitHistoryPanel } from './InspectorPanels'
import type { ReferencedByItem } from './InspectorPanels'
import type { VaultEntry, GitCommit } from '../types'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  ...overrides,
})

describe('DynamicRelationshipsPanel', () => {
  const onNavigate = vi.fn()
  const onAddProperty = vi.fn()
  const personTypeEntry = makeEntry({
    path: '/vault/type/person.md', filename: 'person.md', title: 'Person',
    isA: 'Type', color: 'yellow', icon: 'user',
  })
  const entries = [
    makeEntry({ path: '/vault/project/my-project.md', filename: 'my-project.md', title: 'My Project', isA: 'Project' }),
    makeEntry({ path: '/vault/topic/ai.md', filename: 'ai.md', title: 'AI', isA: 'Topic' }),
    personTypeEntry,
  ]
  const typeEntryMap: Record<string, VaultEntry> = { Person: personTypeEntry }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      name: 'applies type color via typeEntryMap',
      entry: { path: '/vault/people/luca.md', filename: 'luca.md', title: 'Luca', isA: 'Person' as const },
      ref: '[[Luca]]', key: 'Owner', tMap: typeEntryMap, expectedColor: 'var(--accent-yellow)',
    },
    {
      name: 'resolves by title when filename differs',
      entry: { path: '/vault/people/john-doe.md', filename: 'john-doe.md', title: 'John Doe', isA: 'Person' as const },
      ref: '[[John Doe]]', key: 'Owner', tMap: typeEntryMap, expectedColor: 'var(--accent-yellow)',
    },
    {
      name: 'shows neutral color for notes with no type',
      entry: { path: '/vault/misc/random.md', filename: 'random.md', title: 'Random', isA: null },
      ref: '[[Random]]', key: 'Related to', tMap: {} as Record<string, VaultEntry>, expectedColor: 'var(--muted-foreground)',
    },
  ])('$name', ({ entry: overrides, ref, key, tMap, expectedColor }) => {
    const { container } = render(
      <DynamicRelationshipsPanel
        typeEntryMap={tMap}
        frontmatter={{ [key]: [ref] }}
        entries={[...entries, makeEntry(overrides)]}
        onNavigate={onNavigate}
      />
    )
    const chip = container.querySelector('.group\\/link')
    expect(chip).toBeTruthy()
    expect(chip!.style.color).toBe(expectedColor)
  })

  it('hides empty state label when frontmatter has no relations', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ Status: 'Active', title: 'Test' }}
        entries={entries}
        onNavigate={onNavigate}
      />
    )
    expect(screen.queryByText('No relationships')).not.toBeInTheDocument()
  })

  it('renders relationship groups with wikilinks', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{
          'Belongs to': ['[[project/my-project]]'],
          'Related to': ['[[topic/ai]]'],
        }}
        entries={entries}
        onNavigate={onNavigate}
      />
    )
    expect(screen.getByText('Belongs to')).toBeInTheDocument()
    expect(screen.getByText('Related to')).toBeInTheDocument()
  })

  it('navigates when clicking a relationship link', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
        entries={entries}
        onNavigate={onNavigate}
      />
    )
    // Click the rendered link
    const link = screen.getByText('My Project')
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledWith('project/my-project')
  })

  it('renders single string wikilink value', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ Owner: '[[person/luca]]' }}
        entries={[makeEntry({ path: '/vault/person/luca.md', filename: 'luca.md', title: 'Luca', isA: 'Person' })]  }
        onNavigate={onNavigate}
      />
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Luca')).toBeInTheDocument()
  })

  it('renders + Link existing button when onAddProperty provided', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{}}
        entries={entries}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />
    )
    expect(screen.getByText('+ Link existing')).toBeInTheDocument()
  })

  it('opens add relationship form when button clicked', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{}}
        entries={entries}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Link existing'))
    expect(screen.getByPlaceholderText('Relationship name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Note title')).toBeInTheDocument()
  })

  it('adds relationship via form', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{}}
        entries={entries}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Link existing'))
    fireEvent.change(screen.getByPlaceholderText('Relationship name'), { target: { value: 'Related to' } })
    fireEvent.change(screen.getByPlaceholderText('Note title'), { target: { value: 'AI' } })
    fireEvent.click(screen.getByText('Add'))
    expect(onAddProperty).toHaveBeenCalledWith('Related to', '[[AI]]')
  })

  it('cancels add relationship form', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{}}
        entries={entries}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Link existing'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByText('+ Link existing')).toBeInTheDocument()
  })

  it('dims archived entries', () => {
    const archivedEntry = makeEntry({
      path: '/vault/project/old.md', filename: 'old.md', title: 'Old Project', isA: 'Project', archived: true,
    })
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[project/old]]'] }}
        entries={[archivedEntry]}
        onNavigate={onNavigate}
      />
    )
    // The button title should indicate "Archived" status
    expect(screen.getByTitle('Archived')).toBeInTheDocument()
  })

  it('shows trashed indicator for trashed entries', () => {
    const trashedEntry = makeEntry({
      path: '/vault/project/trash.md', filename: 'trash.md', title: 'Trash Project', isA: 'Project', trashed: true,
    })
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[project/trash]]'] }}
        entries={[trashedEntry]}
        onNavigate={onNavigate}
      />
    )
    expect(screen.getByTitle('Trashed')).toBeInTheDocument()
  })

  it('handles aliased wikilinks [[path|Display]]', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[project/my-project|My Cool Project]]'] }}
        entries={entries}
        onNavigate={onNavigate}
      />
    )
    expect(screen.getByText('My Cool Project')).toBeInTheDocument()
  })

  describe('relation editing', () => {
    const onUpdateProperty = vi.fn()
    const onDeleteProperty = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows remove buttons on relation refs when editing is enabled', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      expect(screen.getByTestId('remove-relation-ref')).toBeInTheDocument()
    })

    it('does not show remove buttons when editing is disabled', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
        />
      )
      expect(screen.queryByTestId('remove-relation-ref')).not.toBeInTheDocument()
    })

    it('calls onDeleteProperty when removing the last ref in a group', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      fireEvent.click(screen.getByTestId('remove-relation-ref'))
      expect(onDeleteProperty).toHaveBeenCalledWith('Belongs to')
    })

    it('calls onUpdateProperty with remaining refs when removing one of many', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Related to': ['[[project/my-project]]', '[[topic/ai]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      const removeButtons = screen.getAllByTestId('remove-relation-ref')
      fireEvent.click(removeButtons[0]) // Remove first ref
      expect(onUpdateProperty).toHaveBeenCalledWith('Related to', '[[topic/ai]]')
    })

    it('calls onUpdateProperty with string when two refs become one', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Has': ['[[project/my-project]]', '[[topic/ai]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      const removeButtons = screen.getAllByTestId('remove-relation-ref')
      fireEvent.click(removeButtons[0])
      // Should pass a single string, not an array of one
      expect(onUpdateProperty).toHaveBeenCalledWith('Has', '[[topic/ai]]')
    })

    it('shows inline add button for each relationship group when editing is enabled', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      expect(screen.getByTestId('add-relation-ref')).toBeInTheDocument()
    })

    it('opens inline add input when add button clicked', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      expect(screen.getByTestId('add-relation-ref-input')).toBeInTheDocument()
    })

    it('adds a note to an existing relationship via inline add', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'AI' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdateProperty).toHaveBeenCalledWith('Belongs to', ['[[project/my-project]]', '[[AI]]'])
    })

    it('does not add duplicate refs', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[AI]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'AI' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdateProperty).not.toHaveBeenCalled()
    })

    it('closes inline add on Escape', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.queryByTestId('add-relation-ref-input')).not.toBeInTheDocument()
      expect(screen.getByTestId('add-relation-ref')).toBeInTheDocument()
    })
  })
})

describe('BacklinksPanel', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<BacklinksPanel typeEntryMap={{}} backlinks={[]} onNavigate={onNavigate} />)
    expect(container.innerHTML).toBe('')
  })

  const twoBacklinks = [
    { entry: makeEntry({ title: 'Referencing Note', isA: 'Note' }), context: null },
    { entry: makeEntry({ title: 'Another Note', isA: 'Project', path: '/vault/project/another.md' }), context: null },
  ]

  it('renders collapsed by default with count badge', () => {
    render(<BacklinksPanel typeEntryMap={{}} backlinks={twoBacklinks} onNavigate={onNavigate} />)
    expect(screen.getByText('Backlinks (2)')).toBeInTheDocument()
    expect(screen.queryByText('Referencing Note')).not.toBeInTheDocument()
  })

  it('expands to show backlink entries when toggle clicked', () => {
    render(<BacklinksPanel typeEntryMap={{}} backlinks={twoBacklinks} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('backlinks-toggle'))
    expect(screen.getByText('Referencing Note')).toBeInTheDocument()
    expect(screen.getByText('Another Note')).toBeInTheDocument()
  })

  it('navigates when clicking backlink', () => {
    const backlinks = [{ entry: makeEntry({ title: 'Reference' }), context: null }]
    render(<BacklinksPanel typeEntryMap={{}} backlinks={backlinks} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('backlinks-toggle'))
    fireEvent.click(screen.getByText('Reference'))
    expect(onNavigate).toHaveBeenCalledWith('Reference')
  })

  it('shows paragraph context preview when available', () => {
    const backlinks = [
      { entry: makeEntry({ title: 'Referencing Note' }), context: 'This references [[My Note]] in context.' },
    ]
    render(<BacklinksPanel typeEntryMap={{}} backlinks={backlinks} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('backlinks-toggle'))
    expect(screen.getByText('This references [[My Note]] in context.')).toBeInTheDocument()
  })

  it('collapses when toggle clicked twice', () => {
    const backlinks = [{ entry: makeEntry({ title: 'Note A' }), context: null }]
    render(<BacklinksPanel typeEntryMap={{}} backlinks={backlinks} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('backlinks-toggle'))
    expect(screen.getByText('Note A')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('backlinks-toggle'))
    expect(screen.queryByText('Note A')).not.toBeInTheDocument()
  })
})

describe('ReferencedByPanel', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<ReferencedByPanel typeEntryMap={{}} items={[]} onNavigate={onNavigate} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders referenced-by entries grouped by relationship key', () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/proc/a.md', title: 'Write Essays', isA: 'Procedure' }), viaKey: 'Belongs to' },
      { entry: makeEntry({ path: '/vault/essay/b.md', title: 'On Writing Well', isA: 'Essay' }), viaKey: 'Belongs to' },
      { entry: makeEntry({ path: '/vault/exp/c.md', title: 'SEO Experiment', isA: 'Experiment' }), viaKey: 'Related to' },
    ]
    render(<ReferencedByPanel typeEntryMap={{}} items={items} onNavigate={onNavigate} />)

    expect(screen.getByText('Write Essays')).toBeInTheDocument()
    expect(screen.getByText('On Writing Well')).toBeInTheDocument()
    expect(screen.getByText('SEO Experiment')).toBeInTheDocument()
    expect(screen.getByText(/← Belongs to/i)).toBeInTheDocument()
    expect(screen.getByText(/← Related to/i)).toBeInTheDocument()
  })

  it('navigates when clicking a referenced-by entry', () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/a.md', title: 'My Note' }), viaKey: 'Belongs to' },
    ]
    render(<ReferencedByPanel typeEntryMap={{}} items={items} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('My Note'))
    expect(onNavigate).toHaveBeenCalledWith('My Note')
  })

  it('dims archived entries in referenced-by', () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/a.md', title: 'Old Note', archived: true }), viaKey: 'Has' },
    ]
    render(<ReferencedByPanel typeEntryMap={{}} items={items} onNavigate={onNavigate} />)
    expect(screen.getByTitle('Archived')).toBeInTheDocument()
  })

  it('shows trashed indicator for trashed entries', () => {
    const items: ReferencedByItem[] = [
      { entry: makeEntry({ path: '/vault/a.md', title: 'Trash Note', trashed: true }), viaKey: 'Has' },
    ]
    render(<ReferencedByPanel typeEntryMap={{}} items={items} onNavigate={onNavigate} />)
    expect(screen.getByTitle('Trashed')).toBeInTheDocument()
  })
})

describe('GitHistoryPanel', () => {
  const onViewCommitDiff = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No revision history" when empty', () => {
    render(<GitHistoryPanel commits={[]} />)
    expect(screen.getByText('No revision history')).toBeInTheDocument()
  })

  it('renders commit entries', () => {
    const commits: GitCommit[] = [
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'Initial commit', author: 'luca', date: Math.floor(Date.now() / 1000) - 3600 },
      { hash: 'def4567890123', shortHash: 'def4567', message: 'Fix bug', author: 'jane', date: Math.floor(Date.now() / 1000) - 86400 * 2 },
    ]
    render(<GitHistoryPanel commits={commits} onViewCommitDiff={onViewCommitDiff} />)
    expect(screen.getByText('abc1234')).toBeInTheDocument()
    expect(screen.getByText('def4567')).toBeInTheDocument()
    expect(screen.getByText('Initial commit')).toBeInTheDocument()
    expect(screen.getByText('Fix bug')).toBeInTheDocument()
    expect(screen.getByText('luca')).toBeInTheDocument()
    expect(screen.getByText('jane')).toBeInTheDocument()
  })

  it('calls onViewCommitDiff when clicking commit hash', () => {
    const commits: GitCommit[] = [
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'test', author: '', date: Math.floor(Date.now() / 1000) },
    ]
    render(<GitHistoryPanel commits={commits} onViewCommitDiff={onViewCommitDiff} />)
    fireEvent.click(screen.getByText('abc1234'))
    expect(onViewCommitDiff).toHaveBeenCalledWith('abc1234567890')
  })

  it('displays relative dates correctly', () => {
    const now = Math.floor(Date.now() / 1000)
    const commits: GitCommit[] = [
      { hash: 'a', shortHash: 'a1', message: 'm1', author: '', date: now }, // today
      { hash: 'b', shortHash: 'b1', message: 'm2', author: '', date: now - 86400 }, // yesterday
      { hash: 'c', shortHash: 'c1', message: 'm3', author: '', date: now - 86400 * 10 }, // 10d ago
      { hash: 'd', shortHash: 'd1', message: 'm4', author: '', date: now - 86400 * 45 }, // ~1.5mo ago
    ]
    render(<GitHistoryPanel commits={commits} />)
    expect(screen.getByText('today')).toBeInTheDocument()
    expect(screen.getByText('yesterday')).toBeInTheDocument()
    expect(screen.getByText('10d ago')).toBeInTheDocument()
  })
})
