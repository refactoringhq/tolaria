import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Hoisted mock editor — available before vi.mock factory runs.
// Tests can reconfigure spies (e.g. mockTryParse.mockResolvedValue) before rendering.
const mockEditor = vi.hoisted(() => ({
  tryParseMarkdownToBlocks: vi.fn(async () => [] as unknown[]),
  replaceBlocks: vi.fn(),
  insertBlocks: vi.fn(),
  document: [{ id: '1', type: 'paragraph', content: [], props: {}, children: [] }],
  insertInlineContent: vi.fn(),
  onMount: vi.fn((cb: () => void) => { cb(); return () => {} }),
  prosemirrorView: {} as Record<string, unknown>,
  blocksToHTMLLossy: vi.fn(() => ''),
  _tiptapEditor: { commands: { setContent: vi.fn() } },
}))

// Mock BlockNote components
vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: () => ({}) },
  defaultInlineContentSpecs: {},
  filterSuggestionItems: vi.fn(() => []),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockFilterSuggestionItems = vi.fn((...args: any[]) => args[0] ?? [])
vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: (...args: unknown[]) => mockFilterSuggestionItems(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const capturedGetItemsByTrigger: Record<string, (query: string) => Promise<any[]>> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
let capturedGetItems: ((query: string) => Promise<any[]>) | null = null
vi.mock('@blocknote/react', () => ({
  createReactInlineContentSpec: () => ({ render: () => null }),
  useCreateBlockNote: () => mockEditor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
  SuggestionMenuController: (props: any) => {
    capturedGetItemsByTrigger[props.triggerCharacter] = props.getItems
    if (props.triggerCharacter === '[[') capturedGetItems = props.getItems
    return null
  },
}))

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ children }: { children?: React.ReactNode }) => <div data-testid="blocknote-view">{children}</div>,
}))

vi.mock('@blocknote/mantine/style.css', () => ({}))

import { Editor } from './Editor'
import type { VaultEntry } from '../types'

const mockEntry: VaultEntry = {
  path: '/vault/project/test.md',
  filename: 'test.md',
  title: 'Test Project',
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
  relationships: {},
  icon: null,
  color: null,
    order: null,
  outgoingLinks: [],
}

const mockContent = `---
title: Test Project
is_a: Project
Status: Active
---

# Test Project

This is a test note with some words to count.
`

const mockTab = { entry: mockEntry, content: mockContent }

const defaultProps = {
  tabs: [] as { entry: VaultEntry; content: string }[],
  activeTabPath: null as string | null,
  entries: [mockEntry],
  onSwitchTab: vi.fn(),
  onCloseTab: vi.fn(),
  onNavigateWikilink: vi.fn(),
  inspectorCollapsed: true,
  onToggleInspector: vi.fn(),
  inspectorWidth: 280,
  onInspectorResize: vi.fn(),
  inspectorEntry: null as VaultEntry | null,
  inspectorContent: null as string | null,
  allContent: {} as Record<string, string>,
  gitHistory: [],
  onCreateNote: vi.fn(),
}

describe('Editor', () => {
  it('shows empty state when no tabs are open', () => {
    render(<Editor {...defaultProps} />)
    expect(screen.getByText('Select a note to start editing')).toBeInTheDocument()
    expect(screen.getByText(/Cmd\+P to search/)).toBeInTheDocument()
  })

  it('renders tab bar with open tabs', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
      />
    )
    expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
  })

  it('renders breadcrumb bar with note info', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
      />
    )
    // Breadcrumb shows type and title
    expect(screen.getByText('Project')).toBeInTheDocument()
    // Word count shown
    expect(screen.getByText(/words/)).toBeInTheDocument()
  })

  it('calls onCloseTab when close button is clicked', () => {
    const onCloseTab = vi.fn()
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        onCloseTab={onCloseTab}
      />
    )
    // Find the close button (X icon) in the tab
    const closeButtons = document.querySelectorAll('button')
    const tabCloseBtn = Array.from(closeButtons).find(btn => {
      const svg = btn.querySelector('svg')
      return svg && btn.closest('[class*="group"]')
    })
    if (tabCloseBtn) {
      fireEvent.click(tabCloseBtn)
      expect(onCloseTab).toHaveBeenCalledWith(mockEntry.path)
    }
  })

  it('calls onSwitchTab when clicking a tab', () => {
    const secondEntry: VaultEntry = {
      ...mockEntry,
      path: '/vault/topic/dev.md',
      title: 'Dev Topic',
      isA: 'Topic',
    }
    const onSwitchTab = vi.fn()
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab, { entry: secondEntry, content: '# Dev' }]}
        activeTabPath={mockEntry.path}
        onSwitchTab={onSwitchTab}
      />
    )
    fireEvent.click(screen.getByText('Dev Topic'))
    expect(onSwitchTab).toHaveBeenCalledWith(secondEntry.path)
  })

  it('renders new note button in tab bar', () => {
    const onCreateNote = vi.fn()
    render(
      <Editor
        {...defaultProps}
        onCreateNote={onCreateNote}
      />
    )
    const newNoteBtn = screen.getByTitle('New note')
    expect(newNoteBtn).toBeInTheDocument()
    fireEvent.click(newNoteBtn)
    expect(onCreateNote).toHaveBeenCalled()
  })

  it('shows BlockNote editor when a tab is active', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
      />
    )
    expect(screen.getByTestId('blocknote-view')).toBeInTheDocument()
  })

  it('shows modified indicator when file is modified', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        getNoteStatus={() => 'modified'}
      />
    )
    // Modified indicator shows "M" in the breadcrumb
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('shows new indicator when file is new', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        getNoteStatus={() => 'new'}
      />
    )
    // New indicator shows "N" in the breadcrumb
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  it('renders diff toggle button when file is modified', () => {
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        getNoteStatus={() => 'modified'}
        onLoadDiff={async () => '+ added line'}
      />
    )
    const diffBtn = screen.getByTitle('Show diff')
    expect(diffBtn).toBeInTheDocument()
  })

  it('includes inspector panel', () => {
    render(
      <Editor
        {...defaultProps}
        inspectorCollapsed={false}
        inspectorEntry={mockEntry}
        inspectorContent={mockContent}
      />
    )
    // Inspector renders "Properties" header
    expect(screen.getAllByText('Properties').length).toBeGreaterThan(0)
  })

  // Regression: editor content did not appear on first load because BlockNote's
  // replaceBlocks/insertBlocks internally calls flushSync, which fails silently
  // when invoked from within React's useEffect. Fix: defer via queueMicrotask.
  it('applies parsed content blocks via deferred microtask (regression: flushSync-in-lifecycle)', async () => {
    const testBlocks = [
      { id: 'b1', type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }], props: {}, children: [] },
    ]
    mockEditor.tryParseMarkdownToBlocks.mockResolvedValue(testBlocks)
    mockEditor.replaceBlocks.mockClear()
    mockEditor.insertBlocks.mockClear()

    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
      />
    )

    // Content swap is deferred via queueMicrotask — should NOT be called synchronously
    expect(mockEditor.replaceBlocks).not.toHaveBeenCalled()

    // After microtask + async parse resolve, blocks should be applied
    await vi.waitFor(() => {
      expect(mockEditor.replaceBlocks).toHaveBeenCalled()
    })

    // Clean up mock for other tests
    mockEditor.tryParseMarkdownToBlocks.mockResolvedValue([])
    mockEditor.replaceBlocks.mockClear()
    mockEditor.insertBlocks.mockClear()
  })
})

describe('wikilink autocomplete', () => {
  const entries: VaultEntry[] = [
    { ...mockEntry, title: 'Alpha Project', filename: 'alpha.md', aliases: ['al'] },
    { ...mockEntry, title: 'Beta Review', filename: 'beta.md', path: '/vault/beta.md', aliases: [] },
    { ...mockEntry, title: 'Gamma Notes', filename: 'gamma.md', path: '/vault/gamma.md', aliases: ['gam'] },
  ]

  function renderWithEntries() {
    capturedGetItems = null
    mockFilterSuggestionItems.mockClear()
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={entries}
      />
    )
  }

  it('returns empty array for query shorter than 2 characters', async () => {
    renderWithEntries()
    expect(capturedGetItems).toBeTruthy()
    expect(await capturedGetItems!('')).toEqual([])
    expect(await capturedGetItems!('a')).toEqual([])
    // filterSuggestionItems should NOT be called for short queries
    expect(mockFilterSuggestionItems).not.toHaveBeenCalled()
  })

  it('returns items for query of 2+ characters', async () => {
    renderWithEntries()
    const items = await capturedGetItems!('Al')
    expect(items.length).toBeGreaterThan(0)
    expect(mockFilterSuggestionItems).toHaveBeenCalled()
  })

  it('limits results to MAX_RESULTS (20)', async () => {
    // Create many entries that will all match
    const manyEntries = Array.from({ length: 50 }, (_, i) => ({
      ...mockEntry,
      title: `Match Item ${i}`,
      filename: `match-${i}.md`,
      path: `/vault/match-${i}.md`,
      aliases: [],
    }))

    capturedGetItems = null
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={manyEntries}
      />
    )

    const items = await capturedGetItems!('Match')
    expect(items.length).toBeLessThanOrEqual(20)
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
  })

  it('each item has onItemClick that inserts wikilink', async () => {
    renderWithEntries()
    mockEditor.insertInlineContent.mockClear()
    const items = await capturedGetItems!('Alpha')
    expect(items.length).toBeGreaterThan(0)
    items[0].onItemClick()
    expect(mockEditor.insertInlineContent).toHaveBeenCalledWith([
      { type: 'wikilink', props: { target: 'Alpha Project' } },
      ' ',
    ])
  })

  it('deduplicates entries with the same path', async () => {
    const dupEntries: VaultEntry[] = [
      { ...mockEntry, title: 'Dup Note', filename: 'dup.md', path: '/vault/dup.md', aliases: [] },
      { ...mockEntry, title: 'Dup Note Copy', filename: 'dup.md', path: '/vault/dup.md', aliases: [] },
      { ...mockEntry, title: 'Other Note', filename: 'other.md', path: '/vault/other.md', aliases: [] },
    ]
    capturedGetItems = null
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={dupEntries}
      />
    )
    const items = await capturedGetItems!('Note')
    const paths = items.map((i: { path: string }) => i.path)
    expect(new Set(paths).size).toBe(paths.length)
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
  })

  it('disambiguates entries with the same title by appending folder name', async () => {
    const sameTitle: VaultEntry[] = [
      { ...mockEntry, title: 'Standup', filename: 'standup.md', path: '/vault/work/standup.md', aliases: [] },
      { ...mockEntry, title: 'Standup', filename: 'standup.md', path: '/vault/personal/standup.md', aliases: [] },
    ]
    capturedGetItems = null
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={sameTitle}
      />
    )
    const items = await capturedGetItems!('Standup')
    expect(items).toHaveLength(2)
    const titles = items.map((i: { title: string }) => i.title)
    expect(new Set(titles).size).toBe(2)
    expect(titles).toContain('Standup (work)')
    expect(titles).toContain('Standup (personal)')
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
  })
})

describe('person @mention autocomplete', () => {
  const personEntry: VaultEntry = {
    ...mockEntry,
    title: 'Matteo Cellini',
    filename: 'matteo-cellini.md',
    path: '/vault/person/matteo-cellini.md',
    isA: 'Person',
    aliases: ['Matteo'],
  }
  const nonPersonEntry: VaultEntry = {
    ...mockEntry,
    title: 'Build Laputa App',
    filename: 'laputa-app.md',
    path: '/vault/project/laputa-app.md',
    isA: 'Project',
    aliases: [],
  }
  const entries = [personEntry, nonPersonEntry]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
  let getPersonItems: ((query: string) => Promise<any[]>) | null = null

  function renderForMention() {
    mockFilterSuggestionItems.mockClear()
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={entries}
      />
    )
    getPersonItems = capturedGetItemsByTrigger['@'] ?? null
  }

  it('registers a SuggestionMenuController with @ trigger', () => {
    renderForMention()
    expect(getPersonItems).toBeTruthy()
  })

  it('returns only Person entries for matching query', async () => {
    renderForMention()
    const items = await getPersonItems!('Mat')
    expect(items.length).toBe(1)
    expect(items[0].title).toBe('Matteo Cellini')
  })

  it('excludes non-Person entries', async () => {
    renderForMention()
    const items = await getPersonItems!('Lap')
    expect(items).toHaveLength(0)
  })

  it('works with single-character query', async () => {
    renderForMention()
    const items = await getPersonItems!('M')
    expect(items.length).toBeGreaterThan(0)
  })

  it('inserts a wikilink when person item is clicked', async () => {
    renderForMention()
    mockEditor.insertInlineContent.mockClear()
    const items = await getPersonItems!('Matteo')
    expect(items.length).toBeGreaterThan(0)
    items[0].onItemClick()
    expect(mockEditor.insertInlineContent).toHaveBeenCalledWith([
      { type: 'wikilink', props: { target: 'Matteo Cellini' } },
      ' ',
    ])
  })

  it('shows Person type badge on results', async () => {
    renderForMention()
    const items = await getPersonItems!('Matteo')
    expect(items[0].noteType).toBe('Person')
    expect(items[0].typeColor).toBeTruthy()
  })
})
