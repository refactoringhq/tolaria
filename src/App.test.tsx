import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Provide a localStorage mock that supports all methods (jsdom's may be incomplete)
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
    outgoingLinks: [],
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
    outgoingLinks: [],
  },
]

const mockAllContent: Record<string, string> = {
  '/vault/project/test.md': '---\ntitle: Test Project\nis_a: Project\n---\n\n# Test Project\n\nSome content.',
  '/vault/topic/dev.md': '---\ntitle: Software Development\nis_a: Topic\n---\n\n# Software Development\n',
}

const mockCommandResults: Record<string, unknown> = {
  list_vault: mockEntries,
  get_all_content: mockAllContent,
  get_modified_files: [],
  get_note_content: mockAllContent['/vault/project/test.md'] || '',
  get_file_history: [],
  get_settings: { anthropic_key: null, openai_key: null, google_key: null, github_token: null, github_username: null, auto_pull_interval_minutes: null },
  git_pull: { status: 'up_to_date', message: 'Already up to date', updatedFiles: [], conflictFiles: [] },
  save_settings: null,
  check_vault_exists: true,
  get_default_vault_path: '/Users/mock/Documents/Laputa',
  list_themes: [],
  get_vault_settings: { theme: null },
}

vi.mock('./mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(async (cmd: string) => mockCommandResults[cmd] ?? null),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
}))

// Mock ai-chat utilities
vi.mock('./utils/ai-chat', () => ({
  buildSystemPrompt: vi.fn(() => ({ prompt: '', totalTokens: 0, truncated: false })),
  checkClaudeCli: vi.fn(async () => ({ installed: false })),
  streamClaudeChat: vi.fn(async () => 'mock-session'),
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

    // Reset view mode and onboarding state between tests
    localStorage.removeItem('laputa-view-mode')
    localStorage.removeItem('laputa_welcome_dismissed')
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

  it('Cmd+1 hides sidebar and note list (editor-only mode)', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // All panels visible by default
    expect(document.querySelector('.app__sidebar')).toBeInTheDocument()
    expect(document.querySelector('.app__note-list')).toBeInTheDocument()

    // Cmd+1 → editor-only
    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).not.toBeInTheDocument()
    })
  })

  it('Cmd+2 shows editor + note list (sidebar hidden)', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: '2', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).toBeInTheDocument()
    })
  })

  it('Cmd+3 restores all panels after Cmd+1', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // Switch to editor-only first
    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
    })

    // Cmd+3 → all panels
    fireEvent.keyDown(window, { key: '3', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).toBeInTheDocument()
    })
  })
})
