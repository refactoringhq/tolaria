import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchPanel } from './SearchPanel'
import type { VaultEntry } from '../types'

// Mock the mock-tauri module (component uses mockInvoke when isTauri() is false)
vi.mock('../mock-tauri', () => ({
  mockInvoke: vi.fn(),
  isTauri: () => false,
}))

import { mockInvoke } from '../mock-tauri'
const mockInvokeFn = vi.mocked(mockInvoke)

const MOCK_ENTRIES: VaultEntry[] = [
  {
    path: '/vault/essay/ai-apis.md',
    filename: 'ai-apis.md',
    title: 'How to Design AI-first APIs',
    isA: 'Essay',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000,
    createdAt: Date.now() / 1000,
    fileSize: 500,
    snippet: 'A guide to designing APIs for AI',
    relationships: {},
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/vault/event/retreat.md',
    filename: 'retreat.md',
    title: 'Refactoring Retreat',
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
    modifiedAt: Date.now() / 1000,
    createdAt: Date.now() / 1000,
    fileSize: 300,
    snippet: 'Team retreat event',
    relationships: {},
    icon: null,
    color: null,
    order: null,
  },
]

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <SearchPanel open={false} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open', () => {
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.getByPlaceholderText('Search in all notes...')).toBeInTheDocument()
  })

  it('shows empty state hint when no query', () => {
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.getByText('Search across all note contents')).toBeInTheDocument()
  })

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn()
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={onClose} />
    )
    // Click the overlay (outermost div)
    const overlay = screen.getByPlaceholderText('Search in all notes...').closest('.fixed')!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={onClose} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('performs search on query input with debounce', async () => {
    mockInvokeFn.mockResolvedValue({
      results: [
        { title: 'How to Design AI-first APIs', path: '/vault/essay/ai-apis.md', snippet: '...designing APIs for AI...', score: 0.87, note_type: 'Essay' },
      ],
      elapsed_ms: 48,
    })

    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    const input = screen.getByPlaceholderText('Search in all notes...')
    fireEvent.change(input, { target: { value: 'api design' } })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('search_vault', {
        vaultPath: '/vault',
        query: 'api design',
        mode: 'keyword',
        limit: 20,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('How to Design AI-first APIs')).toBeInTheDocument()
    })
  })

  it('shows no results message when search returns empty', async () => {
    mockInvokeFn.mockResolvedValue({ results: [], elapsed_ms: 10 })

    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    const input = screen.getByPlaceholderText('Search in all notes...')
    fireEvent.change(input, { target: { value: 'xyznonexistent' } })

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument()
    })
  })

  it('navigates results with arrow keys', async () => {
    mockInvokeFn.mockResolvedValue({
      results: [
        { title: 'Result One', path: '/vault/essay/ai-apis.md', snippet: 'First result', score: 0.9, note_type: null },
        { title: 'Result Two', path: '/vault/event/retreat.md', snippet: 'Second result', score: 0.8, note_type: null },
      ],
      elapsed_ms: 20,
    })

    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    const input = screen.getByPlaceholderText('Search in all notes...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('Result One')).toBeInTheDocument()
    })

    // Arrow down should highlight second result
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    // The second item should now have bg-accent class
    await waitFor(() => {
      const resultTwo = screen.getByText('Result Two').closest('[class*="cursor-pointer"]')!
      expect(resultTwo.className).toContain('bg-accent')
    })
  })

  it('selects result on Enter and calls onSelectNote', async () => {
    mockInvokeFn.mockResolvedValue({
      results: [
        { title: 'How to Design AI-first APIs', path: '/vault/essay/ai-apis.md', snippet: 'First', score: 0.9, note_type: null },
      ],
      elapsed_ms: 20,
    })

    const onSelectNote = vi.fn()
    const onClose = vi.fn()
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={onSelectNote} onClose={onClose} />
    )

    fireEvent.change(screen.getByPlaceholderText('Search in all notes...'), { target: { value: 'api' } })

    await waitFor(() => {
      expect(screen.getByText('How to Design AI-first APIs')).toBeInTheDocument()
    })

    // Wait for the effect to re-register with new results before firing Enter
    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => {
      expect(onSelectNote).toHaveBeenCalledWith(MOCK_ENTRIES[0])
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('toggles search mode with Tab key', async () => {
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    // Initial mode is keyword — the keyword button should be styled active
    const keywordBtn = screen.getByText('Keyword')
    expect(keywordBtn.className).toContain('bg-secondary')

    // Tab toggles to semantic
    fireEvent.keyDown(window, { key: 'Tab' })

    const semanticBtn = screen.getByText('Semantic')
    expect(semanticBtn.className).toContain('bg-secondary')
  })

  it('toggles mode via button click', () => {
    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByText('Semantic'))
    expect(screen.getByText('Semantic').className).toContain('bg-secondary')
    expect(screen.getByText('Keyword').className).not.toContain('bg-secondary')
  })

  it('shows result count and elapsed time', async () => {
    mockInvokeFn.mockResolvedValue({
      results: [
        { title: 'Result', path: '/vault/essay/ai-apis.md', snippet: 'Content', score: 0.9, note_type: null },
      ],
      elapsed_ms: 123,
    })

    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    fireEvent.change(screen.getByPlaceholderText('Search in all notes...'), { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText(/1 result/)).toBeInTheDocument()
      expect(screen.getByText(/123ms/)).toBeInTheDocument()
    })
  })

  it('displays note type badge from vault entries', async () => {
    mockInvokeFn.mockResolvedValue({
      results: [
        { title: 'How to Design AI-first APIs', path: '/vault/essay/ai-apis.md', snippet: 'Content', score: 0.9, note_type: null },
      ],
      elapsed_ms: 20,
    })

    render(
      <SearchPanel open={true} vaultPath="/vault" entries={MOCK_ENTRIES} onSelectNote={vi.fn()} onClose={vi.fn()} />
    )

    fireEvent.change(screen.getByPlaceholderText('Search in all notes...'), { target: { value: 'api' } })

    await waitFor(() => {
      expect(screen.getByText('Essay')).toBeInTheDocument()
    })
  })
})
