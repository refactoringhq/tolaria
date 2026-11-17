import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  expectOnlySearchMatch,
  installFullTextSearchMocks,
  type NoteListSearchMockResult,
  renderBookNoteList,
  searchNoteList,
} from '../test-utils/noteListRenderingFixtures'
import { makeEntry, mockEntries, renderNoteList } from '../test-utils/noteListTestUtils'

vi.mock('../hooks/useTabManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTabManagement')>()
  return { ...actual, prefetchNoteContent: vi.fn() }
})

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

  it('shows the active folder name and creates notes inside that folder', () => {
    const { onCreateNote } = renderNoteList({
      selection: {
        kind: 'folder',
        path: 'Projects/2026 Planning',
        rootPath: '/Users/luca/Laputa',
      },
    })

    expect(screen.getByRole('heading', { name: '2026 Planning' })).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Create new note'))

    expect(onCreateNote).toHaveBeenCalledWith(undefined, {
      creationPath: 'folder_header',
      folderPath: 'Projects/2026 Planning',
      vaultPath: '/Users/luca/Laputa',
    })
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
    expect(screen.getByText('Referenced by')).toBeInTheDocument()
  })

  it('toggles the search input from the header action', () => {
    renderNoteList()
    expect(screen.queryByPlaceholderText('Search notes...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Search notes'))
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('filters by a case-insensitive search query', async () => {
    renderNoteList()
    await searchNoteList('facebook')
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by snippet text when the title does not match', async () => {
    renderNoteList({
      entries: [
        makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'Alpha Note', snippet: 'Routine body copy.' }),
        makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'Beta Note', snippet: 'Nebula-only snippet token.' }),
      ],
    })

    await searchNoteList('nebula-only')

    expect(screen.getByText('Beta Note')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Note')).not.toBeInTheDocument()
  })

  it('filters by full note content when the title and snippet do not match', async () => {
    const { getNoteContent, restore, searchVault } = installFullTextSearchMocks({
      resultsByVault: {
        '/vault': [{
          note_type: 'Note',
          path: '/vault/b.md',
          score: 1,
          snippet: 'Private body match is intentionally not rendered here.',
          title: 'Beta Note',
        }],
      },
    })

    try {
      renderNoteList({
        entries: [
          makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'Alpha Note', snippet: 'Routine body copy.' }),
          makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'Beta Note', snippet: 'Another public preview.' }),
        ],
      })

      await searchNoteList('subterranean-keyword')

      await waitFor(() => {
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({
          vaultPath: '/vault',
          query: 'subterranean-keyword',
          mode: 'keyword',
          excludeFrontmatter: true,
        }))
      })
      expect(getNoteContent).not.toHaveBeenCalled()
      expect(screen.getByText('Beta Note')).toBeInTheDocument()
      expect(screen.queryByText('Alpha Note')).not.toBeInTheDocument()
      expect(screen.queryByText('Private body match is intentionally not rendered here.')).not.toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('ignores stale full-content results when the query changes before a slow search returns', async () => {
    const originalContentHandler = window.__mockHandlers?.get_note_content
    const originalSearchHandler = window.__mockHandlers?.search_vault
    let resolveSlowSearch: ((response: {
      elapsed_ms: number
      results: NoteListSearchMockResult[]
    }) => void) | null = null
    const searchVault = vi.fn((args?: Record<string, unknown>) => {
      if (args?.query === 'slow-body') {
        return new Promise((resolve) => {
          resolveSlowSearch = resolve
        })
      }

      return Promise.resolve({
        elapsed_ms: 7,
        results: [],
      })
    })
    const getNoteContent = vi.fn(() => {
      throw new Error('Note-list full-text search should not read note content in React')
    })

    if (!window.__mockHandlers) window.__mockHandlers = {}
    window.__mockHandlers.search_vault = searchVault
    window.__mockHandlers.get_note_content = getNoteContent

    try {
      renderNoteList({
        entries: [
          makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'Alpha Note', snippet: 'Routine body copy.' }),
          makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'Beta Note', snippet: 'Another public preview.' }),
        ],
      })

      fireEvent.click(screen.getByTitle('Search notes'))
      fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'slow-body' } })

      await waitFor(() => {
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({
          query: 'slow-body',
          excludeFrontmatter: true,
        }))
      })

      fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'new-empty-query' } })

      await waitFor(() => {
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({
          query: 'new-empty-query',
          excludeFrontmatter: true,
        }))
      })
      await waitFor(() => {
        expect(screen.queryByTestId('note-list-search-loading')).not.toBeInTheDocument()
      })

      await act(async () => {
        resolveSlowSearch?.({
          elapsed_ms: 7,
          results: [{
            note_type: 'Note',
            path: '/vault/b.md',
            score: 1,
            snippet: 'Stale body hit from the previous query.',
            title: 'Beta Note',
          }],
        })
        await Promise.resolve()
      })

      expect(getNoteContent).not.toHaveBeenCalled()
      expect(screen.queryByText('Beta Note')).not.toBeInTheDocument()
      expect(screen.getByText('No matching notes')).toBeInTheDocument()
    } finally {
      window.__mockHandlers.search_vault = originalSearchHandler
      window.__mockHandlers.get_note_content = originalContentHandler
    }
  })

  it('ignores full-content matches that only appear in hidden frontmatter', async () => {
    const { getNoteContent, restore, searchVault } = installFullTextSearchMocks({
      resultsByVault: {
        '/vault': [],
      },
    })

    try {
      renderNoteList({
        entries: [
          makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'Alpha Note', snippet: 'Routine body copy.' }),
          makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'Beta Note', snippet: 'Another public preview.' }),
        ],
      })

      await searchNoteList('hidden-frontmatter-keyword')

      await waitFor(() => {
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({
          excludeFrontmatter: true,
        }))
      })
      expect(getNoteContent).not.toHaveBeenCalled()
      expect(screen.queryByText('Alpha Note')).not.toBeInTheDocument()
      expect(screen.getByText('No matching notes')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('runs full-content note-list search across visible workspaces', async () => {
    const { getNoteContent, restore, searchVault } = installFullTextSearchMocks({
      resultsByVault: {
        '/team': [{
          note_type: 'Note',
          path: '/team/team-body-hit.md',
          score: 1,
          snippet: 'Private workspace body hit.',
          title: 'Team Body Hit',
        }],
      },
    })

    try {
      renderNoteList({
        entries: [
          makeEntry({
            path: '/personal/personal-note.md',
            filename: 'personal-note.md',
            title: 'Personal Note',
            snippet: 'No body token here.',
            workspace: { id: 'personal', label: 'Personal', alias: 'PE', path: '/personal', shortLabel: 'PE', color: null, icon: null, mounted: true, available: true, defaultForNewNotes: true },
          }),
          makeEntry({
            path: '/team/team-body-hit.md',
            filename: 'team-body-hit.md',
            title: 'Team Body Hit',
            snippet: 'No body token here either.',
            workspace: { id: 'team', label: 'Team', alias: 'TE', path: '/team', shortLabel: 'TE', color: null, icon: null, mounted: true, available: true, defaultForNewNotes: false },
          }),
        ],
      })

      await searchNoteList('workspace-only-keyword')

      await waitFor(() => {
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({ vaultPath: '/personal', excludeFrontmatter: true }))
        expect(searchVault).toHaveBeenCalledWith(expect.objectContaining({ vaultPath: '/team', excludeFrontmatter: true }))
      })
      expect(getNoteContent).not.toHaveBeenCalled()
      expect(screen.getByText('Team Body Hit')).toBeInTheDocument()
      expect(screen.queryByText('Personal Note')).not.toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('filters by visible property values and ignores hidden properties', async () => {
    renderBookNoteList({
      entryOverrides: {
        title: 'Property Search Note',
        properties: { Priority: 'Boarding Window', Owner: 'Hidden Owner Value' },
      },
      allNotesNoteListProperties: null,
    })

    await expectOnlySearchMatch({
      title: 'Property Search Note',
      matchingQuery: 'boarding window',
      hiddenQuery: 'hidden owner value',
    })
  })

  it('uses the active all-notes columns when filtering by visible property values', async () => {
    renderBookNoteList({
      entryOverrides: {
        title: 'Override Search Note',
        properties: { Priority: 'Hidden Priority', Owner: 'Visible Owner Value' },
      },
      allNotesNoteListProperties: ['Owner'],
    })

    await expectOnlySearchMatch({
      title: 'Override Search Note',
      matchingQuery: 'visible owner value',
      hiddenQuery: 'hidden priority',
    })
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

  it('gives every note-list header action the same ghost button treatment and spacing', () => {
    renderBookNoteList({
      entryOverrides: { properties: { Priority: 'High' } },
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: null,
    })

    const buttons = [
      screen.getByTestId('layout-menu-button'),
      screen.getByTestId('sort-button-__list__'),
      screen.getByTitle('Search notes'),
      screen.getByTitle('Customize Inbox columns'),
      screen.getByTitle('Create new note'),
    ]

    for (const button of buttons) {
      expect(button).toHaveAttribute('data-variant', 'ghost')
      expect(button).toHaveAttribute('data-size', 'icon-xs')
      expect(button).toHaveClass(
        '!h-6',
        '!w-6',
        '!rounded-md',
        '!p-0',
        '!text-muted-foreground',
        'hover:!bg-accent',
        'hover:!text-foreground',
        'focus-visible:!bg-accent',
        'data-[state=open]:!bg-accent',
        'aria-expanded:!bg-accent',
      )
      expect(button).not.toHaveAttribute('tabindex', '-1')
    }
    expect(screen.getByTitle('Create new note').parentElement).toHaveClass('gap-1')
  })

  it('keeps the note-list search input full width and shows inline search controls while loading', async () => {
    vi.useFakeTimers()
    try {
      renderNoteList({
        entries: [
          makeEntry({ path: '/vault/a.md', filename: 'a.md', title: 'Alpha Strategy' }),
          makeEntry({ path: '/vault/b.md', filename: 'b.md', title: 'Beta Note' }),
        ],
      })

      fireEvent.click(screen.getByTitle('Search notes'))
      fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: 'strategy' } })

      const searchInput = screen.getByPlaceholderText('Search notes...')
      expect(searchInput).toHaveClass('pr-16')
      expect(searchInput.parentElement).toHaveClass('relative', 'flex-1')
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
      expect(screen.getByTestId('note-list-search-loading')).toBeInTheDocument()
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(180)
      })
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })

      expect(screen.queryByTestId('note-list-search-loading')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
