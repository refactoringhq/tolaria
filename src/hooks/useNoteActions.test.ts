import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
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
  todayDateString,
  buildDailyNoteContent,
  resolveDailyNote,
  findDailyNote,
  useNoteActions,
  DEFAULT_TEMPLATES,
  resolveTemplate,
} from './useNoteActions'
import type { NoteActionsConfig } from './useNoteActions'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
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
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  template: null, sort: null,
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

  it('handles empty string with fallback', () => {
    expect(slugify('')).toBe('untitled')
  })

  it('collapses multiple separators into one hyphen', () => {
    expect(slugify('hello   world---foo')).toBe('hello-world-foo')
  })

  it('returns fallback for strings with only special characters', () => {
    // slugify('+++') should not return empty string — it causes invalid paths
    expect(slugify('+++')).not.toBe('')
    expect(slugify('!!!')).not.toBe('')
    expect(slugify('---')).not.toBe('')
    expect(slugify('@#$')).not.toBe('')
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

  it('includes template body when provided', () => {
    const content = buildNoteContent('My Project', 'Project', 'Active', '## Objective\n\n## Notes\n\n')
    expect(content).toContain('# My Project')
    expect(content).toContain('## Objective')
    expect(content).toContain('## Notes')
  })

  it('ignores null template', () => {
    const content = buildNoteContent('My Note', 'Note', 'Active', null)
    expect(content).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n\n# My Note\n\n')
  })
})

describe('resolveTemplate', () => {
  it('returns template from type entry when set', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', template: '## Ingredients\n\n## Steps\n\n' })
    expect(resolveTemplate([typeEntry], 'Recipe')).toBe('## Ingredients\n\n## Steps\n\n')
  })

  it('falls back to DEFAULT_TEMPLATES for built-in types', () => {
    expect(resolveTemplate([], 'Project')).toBe(DEFAULT_TEMPLATES.Project)
  })

  it('returns null when no template and no default', () => {
    expect(resolveTemplate([], 'CustomType')).toBeNull()
  })

  it('type entry template overrides default', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Project', template: '## Custom\n\n' })
    expect(resolveTemplate([typeEntry], 'Project')).toBe('## Custom\n\n')
  })
})

describe('DEFAULT_TEMPLATES', () => {
  it('has templates for Project, Person, Responsibility, Experiment', () => {
    expect(DEFAULT_TEMPLATES.Project).toBeDefined()
    expect(DEFAULT_TEMPLATES.Person).toBeDefined()
    expect(DEFAULT_TEMPLATES.Responsibility).toBeDefined()
    expect(DEFAULT_TEMPLATES.Experiment).toBeDefined()
  })
})

describe('resolveNewNote', () => {
  it('uses TYPE_FOLDER_MAP for known types', () => {
    const { entry, content } = resolveNewNote('My Project', 'Project', '/my/vault')
    expect(entry.path).toBe('/my/vault/project/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBe('Active')
    expect(content).toContain('type: Project')
    expect(content).toContain('status: Active')
  })

  it('falls back to slugified type for custom types', () => {
    const { entry } = resolveNewNote('First Recipe', 'Recipe', '/my/vault')
    expect(entry.path).toBe('/my/vault/recipe/first-recipe.md')
  })

  it('omits status for Topic type', () => {
    const { entry, content } = resolveNewNote('Machine Learning', 'Topic', '/my/vault')
    expect(entry.status).toBeNull()
    expect(content).not.toContain('status:')
  })

  it('omits status for Person type', () => {
    const { entry } = resolveNewNote('John Doe', 'Person', '/my/vault')
    expect(entry.status).toBeNull()
  })

  it('uses provided vault path instead of hardcoded path', () => {
    const { entry } = resolveNewNote('Test', 'Note', '/other/vault')
    expect(entry.path).toBe('/other/vault/note/test.md')
    expect(entry.path).not.toContain('/Users/luca/Laputa')
  })

  it('produces a valid path for custom types with special characters', () => {
    const { entry } = resolveNewNote('My Note', 'Q&A', '/vault')
    expect(entry.path).not.toContain('//')
    expect(entry.path).toMatch(/\.md$/)
    expect(entry.filename).not.toBe('.md')
  })

  it('produces a valid path when type is all special characters', () => {
    const { entry } = resolveNewNote('My Note', '+++', '/vault')
    // folder should not be empty, path should not have double slashes
    expect(entry.path).not.toContain('//')
    expect(entry.path).toMatch(/\.md$/)
  })
})

describe('resolveNewType', () => {
  it('creates a type entry in the type folder', () => {
    const { entry, content } = resolveNewType('Recipe', '/my/vault')
    expect(entry.path).toBe('/my/vault/type/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(entry.status).toBeNull()
    expect(content).toContain('type: Type')
    expect(content).toContain('# Recipe')
  })

  it('uses provided vault path instead of hardcoded path', () => {
    const { entry } = resolveNewType('Responsibility', '/other/vault')
    expect(entry.path).toBe('/other/vault/type/responsibility.md')
    expect(entry.path).not.toContain('/Users/luca/Laputa')
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
    ['template', '## Heading\n\n', { template: '## Heading\n\n' }],
    ['visible', false, { visible: false }],
    ['visible', true, { visible: null }],
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
    ['template', { template: null }],
    ['visible', { visible: null }],
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

describe('todayDateString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = todayDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('buildDailyNoteContent', () => {
  it('generates frontmatter with Journal type and date', () => {
    const content = buildDailyNoteContent('2026-03-02')
    expect(content).toContain('type: Journal')
    expect(content).toContain('date: 2026-03-02')
    expect(content).toContain('title: 2026-03-02')
  })

  it('includes Intentions and Reflections sections', () => {
    const content = buildDailyNoteContent('2026-03-02')
    expect(content).toContain('## Intentions')
    expect(content).toContain('## Reflections')
  })

  it('includes H1 heading with the date', () => {
    const content = buildDailyNoteContent('2026-03-02')
    expect(content).toContain('# 2026-03-02')
  })
})

describe('resolveDailyNote', () => {
  it('creates entry in journal folder with date as filename', () => {
    const { entry } = resolveDailyNote('2026-03-02', '/my/vault')
    expect(entry.path).toBe('/my/vault/journal/2026-03-02.md')
    expect(entry.filename).toBe('2026-03-02.md')
    expect(entry.title).toBe('2026-03-02')
    expect(entry.isA).toBe('Journal')
    expect(entry.status).toBeNull()
  })

  it('returns content with daily note template', () => {
    const { content } = resolveDailyNote('2026-03-02', '/my/vault')
    expect(content).toContain('type: Journal')
    expect(content).toContain('## Intentions')
  })

  it('uses provided vault path instead of hardcoded path', () => {
    const { entry } = resolveDailyNote('2026-03-02', '/other/vault')
    expect(entry.path).toBe('/other/vault/journal/2026-03-02.md')
    expect(entry.path).not.toContain('/Users/luca/Laputa')
  })
})

describe('findDailyNote', () => {
  it('finds entry by journal path suffix', () => {
    const entries = [
      makeEntry({ path: '/Users/luca/Laputa/journal/2026-03-02.md' }),
      makeEntry({ path: '/Users/luca/Laputa/note/other.md' }),
    ]
    const found = findDailyNote(entries, '2026-03-02')
    expect(found).toBeDefined()
    expect(found!.path).toBe('/Users/luca/Laputa/journal/2026-03-02.md')
  })

  it('returns undefined when no matching entry exists', () => {
    const entries = [makeEntry({ path: '/Users/luca/Laputa/note/other.md' })]
    expect(findDailyNote(entries, '2026-03-02')).toBeUndefined()
  })

  it('works with different vault paths', () => {
    const entries = [
      makeEntry({ path: '/other/vault/journal/2026-03-02.md' }),
    ]
    const found = findDailyNote(entries, '2026-03-02')
    expect(found).toBeDefined()
  })
})

describe('useNoteActions hook', () => {
  const addEntry = vi.fn()
  const removeEntry = vi.fn()
  const updateEntry = vi.fn()
  const setToastMessage = vi.fn()

  const makeConfig = (entries: VaultEntry[] = []): NoteActionsConfig => ({
    addEntry, removeEntry, entries, setToastMessage, updateEntry, vaultPath: '/test/vault',
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
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Test Note')
    expect(createdEntry.isA).toBe('Note')
    expect(createdEntry.path).toContain('note/test-note.md')
  })

  it('handleCreateNote opens tab immediately (before addEntry resolves)', () => {
    const callOrder: string[] = []
    const trackedAddEntry = vi.fn(() => { callOrder.push('addEntry') })
    const config = makeConfig()
    config.addEntry = trackedAddEntry

    const { result } = renderHook(() => useNoteActions(config))

    act(() => {
      result.current.handleCreateNote('Fast Note', 'Note')
    })

    // Tab should be open with the new note
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.tabs[0].entry.title).toBe('Fast Note')
    expect(result.current.activeTabPath).toContain('note/fast-note.md')
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

  it('handleCreateNote uses default template for Project type', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNote('My Project', 'Project')
    })

    const tabContent = result.current.tabs[0].content
    expect(tabContent).toContain('## Objective')
    expect(tabContent).toContain('## Key Results')
  })

  it('handleCreateNote uses custom template from type entry', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', template: '## Ingredients\n\n## Steps\n\n' })
    const { result } = renderHook(() => useNoteActions(makeConfig([typeEntry])))

    act(() => {
      result.current.handleCreateNote('Pasta', 'Recipe')
    })

    const tabContent = result.current.tabs[0].content
    expect(tabContent).toContain('## Ingredients')
    expect(tabContent).toContain('## Steps')
  })

  it('handleCreateNoteImmediate does not throw for custom types with special characters', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    expect(() => {
      act(() => {
        result.current.handleCreateNoteImmediate('Q&A')
      })
    }).not.toThrow()

    const [entry] = addEntry.mock.calls[0]
    expect(entry.isA).toBe('Q&A')
    expect(entry.path).not.toContain('//')
  })

  it('handleCreateNoteImmediate does not throw for types that slugify to empty string', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    expect(() => {
      act(() => {
        result.current.handleCreateNoteImmediate('+++')
      })
    }).not.toThrow()

    const [entry] = addEntry.mock.calls[0]
    expect(entry.path).not.toContain('//')
    expect(entry.filename).not.toBe('.md')
  })

  it('handleCreateNoteImmediate uses template for typed notes', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Project', template: '## Custom Template\n\n' })
    const { result } = renderHook(() => useNoteActions(makeConfig([typeEntry])))

    act(() => {
      result.current.handleCreateNoteImmediate('Project')
    })

    const tabContent = result.current.tabs[0].content
    expect(tabContent).toContain('## Custom Template')
  })

  it('handleUpdateFrontmatter does not call updateEntry for unknown keys', async () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/note.md', 'custom_field', 'value')
    })

    expect(updateEntry).not.toHaveBeenCalled()
    expect(setToastMessage).toHaveBeenCalledWith('Property updated')
  })

  it('handleOpenDailyNote creates a new daily note when none exists', () => {
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleOpenDailyNote()
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.isA).toBe('Journal')
    expect(createdEntry.path).toContain('journal/')
    expect(createdEntry.path).toMatch(/journal\/\d{4}-\d{2}-\d{2}\.md$/)
  })

  it('handleOpenDailyNote opens existing daily note instead of creating', async () => {
    const today = todayDateString()
    const existing = makeEntry({ path: `/Users/luca/Laputa/journal/${today}.md`, title: today })
    const { result } = renderHook(() => useNoteActions(makeConfig([existing])))

    await act(async () => {
      result.current.handleOpenDailyNote()
      await new Promise((r) => setTimeout(r, 0))
    })

    // Should open existing note, not create a new one
    expect(addEntry).not.toHaveBeenCalled()
    expect(result.current.activeTabPath).toBe(`/Users/luca/Laputa/journal/${today}.md`)
  })

  describe('pending save lifecycle', () => {
    it('createAndPersist calls addPendingSave on start (non-Tauri)', async () => {
      const addPendingSave = vi.fn()
      const removePendingSave = vi.fn()
      const config = makeConfig()
      config.addPendingSave = addPendingSave
      config.removePendingSave = removePendingSave

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNote('Pending Test', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(addPendingSave).toHaveBeenCalledWith(expect.stringContaining('note/pending-test.md'))
    })

    it('createAndPersist calls removePendingSave when persist completes (non-Tauri)', async () => {
      const addPendingSave = vi.fn()
      const removePendingSave = vi.fn()
      const config = makeConfig()
      config.addPendingSave = addPendingSave
      config.removePendingSave = removePendingSave

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNote('Persist OK', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(removePendingSave).toHaveBeenCalledWith(expect.stringContaining('note/persist-ok.md'))
    })

    it('createAndPersist calls removePendingSave AND reverts when persist fails (Tauri)', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
      const addPendingSave = vi.fn()
      const removePendingSave = vi.fn()
      const config = makeConfig()
      config.addPendingSave = addPendingSave
      config.removePendingSave = removePendingSave

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNote('Fail Save', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(addPendingSave).toHaveBeenCalledWith(expect.stringContaining('note/fail-save.md'))
      expect(removePendingSave).toHaveBeenCalledWith(expect.stringContaining('note/fail-save.md'))
      expect(removeEntry).toHaveBeenCalledWith(expect.stringContaining('note/fail-save.md'))
      expect(setToastMessage).toHaveBeenCalledWith('Failed to create note — disk write error')
    })

    it('handleCreateNoteImmediate calls trackUnsaved and markContentPending (no disk write)', async () => {
      const trackUnsaved = vi.fn()
      const markContentPending = vi.fn()
      const config = makeConfig()
      config.trackUnsaved = trackUnsaved
      config.markContentPending = markContentPending

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNoteImmediate()
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(trackUnsaved).toHaveBeenCalledWith(expect.stringContaining('note/untitled-note.md'))
      expect(markContentPending).toHaveBeenCalledWith(expect.stringContaining('note/untitled-note.md'), expect.stringContaining('Untitled note'))
    })

    it('calls onNewNotePersisted after successful disk write (non-Tauri)', async () => {
      const onNewNotePersisted = vi.fn()
      const config = makeConfig()
      config.onNewNotePersisted = onNewNotePersisted

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNote('Persist Callback', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(onNewNotePersisted).toHaveBeenCalledTimes(1)
    })

    it('does not call onNewNotePersisted when disk write fails (Tauri)', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
      const onNewNotePersisted = vi.fn()
      const config = makeConfig()
      config.onNewNotePersisted = onNewNotePersisted

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        result.current.handleCreateNote('Fail Persist', 'Note')
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(onNewNotePersisted).not.toHaveBeenCalled()
    })
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

    it('handleCreateNoteImmediate does not call invoke (no disk write)', async () => {
      const { result } = renderHook(() => useNoteActions(makeConfig()))

      await act(async () => {
        result.current.handleCreateNoteImmediate()
        result.current.handleCreateNoteImmediate()
        result.current.handleCreateNoteImmediate()
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(addEntry).toHaveBeenCalledTimes(3)
      // No disk writes for immediate creation — notes are unsaved/in-memory
      expect(invoke).not.toHaveBeenCalled()
      expect(removeEntry).not.toHaveBeenCalled()
    })

    it('closing unsaved tab removes entry', () => {
      const clearUnsaved = vi.fn()
      const unsavedPaths = new Set<string>()
      const config = makeConfig()
      config.clearUnsaved = clearUnsaved
      config.unsavedPaths = unsavedPaths

      const { result } = renderHook(() => useNoteActions(config))

      act(() => {
        result.current.handleCreateNoteImmediate()
      })

      const createdPath = addEntry.mock.calls[0][0].path
      unsavedPaths.add(createdPath) // simulate trackUnsaved
      config.unsavedPaths = unsavedPaths // update ref

      act(() => {
        result.current.handleCloseTab(createdPath)
      })

      expect(removeEntry).toHaveBeenCalledWith(createdPath)
      expect(clearUnsaved).toHaveBeenCalledWith(createdPath)
    })
  })

  describe('move note to type folder on type change', () => {
    it('calls move_note_to_type_folder when type key is updated', async () => {
      const entry = makeEntry({ path: '/test/vault/note/my-note.md', filename: 'my-note.md', title: 'My Note', isA: 'Note' })
      const replaceEntry = vi.fn()
      const config = makeConfig([entry])
      config.replaceEntry = replaceEntry

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'move_note_to_type_folder') return { new_path: '/test/vault/quarter/my-note.md', updated_links: 0, moved: true }
        if (cmd === 'get_note_content') return '---\ntype: Quarter\n---\n# My Note\n'
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/note/my-note.md', 'type', 'Quarter')
      })

      expect(mockInvoke).toHaveBeenCalledWith('move_note_to_type_folder', expect.objectContaining({
        vault_path: '/test/vault',
        note_path: '/test/vault/note/my-note.md',
        new_type: 'Quarter',
      }))
      expect(replaceEntry).toHaveBeenCalledWith(
        '/test/vault/note/my-note.md',
        expect.objectContaining({ path: '/test/vault/quarter/my-note.md' }),
      )
      expect(setToastMessage).toHaveBeenCalledWith('Note moved to quarter/')
    })

    it('does not call move when type key is not being changed', async () => {
      const config = makeConfig()
      vi.mocked(mockInvoke).mockResolvedValue('')

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/vault/note.md', 'status', 'Done')
      })

      expect(mockInvoke).not.toHaveBeenCalledWith('move_note_to_type_folder', expect.anything())
    })

    it('does not move when result.moved is false (already in correct folder)', async () => {
      const entry = makeEntry({ path: '/test/vault/quarter/my-note.md', filename: 'my-note.md', isA: 'Quarter' })
      const replaceEntry = vi.fn()
      const config = makeConfig([entry])
      config.replaceEntry = replaceEntry

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'move_note_to_type_folder') return { new_path: '/test/vault/quarter/my-note.md', updated_links: 0, moved: false }
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/quarter/my-note.md', 'type', 'Quarter')
      })

      expect(replaceEntry).not.toHaveBeenCalled()
      // Should still show 'Property updated' toast (not move toast)
      expect(setToastMessage).toHaveBeenCalledWith('Property updated')
    })

    it('handles Is A key (case-insensitive)', async () => {
      const entry = makeEntry({ path: '/test/vault/note/my-note.md' })
      const config = makeConfig([entry])
      config.replaceEntry = vi.fn()

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'move_note_to_type_folder') return { new_path: '/test/vault/project/my-note.md', updated_links: 0, moved: true }
        if (cmd === 'get_note_content') return '---\nIs A: Project\n---\n# My Note\n'
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/note/my-note.md', 'Is A', 'Project')
      })

      expect(mockInvoke).toHaveBeenCalledWith('move_note_to_type_folder', expect.objectContaining({
        new_type: 'Project',
      }))
    })

    it('preserves note content after type change — never loads another note (regression)', async () => {
      // The mock updateMockFrontmatter returns '---\nupdated: true\n---\n' —
      // this represents the note's own content after the frontmatter update.
      const frontmatterUpdatedContent = '---\nupdated: true\n---\n'
      const wrongContent = '---\ntype: Project\n---\n# Feedback for Laputa\n\nCompletely different note.\n'

      const entry = makeEntry({ path: '/test/vault/note/migrate-newsletter.md', filename: 'migrate-newsletter.md', title: 'Migrate newsletter to Beehiiv', isA: 'Note' })
      const replaceEntry = vi.fn()
      const config = makeConfig([entry])
      config.replaceEntry = replaceEntry

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'move_note_to_type_folder') return { new_path: '/test/vault/project/migrate-newsletter.md', updated_links: 0, moved: true }
        // Simulate the bug: get_note_content returns a DIFFERENT note's content
        // (e.g. path collision, stale cache, or filesystem race)
        if (cmd === 'get_note_content') return wrongContent
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      // Open the tab first so we have a tab to check
      act(() => { result.current.openTabWithContent(entry, '---\ntype: Note\n---\n# Migrate\n') })

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/note/migrate-newsletter.md', 'type', 'Project')
      })

      // The tab content must be the note's OWN content (from the frontmatter update),
      // NEVER the content of a different note loaded via get_note_content.
      const tab = result.current.tabs.find(t => t.entry.path === '/test/vault/project/migrate-newsletter.md')
      expect(tab).toBeDefined()
      expect(tab!.content).toBe(frontmatterUpdatedContent)
      expect(tab!.content).not.toBe(wrongContent)
    })

    it('does not move when value is empty or null-like', async () => {
      const config = makeConfig()
      vi.mocked(mockInvoke).mockResolvedValue('')

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/vault/note.md', 'type', '')
      })

      expect(mockInvoke).not.toHaveBeenCalledWith('move_note_to_type_folder', expect.anything())
    })
  })
})
