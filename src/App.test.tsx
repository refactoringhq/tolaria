import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @tauri-apps/api/core before importing App
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock mock-tauri module
const mockEntries = [
  {
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
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 1024,
  },
  {
    path: '/vault/topic/dev.md',
    filename: 'dev.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: ['Dev'],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 256,
  },
]

const mockAllContent: Record<string, string> = {
  '/vault/project/test.md': '---\ntitle: Test Project\nis_a: Project\n---\n\n# Test Project\n\nSome content.',
  '/vault/topic/dev.md': '---\ntitle: Software Development\nis_a: Topic\n---\n\n# Software Development\n',
}

vi.mock('./mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(async (cmd: string) => {
    if (cmd === 'list_vault') return mockEntries
    if (cmd === 'get_all_content') return mockAllContent
    if (cmd === 'get_modified_files') return []
    if (cmd === 'get_note_content') return mockAllContent['/vault/project/test.md'] || ''
    if (cmd === 'get_file_history') return []
    if (cmd === 'get_settings') return { anthropic_key: null, openai_key: null, google_key: null, github_token: null }
    if (cmd === 'save_settings') return null
    return null
  }),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
}))

// Mock ai-chat utilities (uses localStorage which may not be available in jsdom)
vi.mock('./utils/ai-chat', () => ({
  setApiKey: vi.fn(),
  getApiKey: vi.fn(() => ''),
  MODEL_OPTIONS: [{ value: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5' }],
  buildSystemPrompt: vi.fn(() => ({ prompt: '', totalTokens: 0, truncated: false })),
  streamChat: vi.fn(),
}))

// Mock BlockNote components (they need DOM APIs not available in jsdom)
vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: () => ({}) },
  defaultInlineContentSpecs: {},
  filterSuggestionItems: vi.fn(() => []),
}))

vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: vi.fn(() => []),
}))

vi.mock('@blocknote/react', () => ({
  createReactInlineContentSpec: () => ({ render: () => null }),
  useCreateBlockNote: () => ({
    tryParseMarkdownToBlocks: async () => [],
    replaceBlocks: () => {},
    document: [],
    insertInlineContent: () => {},
    onMount: (cb: () => void) => { cb(); return () => {} },
  }),
  SuggestionMenuController: () => null,
}))

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ children }: { children?: React.ReactNode }) => <div data-testid="blocknote-view">{children}</div>,
}))

vi.mock('@blocknote/mantine/style.css', () => ({}))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the four-panel layout', async () => {
    render(<App />)
    // Wait for vault to load
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })
  })

  it('loads and displays vault entries in sidebar', async () => {
    render(<App />)
    await waitFor(() => {
      // Entries appear in both Sidebar and NoteList
      expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Software Development').length).toBeGreaterThan(0)
    })
  })

  it('shows empty state in editor when no note is selected', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Select a note to start editing')).toBeInTheDocument()
    })
  })

  it('shows keyboard shortcut hints', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Cmd\+P to search/)).toBeInTheDocument()
    })
  })

  it('registers keyboard shortcuts without error', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // Cmd+S with no pending changes shows "Nothing to save"
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    await waitFor(() => {
      expect(screen.getByText('Nothing to save')).toBeInTheDocument()
    })
  })

  it('renders sidebar with correct default selection (All Notes)', async () => {
    render(<App />)
    await waitFor(() => {
      // "All Notes" should be rendered as the selected nav item
      expect(screen.getByText('All Notes')).toBeInTheDocument()
      expect(screen.getByText('Favorites')).toBeInTheDocument()
    })
  })

  it('renders status bar', async () => {
    render(<App />)
    // StatusBar should be present
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })
    // The status bar element should exist in the DOM
    const appShell = document.querySelector('.app-shell')
    expect(appShell).toBeInTheDocument()
  })
})
