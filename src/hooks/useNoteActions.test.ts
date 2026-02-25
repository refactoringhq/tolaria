import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import {
  slugify,
  buildNewEntry,
  generateUntitledName,
  entryMatchesTarget,
  buildNoteContent,
  resolveNewNote,
  resolveNewType,
  frontmatterToEntryPatch,
  useNoteActions,
} from './useNoteActions'
import type { NoteActionsConfig } from './useNoteActions'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
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
  outgoingLinks: [],
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

  it('avoids names in the pending set', () => {
    const pending = new Set(['Untitled note'])
    expect(generateUntitledName([], 'Note', pending)).toBe('Untitled note 2')
  })

  it('avoids both existing and pending names', () => {
    const entries = [makeEntry({ title: 'Untitled note' })]
    const pending = new Set(['Untitled note 2'])
    expect(generateUntitledName(entries, 'Note', pending)).toBe('Untitled note 3')
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
    expect(content).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n\n# My Note\n\n')
  })

  it('omits status when null', () => {
    const content = buildNoteContent('AI', 'Topic', null)
    expect(content).toBe('---\ntitle: AI\ntype: Topic\n---\n\n# AI\n\n')
  })
})

describe('resolveNewNote', () => {
  it('uses TYPE_FOLDER_MAP for known types', () => {
    const { entry, content } = resolveNewNote('My Project', 'Project')
    expect(entry.path).toBe('/Users/luca/Laputa/project/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBe('Active')
    expect(content).toContain('type: Project')
    expect(content).toContain('status: Active')
  })

  it('falls back to slugified type for custom types', () => {
    const { entry } = resolveNewNote('First Recipe', 'Recipe')
    expect(entry.path).toBe('/Users/luca/Laputa/recipe/first-recipe.md')
  })

  it('omits status for Topic type', () => {
    const { entry, content } = resolveNewNote('Machine Learning', 'Topic')
    expect(entry.status).toBeNull()
    expect(content).not.toContain('status:')
  })

  it('omits status for Person type', () => {
    const { entry } = resolveNewNote('John Doe', 'Person')
    expect(entry.status).toBeNull()
  })
})

describe('resolveNewType', () => {
  it('creates a type entry in the type folder', () => {
    const { entry, content } = resolveNewType('Recipe')
    expect(entry.path).toBe('/Users/luca/Laputa/type/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(entry.status).toBeNull()
    expect(content).toContain('type: Type')
    expect(content).toContain('# Recipe')
  })
})

describe('frontmatterToEntryPatch', () => {
  it.each([
    ['type', 'Project', { isA: 'Project' }],
    ['is_a', 'Project', { isA: 'Project' }],
    ['status', 'Done', { status: 'Done' }],
    ['color', 'red', { color: 'red' }],
    ['icon', 'star', { icon: 'star' }],
    ['owner', 'Luca', { owner: 'Luca' }],
    ['cadence', 'Weekly', { cadence: 'Weekly' }],
    ['archived', true, { archived: true }],
    ['trashed', true, { trashed: true }],
    ['order', 5, { order: 5 }],
  ] as [string, unknown, Partial<VaultEntry>][])(
    'maps %s update to correct entry field',
    (key, value, expected) => {
      expect(frontmatterToEntryPatch('update', key, value as never)).toEqual(expected)
    },
  )

  it('maps aliases update with array value', () => {
    expect(frontmatterToEntryPatch('update', 'aliases', ['A', 'B'])).toEqual({ aliases: ['A', 'B'] })
  })

  it('maps belongs_to update with array value', () => {
    expect(frontmatterToEntryPatch('update', 'belongs_to', ['[[parent]]'])).toEqual({ belongsTo: ['[[parent]]'] })
  })

  it('handles case-insensitive keys with spaces (e.g. "Is A", "Belongs to")', () => {
    expect(frontmatterToEntryPatch('update', 'Is A', 'Experiment')).toEqual({ isA: 'Experiment' })
    expect(frontmatterToEntryPatch('update', 'Belongs to', ['[[x]]'])).toEqual({ belongsTo: ['[[x]]'] })
  })

  it('returns empty object for unknown keys', () => {
    expect(frontmatterToEntryPatch('update', 'custom_field', 'value')).toEqual({})
  })

  it.each([
    ['status', { status: null }],
    ['color', { color: null }],
    ['aliases', { aliases: [] }],
    ['archived', { archived: false }],
    ['order', { order: null }],
  ] as [string, Partial<VaultEntry>][])(
    'maps delete of %s to null/default',
    (key, expected) => {
      expect(frontmatterToEntryPatch('delete', key)).toEqual(expected)
    },
  )

  it('returns empty object for unknown key on delete', () => {
    expect(frontmatterToEntryPatch('delete', 'unknown_key')).toEqual({})
  })
})

describe('useNoteActions hook', () => {
  const addEntry = vi.fn()
  const removeEntry = vi.fn()
  const updateContent = vi.fn()
  const updateEntry = vi.fn()
  const setToastMessage = vi.fn()

  const makeConfig = (entries: VaultEntry[] = []): NoteActionsConfig => ({
    addEntry, removeEntry, updateContent, entries, setToastMessage, updateEntry,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
  })

  it('handleCreateNote calls addEntry and creates correct entry', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

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

  it('handleCreateType creates type entry', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

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

    const { result } = renderHook(() => useNoteActions(makeConfig([target])))

    await act(async () => {
      result.current.handleNavigateWikilink('Target Note')
    })

    expect(result.current.activeTabPath).toBe('/vault/note/target.md')
  })

  it('handleNavigateWikilink warns when target not found', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleNavigateWikilink('Nonexistent')
    })

    expect(warnSpy).toHaveBeenCalledWith('Navigation target not found: Nonexistent')
    warnSpy.mockRestore()
  })

  it('handleUpdateFrontmatter calls updateEntry with mapped patch', async () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'status', 'Done')
    })

    expect(updateContent).toHaveBeenCalled()
    expect(updateEntry).toHaveBeenCalledWith('/vault/note.md', { status: 'Done' })
    expect(setToastMessage).toHaveBeenCalledWith('Property updated')
  })

  it('handleUpdateFrontmatter syncs is_a and color changes to entries', async () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'is_a', 'Project')
    })
    expect(updateEntry).toHaveBeenCalledWith('/vault/note.md', { isA: 'Project' })

    vi.clearAllMocks()
    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'color', 'blue')
    })
    expect(updateEntry).toHaveBeenCalledWith('/vault/note.md', { color: 'blue' })
  })

  it('handleDeleteProperty calls updateEntry with null/default values', async () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    await act(async () => {
      await result.current.handleDeleteProperty('/vault/note.md', 'status')
    })

    expect(updateContent).toHaveBeenCalled()
    expect(updateEntry).toHaveBeenCalledWith('/vault/note.md', { status: null })
    expect(setToastMessage).toHaveBeenCalledWith('Property deleted')
  })

  it('handleCreateNoteImmediate creates note with auto-generated title', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate()
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Untitled note')
    expect(createdEntry.isA).toBe('Note')
  })

  it('handleCreateNoteImmediate generates unique names on rapid calls', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
    })

    expect(addEntry).toHaveBeenCalledTimes(3)
    const titles = addEntry.mock.calls.map(([e]: [VaultEntry]) => e.title)
    expect(titles[0]).toBe('Untitled note')
    expect(titles[1]).toBe('Untitled note 2')
    expect(titles[2]).toBe('Untitled note 3')
  })

  it('handleCreateNoteImmediate accepts custom type', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate('Project')
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Untitled project')
    expect(createdEntry.isA).toBe('Project')
  })

  it('handleUpdateFrontmatter does not call updateEntry for unknown keys', async () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'custom_field', 'value')
    })

    expect(updateEntry).not.toHaveBeenCalled()
    expect(setToastMessage).toHaveBeenCalledWith('Property updated')
  })

  describe('optimistic error recovery (Tauri mode)', () => {
    beforeEach(() => {
      vi.mocked(isTauri).mockReturnValue(true)
    })

    it.each([
      ['handleCreateNote', 'Failing Note', 'Note', 'note/failing-note.md'],
      ['handleCreateType', 'Recipe', 'Type', 'type/recipe.md'],
    ])('reverts optimistic creation via %s when disk write fails', async (method, title, type, pathFragment) => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
      const { result } = renderHook(() => useNoteActions(makeConfig()))

      await act(async () => {
        if (method === 'handleCreateNote') result.current.handleCreateNote(title, type)
        else result.current.handleCreateType(title)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(addEntry).toHaveBeenCalledTimes(1)
      expect(removeEntry).toHaveBeenCalledWith(expect.stringContaining(pathFragment))
      expect(setToastMessage).toHaveBeenCalledWith('Failed to create note — disk write error')
    })

    it('does not revert when disk write succeeds', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined)
      const { result } = renderHook(() => useNoteActions(makeConfig()))

      await act(async () => {
        result.current.handleCreateNote('Good Note', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(removeEntry).not.toHaveBeenCalled()
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('handles rapid creation with one failure independently', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('disk full'))
        .mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useNoteActions(makeConfig()))

      await act(async () => {
        result.current.handleCreateNoteImmediate()
        result.current.handleCreateNoteImmediate()
        result.current.handleCreateNoteImmediate()
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(addEntry).toHaveBeenCalledTimes(3)
      expect(removeEntry).toHaveBeenCalledTimes(1)
      expect(removeEntry).toHaveBeenCalledWith(expect.stringContaining('untitled-note-2.md'))
    })
  })
})
