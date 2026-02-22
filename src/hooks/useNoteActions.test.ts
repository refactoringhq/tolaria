import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry } from '../types'
import {
  slugify,
  buildNewEntry,
  generateUntitledName,
  entryMatchesTarget,
  buildNoteContent,
  resolveNewNote,
  resolveNewType,
  useNoteActions,
} from './useNoteActions'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  mockInvoke: vi.fn().mockResolvedValue(''),
}))
vi.mock('./mockFrontmatterHelpers', () => ({
  updateMockFrontmatter: vi.fn().mockReturnValue('---\nupdated: true\n---\n'),
  deleteMockFrontmatterProperty: vi.fn().mockReturnValue('---\n---\n'),
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/Users/luca/Laputa/note/test.md',
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
  relationships: {},
  icon: null,
  color: null,
  order: null,
  ...overrides,
})

describe('slugify', () => {
  it('converts text to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('My Project! @#$%')).toBe('my-project')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('collapses multiple separators into one hyphen', () => {
    expect(slugify('hello   world---foo')).toBe('hello-world-foo')
  })
})

describe('buildNewEntry', () => {
  it('creates a VaultEntry with correct fields', () => {
    const entry = buildNewEntry({
      path: '/vault/note/my-note.md',
      slug: 'my-note',
      title: 'My Note',
      type: 'Note',
      status: 'Active',
    })

    expect(entry.path).toBe('/vault/note/my-note.md')
    expect(entry.filename).toBe('my-note.md')
    expect(entry.title).toBe('My Note')
    expect(entry.isA).toBe('Note')
    expect(entry.status).toBe('Active')
    expect(entry.archived).toBe(false)
    expect(entry.trashed).toBe(false)
    expect(entry.modifiedAt).toBeGreaterThan(0)
    expect(entry.createdAt).toBe(entry.modifiedAt)
  })

  it('sets null status when provided', () => {
    const entry = buildNewEntry({
      path: '/vault/topic/ai.md',
      slug: 'ai',
      title: 'AI',
      type: 'Topic',
      status: null,
    })
    expect(entry.status).toBeNull()
  })
})

describe('generateUntitledName', () => {
  it('returns base name when no conflicts', () => {
    expect(generateUntitledName([], 'Note')).toBe('Untitled note')
  })

  it('appends counter when base name exists', () => {
    const entries = [makeEntry({ title: 'Untitled note' })]
    expect(generateUntitledName(entries, 'Note')).toBe('Untitled note 2')
  })

  it('increments counter past existing numbered entries', () => {
    const entries = [
      makeEntry({ title: 'Untitled note' }),
      makeEntry({ title: 'Untitled note 2' }),
      makeEntry({ title: 'Untitled note 3' }),
    ]
    expect(generateUntitledName(entries, 'Note')).toBe('Untitled note 4')
  })

  it('uses type name in lowercase', () => {
    expect(generateUntitledName([], 'Project')).toBe('Untitled project')
  })
})

describe('entryMatchesTarget', () => {
  it('matches by exact title (case-insensitive)', () => {
    const entry = makeEntry({ title: 'My Project' })
    expect(entryMatchesTarget(entry, 'my project', 'my project')).toBe(true)
  })

  it('matches by alias', () => {
    const entry = makeEntry({ aliases: ['MP', 'TheProject'] })
    expect(entryMatchesTarget(entry, 'mp', 'mp')).toBe(true)
  })

  it('matches by path stem (relative to Laputa)', () => {
    const entry = makeEntry({ path: '/Users/luca/Laputa/project/my-project.md' })
    expect(entryMatchesTarget(entry, 'project/my-project', 'project/my-project')).toBe(true)
  })

  it('matches by filename stem', () => {
    const entry = makeEntry({ filename: 'my-project.md' })
    expect(entryMatchesTarget(entry, 'my-project', 'my-project')).toBe(true)
  })

  it('matches when target as words matches title', () => {
    const entry = makeEntry({ title: 'my project' })
    expect(entryMatchesTarget(entry, 'project/my-project', 'my project')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    const entry = makeEntry({ title: 'Something Else', aliases: [], filename: 'else.md' })
    expect(entryMatchesTarget(entry, 'nonexistent', 'nonexistent')).toBe(false)
  })
})

describe('buildNoteContent', () => {
  it('generates frontmatter with status for regular types', () => {
    const content = buildNoteContent('My Note', 'Note', 'Active')
    expect(content).toBe('---\ntitle: My Note\nis_a: Note\nstatus: Active\n---\n\n# My Note\n\n')
  })

  it('omits status when null', () => {
    const content = buildNoteContent('AI', 'Topic', null)
    expect(content).toBe('---\ntitle: AI\nis_a: Topic\n---\n\n# AI\n\n')
  })
})

describe('resolveNewNote', () => {
  it('uses TYPE_FOLDER_MAP for known types', () => {
    const { entry, content } = resolveNewNote('My Project', 'Project', '/Users/luca/Laputa')
    expect(entry.path).toBe('/Users/luca/Laputa/project/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBe('Active')
    expect(content).toContain('is_a: Project')
    expect(content).toContain('status: Active')
  })

  it('falls back to slugified type for custom types', () => {
    const { entry } = resolveNewNote('First Recipe', 'Recipe', '/Users/luca/Laputa')
    expect(entry.path).toBe('/Users/luca/Laputa/recipe/first-recipe.md')
  })

  it('omits status for Topic type', () => {
    const { entry, content } = resolveNewNote('Machine Learning', 'Topic', '/Users/luca/Laputa')
    expect(entry.status).toBeNull()
    expect(content).not.toContain('status:')
  })

  it('omits status for Person type', () => {
    const { entry } = resolveNewNote('John Doe', 'Person', '/Users/luca/Laputa')
    expect(entry.status).toBeNull()
  })

  it('uses provided vaultPath instead of hardcoded path', () => {
    const { entry } = resolveNewNote('My Note', 'Note', '/custom/vault')
    expect(entry.path).toBe('/custom/vault/note/my-note.md')
  })
})

describe('resolveNewType', () => {
  it('creates a type entry in the type folder', () => {
    const { entry, content } = resolveNewType('Recipe', '/Users/luca/Laputa')
    expect(entry.path).toBe('/Users/luca/Laputa/type/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(entry.status).toBeNull()
    expect(content).toContain('Is A: Type')
    expect(content).toContain('# Recipe')
  })

  it('uses provided vaultPath instead of hardcoded path', () => {
    const { entry } = resolveNewType('Book', '/custom/vault')
    expect(entry.path).toBe('/custom/vault/type/book.md')
  })
})

describe('useNoteActions hook', () => {
  const addEntry = vi.fn()
  const updateContent = vi.fn()
  const setToastMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handleCreateNote calls addEntry and creates correct entry', () => {
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    act(() => {
      result.current.handleCreateNote('Test Note', 'Note')
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry, createdContent] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Test Note')
    expect(createdEntry.isA).toBe('Note')
    expect(createdEntry.path).toContain('note/test-note.md')
    expect(createdContent).toContain('title: Test Note')
  })

  it('handleCreateNote registers mock content in non-Tauri mode', async () => {
    const { addMockEntry } = await import('../mock-tauri')
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    act(() => {
      result.current.handleCreateNote('Persisted Note', 'Note')
    })

    expect(addMockEntry).toHaveBeenCalledTimes(1)
    const [mockEntry, mockContent] = (addMockEntry as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(mockEntry.path).toContain('note/persisted-note.md')
    expect(mockContent).toContain('title: Persisted Note')
  })

  it('handleCreateNote uses provided vaultPath for entry path', () => {
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/my/vault')
    )

    act(() => {
      result.current.handleCreateNote('Custom Path Note', 'Project')
    })

    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.path).toBe('/my/vault/project/custom-path-note.md')
  })

  it('handleCreateType creates type entry', () => {
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    act(() => {
      result.current.handleCreateType('Recipe')
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.isA).toBe('Type')
    expect(createdEntry.title).toBe('Recipe')
  })

  it('handleNavigateWikilink finds entry by title', async () => {
    const target = makeEntry({ title: 'Target Note', path: '/vault/note/target.md' })
    const entries = [target]

    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    await act(async () => {
      result.current.handleNavigateWikilink('Target Note')
    })

    // Should set active tab path (via handleSelectNote which loads content)
    expect(result.current.activeTabPath).toBe('/vault/note/target.md')
  })

  it('handleNavigateWikilink warns when target not found', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const entries: VaultEntry[] = []

    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    act(() => {
      result.current.handleNavigateWikilink('Nonexistent')
    })

    expect(warnSpy).toHaveBeenCalledWith('Navigation target not found: Nonexistent')
    warnSpy.mockRestore()
  })

  it('handleUpdateFrontmatter calls mock and shows toast on success', async () => {
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'status', 'Done')
    })

    expect(updateContent).toHaveBeenCalled()
    expect(setToastMessage).toHaveBeenCalledWith('Property updated')
  })

  it('handleDeleteProperty calls mock and shows toast on success', async () => {
    const entries: VaultEntry[] = []
    const { result } = renderHook(() =>
      useNoteActions(addEntry, updateContent, entries, setToastMessage, '/Users/luca/Laputa')
    )

    await act(async () => {
      await result.current.handleDeleteProperty('/vault/note.md', 'status')
    })

    expect(updateContent).toHaveBeenCalled()
    expect(setToastMessage).toHaveBeenCalledWith('Property deleted')
  })
})
