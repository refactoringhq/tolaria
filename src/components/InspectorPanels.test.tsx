import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DynamicRelationshipsPanel, BacklinksPanel, ReferencedByPanel, GitHistoryPanel, InstancesPanel } from './InspectorPanels'
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
  template: null, sort: null,
  outgoingLinks: [],
  ...overrides,
})

describe('DynamicRelationshipsPanel', () => {
  const onNavigate = vi.fn()
  const onAddProperty = vi.fn()
  const personTypeEntry = makeEntry({
    path: '/vault/person.md', filename: 'person.md', title: 'Person',
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

  it('renders + Add relationship button when onAddProperty provided', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{}}
        entries={entries}
        onNavigate={onNavigate}
        onAddProperty={onAddProperty}
      />
    )
    expect(screen.getByText('+ Add relationship')).toBeInTheDocument()
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
    fireEvent.click(screen.getByText('+ Add relationship'))
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
    fireEvent.click(screen.getByText('+ Add relationship'))
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
    fireEvent.click(screen.getByText('+ Add relationship'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByText('+ Add relationship')).toBeInTheDocument()
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

  it('shows emoji icon before label when entry has an emoji', () => {
    const emojiEntry = makeEntry({
      path: '/vault/note/rocket.md', filename: 'rocket.md', title: 'Rocket Note', isA: 'Note', icon: '🚀',
    })
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[Rocket Note]]'] }}
        entries={[emojiEntry]}
        onNavigate={onNavigate}
      />
    )
    expect(screen.getByText('🚀')).toBeInTheDocument()
    expect(screen.getByText('Rocket Note')).toBeInTheDocument()
  })

  it('does not show emoji when entry has no icon', () => {
    render(
      <DynamicRelationshipsPanel
        typeEntryMap={{}}
        frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
        entries={entries}
        onNavigate={onNavigate}
      />
    )
    const link = screen.getByText('My Project')
    const container = link.closest('.group\\/link')
    expect(container?.textContent).not.toMatch(/^[\p{Emoji_Presentation}]/u)
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

  describe('create & open from inline add', () => {
    const onUpdateProperty = vi.fn()
    const onDeleteProperty = vi.fn()
    const onCreateAndOpenNote = vi.fn<(title: string) => Promise<boolean>>()

    beforeEach(() => {
      vi.clearAllMocks()
      onCreateAndOpenNote.mockResolvedValue(true)
    })

    it('shows "Create & open" option when typed title does not match any note', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'Brand New Note' } })
      expect(screen.getByTestId('create-and-open-option')).toBeInTheDocument()
      expect(screen.getByText(/Create & open/)).toBeInTheDocument()
      expect(screen.getByText(/Brand New Note/)).toBeInTheDocument()
    })

    it('does not show "Create & open" when typed title matches an existing note', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'AI' } })
      expect(screen.queryByTestId('create-and-open-option')).not.toBeInTheDocument()
    })

    it('calls onCreateAndOpenNote and adds wikilink when "Create & open" clicked', async () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'Brand New Note' } })
      fireEvent.click(screen.getByTestId('create-and-open-option'))
      expect(onCreateAndOpenNote).toHaveBeenCalledWith('Brand New Note')
      await vi.waitFor(() => {
        expect(onUpdateProperty).toHaveBeenCalledWith('Belongs to', ['[[project/my-project]]', '[[Brand New Note]]'])
      })
    })

    it('does not add wikilink when note creation fails', async () => {
      onCreateAndOpenNote.mockResolvedValue(false)
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      fireEvent.change(input, { target: { value: 'Failing Note' } })
      fireEvent.click(screen.getByTestId('create-and-open-option'))
      expect(onCreateAndOpenNote).toHaveBeenCalledWith('Failing Note')
      // Give async handler time to resolve
      await vi.waitFor(() => {
        expect(onCreateAndOpenNote).toHaveBeenCalled()
      })
      // Wikilink is deferred to next tick and only added on success
      expect(onUpdateProperty).not.toHaveBeenCalled()
    })

    it('shows both existing matches and "Create & open" for partial matches', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{ 'Belongs to': ['[[project/my-project]]'] }}
          entries={entries}
          onNavigate={onNavigate}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByTestId('add-relation-ref'))
      const input = screen.getByTestId('add-relation-ref-input')
      // "My" partially matches "My Project" but is not an exact match
      fireEvent.change(input, { target: { value: 'My' } })
      // Should show search results AND create option
      expect(screen.getByTestId('create-and-open-option')).toBeInTheDocument()
    })

    it('does not show "Create & open" when onCreateAndOpenNote is not provided', () => {
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
      fireEvent.change(input, { target: { value: 'Brand New Note' } })
      expect(screen.queryByTestId('create-and-open-option')).not.toBeInTheDocument()
    })
  })

  describe('create & open from AddRelationshipForm', () => {
    const onCreateAndOpenNote = vi.fn<(title: string) => Promise<boolean>>()

    beforeEach(() => {
      vi.clearAllMocks()
      onCreateAndOpenNote.mockResolvedValue(true)
    })

    it('shows "Create & open" option in target input when title does not exist', () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{}}
          entries={entries}
          onNavigate={onNavigate}
          onAddProperty={onAddProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByText('+ Add relationship'))
      fireEvent.change(screen.getByPlaceholderText('Relationship name'), { target: { value: 'Mentions' } })
      const noteInput = screen.getByPlaceholderText('Note title')
      fireEvent.focus(noteInput)
      fireEvent.change(noteInput, { target: { value: 'New Person' } })
      expect(screen.getByTestId('create-and-open-option')).toBeInTheDocument()
    })

    it('creates note and adds relationship via form', async () => {
      render(
        <DynamicRelationshipsPanel
          typeEntryMap={{}}
          frontmatter={{}}
          entries={entries}
          onNavigate={onNavigate}
          onAddProperty={onAddProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )
      fireEvent.click(screen.getByText('+ Add relationship'))
      fireEvent.change(screen.getByPlaceholderText('Relationship name'), { target: { value: 'Mentions' } })
      const noteInput = screen.getByPlaceholderText('Note title')
      fireEvent.focus(noteInput)
      fireEvent.change(noteInput, { target: { value: 'New Person' } })
      fireEvent.click(screen.getByTestId('create-and-open-option'))
      expect(onCreateAndOpenNote).toHaveBeenCalledWith('New Person')
      await vi.waitFor(() => {
        expect(onAddProperty).toHaveBeenCalledWith('Mentions', '[[New Person]]')
      })
    })
  })
})

describe('BacklinksPanel', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<BacklinksPanel backlinks={[]} onNavigate={onNavigate} />)
    expect(container.innerHTML).toBe('')
  })

  const twoBacklinks = [
    { entry: makeEntry({ title: 'Referencing Note', isA: 'Note' }), context: null },
    { entry: makeEntry({ title: 'Another Note', isA: 'Project', path: '/vault/project/another.md' }), context: null },
  ]

  it('renders header and all backlinks immediately (no collapse)', () => {
    render(<BacklinksPanel backlinks={twoBacklinks} onNavigate={onNavigate} />)
    expect(screen.getByText('Backlinks')).toBeInTheDocument()
    expect(screen.getByText('Referencing Note')).toBeInTheDocument()
    expect(screen.getByText('Another Note')).toBeInTheDocument()
  })

  it('navigates when clicking backlink', () => {
    const backlinks = [{ entry: makeEntry({ title: 'Reference' }), context: null }]
    render(<BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Reference'))
    expect(onNavigate).toHaveBeenCalledWith('Reference')
  })

  it('shows paragraph context preview when available', () => {
    const backlinks = [
      { entry: makeEntry({ title: 'Referencing Note' }), context: 'This references [[My Note]] in context.' },
    ]
    render(<BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />)
    expect(screen.getByText('This references [[My Note]] in context.')).toBeInTheDocument()
  })

  it('shows emoji icon before backlink title when entry has an emoji', () => {
    const backlinks = [{
      entry: makeEntry({ title: 'Starred Note', icon: '⭐' }),
      context: null,
    }]
    render(<BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />)
    expect(screen.getByText('⭐')).toBeInTheDocument()
    expect(screen.getByText('Starred Note')).toBeInTheDocument()
  })

  it('does not show emoji when backlink entry has no icon', () => {
    const backlinks = [{ entry: makeEntry({ title: 'Plain Note' }), context: null }]
    render(<BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />)
    expect(screen.getByText('Plain Note')).toBeInTheDocument()
    const btn = screen.getByText('Plain Note').closest('button')
    const spans = btn?.querySelectorAll('span.shrink-0')
    const emojiSpans = Array.from(spans ?? []).filter(s => /[\p{Emoji_Presentation}]/u.test(s.textContent ?? ''))
    expect(emojiSpans).toHaveLength(0)
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

  it('renders nothing when empty', () => {
    const { container } = render(<GitHistoryPanel commits={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders commit entries with hash and message', () => {
    const commits: GitCommit[] = [
      { hash: 'abc1234567890', shortHash: 'abc1234', message: 'Initial commit', author: 'luca', date: Math.floor(Date.now() / 1000) - 3600 },
      { hash: 'def4567890123', shortHash: 'def4567', message: 'Fix bug', author: 'jane', date: Math.floor(Date.now() / 1000) - 86400 * 2 },
    ]
    render(<GitHistoryPanel commits={commits} onViewCommitDiff={onViewCommitDiff} />)
    expect(screen.getByText('abc1234')).toBeInTheDocument()
    expect(screen.getByText('def4567')).toBeInTheDocument()
  })

  it('calls onViewCommitDiff when clicking commit entry', () => {
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

describe('InstancesPanel', () => {
  const onNavigate = vi.fn()
  const quarterType = makeEntry({
    path: '/vault/quarter.md', filename: 'quarter.md', title: 'Quarter',
    isA: 'Type', color: 'blue', icon: 'calendar',
  })
  const typeEntryMap: Record<string, VaultEntry> = { Quarter: quarterType }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when entry is not a Type', () => {
    const entry = makeEntry({ title: 'Random Note', isA: 'Note' })
    const { container } = render(
      <InstancesPanel entry={entry} entries={[]} typeEntryMap={{}} onNavigate={onNavigate} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when Type has zero instances', () => {
    const { container } = render(
      <InstancesPanel entry={quarterType} entries={[]} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders instances of a Type sorted by modifiedAt descending', () => {
    const instances = [
      makeEntry({ path: '/vault/quarter/q1.md', title: 'Q1 2026', isA: 'Quarter', modifiedAt: 1000 }),
      makeEntry({ path: '/vault/quarter/q2.md', title: 'Q2 2026', isA: 'Quarter', modifiedAt: 3000 }),
      makeEntry({ path: '/vault/quarter/q3.md', title: 'Q3 2026', isA: 'Quarter', modifiedAt: 2000 }),
    ]
    render(
      <InstancesPanel entry={quarterType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(screen.getByText('Instances (3)')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button').filter(b => ['Q1 2026', 'Q2 2026', 'Q3 2026'].includes(b.textContent?.replace(/\s*\(.*\)/, '') ?? ''))
    // Q2 (3000) should come before Q3 (2000) before Q1 (1000)
    expect(buttons[0].textContent).toContain('Q2 2026')
    expect(buttons[1].textContent).toContain('Q3 2026')
    expect(buttons[2].textContent).toContain('Q1 2026')
  })

  it('excludes trashed instances', () => {
    const instances = [
      makeEntry({ path: '/vault/quarter/q1.md', title: 'Q1 2026', isA: 'Quarter', modifiedAt: 2000 }),
      makeEntry({ path: '/vault/quarter/q2.md', title: 'Q2 Trashed', isA: 'Quarter', trashed: true, modifiedAt: 3000 }),
    ]
    render(
      <InstancesPanel entry={quarterType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(screen.getByText('Q1 2026')).toBeInTheDocument()
    expect(screen.queryByText('Q2 Trashed')).not.toBeInTheDocument()
  })

  it('dims archived instances', () => {
    const instances = [
      makeEntry({ path: '/vault/quarter/old.md', title: 'Q4 2024', isA: 'Quarter', archived: true, modifiedAt: 1000 }),
    ]
    render(
      <InstancesPanel entry={quarterType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(screen.getByTitle('Archived')).toBeInTheDocument()
  })

  it('navigates when clicking an instance', () => {
    const instances = [
      makeEntry({ path: '/vault/quarter/q1.md', title: 'Q1 2026', isA: 'Quarter', modifiedAt: 1000 }),
    ]
    render(
      <InstancesPanel entry={quarterType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    fireEvent.click(screen.getByText('Q1 2026'))
    expect(onNavigate).toHaveBeenCalledWith('Q1 2026')
  })

  it('caps display at 50 instances and shows count badge', () => {
    const instances = Array.from({ length: 80 }, (_, i) =>
      makeEntry({
        path: `/vault/quarter/q${i}.md`,
        title: `Instance ${i}`,
        isA: 'Quarter',
        modifiedAt: 80 - i,
      })
    )
    render(
      <InstancesPanel entry={quarterType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(screen.getByText('Instances (80)')).toBeInTheDocument()
    // Only 50 link buttons rendered
    const allButtons = screen.getAllByRole('button')
    const instanceButtons = allButtons.filter(b => b.textContent?.startsWith('Instance'))
    expect(instanceButtons.length).toBe(50)
    expect(screen.getByText('showing 50 of 80')).toBeInTheDocument()
  })

  it('does not show Instances section for non-Type note even if title matches a type name', () => {
    const notAType = makeEntry({ title: 'Quarter', isA: 'Project' })
    const instances = [
      makeEntry({ path: '/vault/quarter/q1.md', title: 'Q1 2026', isA: 'Quarter', modifiedAt: 1000 }),
    ]
    const { container } = render(
      <InstancesPanel entry={notAType} entries={instances} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
    )
    expect(container.innerHTML).toBe('')
  })
})
