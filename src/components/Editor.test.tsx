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
  focus: vi.fn(),
  setTextCursorPosition: vi.fn(),
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
  BlockNoteView: ({ children, editable }: { children?: React.ReactNode; editable?: boolean }) => <div data-testid="blocknote-view" data-editable={editable !== false ? 'true' : 'false'}>{children}</div>,
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
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
    order: null,
  template: null, sort: null,
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
  describe('trashed note behavior', () => {
    const trashedEntry: VaultEntry = { ...mockEntry, trashed: true, trashedAt: Date.now() / 1000 }
    const trashedTab = { entry: trashedEntry, content: mockContent }

    function renderTrashed(overrides: Partial<Parameters<typeof Editor>[0]> = {}) {
      return render(<Editor {...defaultProps} tabs={[trashedTab]} activeTabPath={trashedEntry.path} {...overrides} />)
    }

    it('shows banner and read-only editor when note is trashed', () => {
      renderTrashed()
      expect(screen.getByTestId('trashed-note-banner')).toBeInTheDocument()
      expect(screen.getByText('This note is in the Trash')).toBeInTheDocument()
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'false')
    })

    it('does not show banner and sets editable for normal notes', () => {
      render(<Editor {...defaultProps} tabs={[mockTab]} activeTabPath={mockEntry.path} />)
      expect(screen.queryByTestId('trashed-note-banner')).not.toBeInTheDocument()
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'true')
    })

    it('calls onRestoreNote when banner restore is clicked', () => {
      const onRestoreNote = vi.fn()
      renderTrashed({ onRestoreNote })
      fireEvent.click(screen.getByTestId('trashed-banner-restore'))
      expect(onRestoreNote).toHaveBeenCalledWith(trashedEntry.path)
    })

    it('calls onDeleteNote when banner delete is clicked', () => {
      const onDeleteNote = vi.fn()
      renderTrashed({ onDeleteNote })
      fireEvent.click(screen.getByTestId('trashed-banner-delete'))
      expect(onDeleteNote).toHaveBeenCalledWith(trashedEntry.path)
    })

    it('shows trash banner immediately when entry changes to trashed (reactive)', () => {
      const { rerender } = render(
        <Editor {...defaultProps} tabs={[mockTab]} activeTabPath={mockEntry.path} onRestoreNote={vi.fn()} onDeleteNote={vi.fn()} />
      )
      expect(screen.queryByTestId('trashed-note-banner')).not.toBeInTheDocument()

      const updatedTab = { entry: { ...mockEntry, trashed: true, trashedAt: Date.now() / 1000 }, content: mockContent }
      rerender(
        <Editor {...defaultProps} tabs={[updatedTab]} activeTabPath={mockEntry.path} onRestoreNote={vi.fn()} onDeleteNote={vi.fn()} />
      )
      expect(screen.getByTestId('trashed-note-banner')).toBeInTheDocument()
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'false')
    })

    it('removes trash banner immediately when entry is restored (reactive)', () => {
      const { rerender } = render(
        <Editor {...defaultProps} tabs={[trashedTab]} activeTabPath={trashedEntry.path} onRestoreNote={vi.fn()} onDeleteNote={vi.fn()} />
      )
      expect(screen.getByTestId('trashed-note-banner')).toBeInTheDocument()

      const restoredTab = { entry: { ...trashedEntry, trashed: false, trashedAt: null }, content: mockContent }
      rerender(
        <Editor {...defaultProps} tabs={[restoredTab]} activeTabPath={trashedEntry.path} onRestoreNote={vi.fn()} onDeleteNote={vi.fn()} />
      )
      expect(screen.queryByTestId('trashed-note-banner')).not.toBeInTheDocument()
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'true')
    })
  })
})

describe('click empty editor space', () => {
  it('focuses editor at end of last block when clicking empty space below content', () => {
    mockEditor.focus.mockClear()
    mockEditor.setTextCursorPosition.mockClear()

    render(
      <Editor {...defaultProps} tabs={[mockTab]} activeTabPath={mockEntry.path} />
    )

    const container = document.querySelector('.editor__blocknote-container')
    expect(container).toBeTruthy()

    // Click directly on the container (simulates clicking empty space below content)
    fireEvent.click(container!)

    expect(mockEditor.setTextCursorPosition).toHaveBeenCalledWith('1', 'end')
    expect(mockEditor.focus).toHaveBeenCalled()
  })

  it('does not interfere with clicks on contenteditable elements', () => {
    mockEditor.focus.mockClear()
    mockEditor.setTextCursorPosition.mockClear()

    render(
      <Editor {...defaultProps} tabs={[mockTab]} activeTabPath={mockEntry.path} />
    )

    // Simulate clicking on a contenteditable child (which ProseMirror would handle)
    const container = document.querySelector('.editor__blocknote-container')!
    const editableDiv = document.createElement('div')
    editableDiv.setAttribute('contenteditable', 'true')
    container.appendChild(editableDiv)

    fireEvent.click(editableDiv)

    expect(mockEditor.setTextCursorPosition).not.toHaveBeenCalled()
    // Clean up
    container.removeChild(editableDiv)
  })

  it('does not focus editor when note is not editable (trashed)', () => {
    mockEditor.focus.mockClear()
    mockEditor.setTextCursorPosition.mockClear()

    const trashedEntry: VaultEntry = { ...mockEntry, trashed: true, trashedAt: Date.now() / 1000 }
    render(
      <Editor
        {...defaultProps}
        tabs={[{ entry: trashedEntry, content: mockContent }]}
        activeTabPath={trashedEntry.path}
      />
    )

    const container = document.querySelector('.editor__blocknote-container')
    expect(container).toBeTruthy()
    fireEvent.click(container!)

    expect(mockEditor.setTextCursorPosition).not.toHaveBeenCalled()
    expect(mockEditor.focus).not.toHaveBeenCalled()
  })
})

describe('archived note behavior', () => {
  it('shows archive banner immediately when entry changes to archived (reactive)', () => {
    const { rerender } = render(
      <Editor {...defaultProps} tabs={[mockTab]} activeTabPath={mockEntry.path} onUnarchiveNote={vi.fn()} />
    )
    expect(screen.queryByTestId('archived-note-banner')).not.toBeInTheDocument()

    const archivedTab = { entry: { ...mockEntry, archived: true }, content: mockContent }
    rerender(
      <Editor {...defaultProps} tabs={[archivedTab]} activeTabPath={mockEntry.path} onUnarchiveNote={vi.fn()} />
    )
    expect(screen.getByTestId('archived-note-banner')).toBeInTheDocument()
  })

  it('removes archive banner immediately when entry is unarchived (reactive)', () => {
    const archivedEntry: VaultEntry = { ...mockEntry, archived: true }
    const archivedTab = { entry: archivedEntry, content: mockContent }
    const { rerender } = render(
      <Editor {...defaultProps} tabs={[archivedTab]} activeTabPath={archivedEntry.path} onUnarchiveNote={vi.fn()} />
    )
    expect(screen.getByTestId('archived-note-banner')).toBeInTheDocument()

    const unarchivedTab = { entry: { ...archivedEntry, archived: false }, content: mockContent }
    rerender(
      <Editor {...defaultProps} tabs={[unarchivedTab]} activeTabPath={archivedEntry.path} onUnarchiveNote={vi.fn()} />
    )
    expect(screen.queryByTestId('archived-note-banner')).not.toBeInTheDocument()
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

  it('shows correct noteType and color for typed entries, neutral for untyped', async () => {
    const mixedEntries: VaultEntry[] = [
      { ...mockEntry, title: 'Test Project', filename: 'proj.md', path: '/vault/proj.md', isA: 'Project', aliases: [] },
      { ...mockEntry, title: 'Test Plain', filename: 'plain.md', path: '/vault/plain.md', isA: null, aliases: [] },
      { ...mockEntry, title: 'Test Explicit', filename: 'explicit.md', path: '/vault/explicit.md', isA: 'Note', aliases: [] },
    ]
    capturedGetItems = null
    mockFilterSuggestionItems.mockImplementation((items: unknown[]) => items)
    render(
      <Editor
        {...defaultProps}
        tabs={[mockTab]}
        activeTabPath={mockEntry.path}
        entries={mixedEntries}
      />
    )
    const items = await capturedGetItems!('Test')
    // Typed entries should have noteType and color
    const project = items.find((i: { title: string }) => i.title === 'Test Project')
    expect(project).toBeDefined()
    expect(project!.noteType).toBe('Project')
    expect(project!.typeColor).toBeTruthy()
    // Untyped entries (isA: null or 'Note') should have no noteType (grey/neutral)
    const plainNote = items.find((i: { title: string }) => i.title === 'Test Plain')
    expect(plainNote).toBeDefined()
    expect(plainNote!.noteType).toBeUndefined()
    expect(plainNote!.typeColor).toBeUndefined()
    const explicitNote = items.find((i: { title: string }) => i.title === 'Test Explicit')
    expect(explicitNote).toBeDefined()
    expect(explicitNote!.noteType).toBeUndefined()
    expect(explicitNote!.typeColor).toBeUndefined()
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
