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
  todayDateString,
  buildDailyNoteContent,
  resolveDailyNote,
  findDailyNote,
  DEFAULT_TEMPLATES,
  resolveTemplate,
} from './useNoteCreation'
import { needsRenameOnSave } from './useNoteRename'
import { frontmatterToEntryPatch, applyRelationshipPatch, contentToEntryPatch } from './frontmatterOps'
import { useNoteActions } from './useNoteActions'
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
  path: '/Users/luca/Laputa/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  archived: false,
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
  template: null, sort: null, sidebarLabel: null,
  view: null, visible: null, properties: {}, organized: false,
  favorite: false, favoriteIndex: null, listPropertiesDisplay: [],
  hasH1: false,
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

describe('needsRenameOnSave', () => {
  it('returns true when filename does not match title slug', () => {
    expect(needsRenameOnSave('My New Note', 'untitled-note.md')).toBe(true)
    expect(needsRenameOnSave('Run good ads for newsletter', 'untitled-note-9.md')).toBe(true)
  })

  it('returns false when filename matches title slug', () => {
    expect(needsRenameOnSave('My Note', 'my-note.md')).toBe(false)
    expect(needsRenameOnSave('Hello World', 'hello-world.md')).toBe(false)
  })

  it('returns false for untitled note with matching slug', () => {
    expect(needsRenameOnSave('Untitled note', 'untitled-note.md')).toBe(false)
  })
})

describe('buildNewEntry', () => {
  it('creates a VaultEntry with correct fields', () => {
    const entry = buildNewEntry({
      path: '/vault/my-note.md',
      slug: 'my-note',
      title: 'My Note',
      type: 'Note',
      status: 'Active',
    })

    expect(entry.path).toBe('/vault/my-note.md')
    expect(entry.filename).toBe('my-note.md')
    expect(entry.title).toBe('My Note')
    expect(entry.isA).toBe('Note')
    expect(entry.status).toBe('Active')
    expect(entry.archived).toBe(false)
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
    expect(entryMatchesTarget(entry, 'my project')).toBe(true)
  })

  it('matches by alias', () => {
    const entry = makeEntry({ aliases: ['MP', 'TheProject'] })
    expect(entryMatchesTarget(entry, 'mp')).toBe(true)
  })

  it('matches legacy path-style target via filename stem', () => {
    const entry = makeEntry({ filename: 'my-project.md' })
    expect(entryMatchesTarget(entry, 'project/my-project')).toBe(true)
  })

  it('matches by filename stem', () => {
    const entry = makeEntry({ filename: 'my-project.md' })
    expect(entryMatchesTarget(entry, 'my-project')).toBe(true)
  })

  it('matches when target as words matches title', () => {
    const entry = makeEntry({ title: 'my project' })
    expect(entryMatchesTarget(entry, 'my-project')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    const entry = makeEntry({ title: 'Something Else', aliases: [], filename: 'else.md' })
    expect(entryMatchesTarget(entry, 'nonexistent')).toBe(false)
  })

  it('handles pipe syntax targets', () => {
    const entry = makeEntry({ path: '/vault/project/alpha.md', filename: 'alpha.md', title: 'Alpha' })
    expect(entryMatchesTarget(entry, 'project/alpha|Alpha Project')).toBe(true)
  })
})

describe('buildNoteContent', () => {
  it('generates frontmatter with title and status for regular types', () => {
    const content = buildNoteContent('My Note', 'Note', 'Active')
    expect(content).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n')
  })

  it('omits title when null', () => {
    const content = buildNoteContent(null, 'Note', 'Active')
    expect(content).toBe('---\ntype: Note\nstatus: Active\n---\n')
  })

  it('omits status when null', () => {
    const content = buildNoteContent('AI', 'Topic', null)
    expect(content).toBe('---\ntitle: AI\ntype: Topic\n---\n')
  })

  it('includes template body when provided', () => {
    const content = buildNoteContent('My Project', 'Project', 'Active', '## Objective\n\n## Notes\n\n')
    expect(content).not.toContain('# My Project')
    expect(content).toContain('## Objective')
    expect(content).toContain('## Notes')
  })

  it('ignores null template', () => {
    const content = buildNoteContent('My Note', 'Note', 'Active', null)
    expect(content).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n')
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
  it('creates note at vault root', () => {
    const { entry, content } = resolveNewNote('My Project', 'Project', '/my/vault')
    expect(entry.path).toBe('/my/vault/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBe('Active')
    expect(content).toContain('type: Project')
    expect(content).toContain('status: Active')
  })

  it('creates custom type note at vault root', () => {
    const { entry } = resolveNewNote('First Recipe', 'Recipe', '/my/vault')
    expect(entry.path).toBe('/my/vault/first-recipe.md')
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

  it('uses provided vault path', () => {
    const { entry } = resolveNewNote('Test', 'Note', '/other/vault')
    expect(entry.path).toBe('/other/vault/test.md')
  })

  it('produces a valid path for custom types with special characters', () => {
    const { entry } = resolveNewNote('My Note', 'Q&A', '/vault')
    expect(entry.path).not.toContain('//')
    expect(entry.path).toMatch(/\.md$/)
    expect(entry.filename).not.toBe('.md')
  })

  it('produces a valid path when type is all special characters', () => {
    const { entry } = resolveNewNote('My Note', '+++', '/vault')
    expect(entry.path).not.toContain('//')
    expect(entry.path).toMatch(/\.md$/)
  })
})

describe('resolveNewType', () => {
  it('creates a type entry at vault root', () => {
    const { entry, content } = resolveNewType('Recipe', '/my/vault')
    expect(entry.path).toBe('/my/vault/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(entry.status).toBeNull()
    expect(content).toContain('type: Type')
    expect(content).not.toContain('# Recipe')
  })

  it('uses provided vault path instead of hardcoded path', () => {
    const { entry } = resolveNewType('Responsibility', '/other/vault')
    expect(entry.path).toBe('/other/vault/responsibility.md')
    expect(entry.path).not.toContain('/Users/luca/Laputa')
  })
})

describe('frontmatterToEntryPatch', () => {
  it.each([
    ['title', 'My Note', { title: 'My Note' }],
    ['type', 'Project', { isA: 'Project' }],
    ['is_a', 'Project', { isA: 'Project' }],
    ['status', 'Done', { status: 'Done' }],
    ['color', 'red', { color: 'red' }],
    ['icon', 'star', { icon: 'star' }],
    ['sidebar_label', 'Projects', { sidebarLabel: 'Projects' }],
    ['archived', true, { archived: true }],
    ['order', 5, { order: 5 }],
    ['template', '## Heading\n\n', { template: '## Heading\n\n' }],
    ['visible', false, { visible: false }],
    ['visible', true, { visible: null }],
  ] as [string, unknown, Partial<VaultEntry>][])(
    'maps %s update to correct entry field',
    (key, value, expected) => {
      expect(frontmatterToEntryPatch('update', key, value as never).patch).toEqual(expected)
    },
  )

  it('maps aliases update with array value', () => {
    expect(frontmatterToEntryPatch('update', 'aliases', ['A', 'B']).patch).toEqual({ aliases: ['A', 'B'] })
  })

  it('maps belongs_to update with array value', () => {
    const result = frontmatterToEntryPatch('update', 'belongs_to', ['[[parent]]'])
    expect(result.patch).toEqual({ belongsTo: ['[[parent]]'] })
    // Also produces a relationship patch for the wikilink
    expect(result.relationshipPatch).toEqual({ 'belongs_to': ['[[parent]]'] })
  })

  it('handles case-insensitive keys with spaces (e.g. "Is A", "Belongs to")', () => {
    expect(frontmatterToEntryPatch('update', 'Is A', 'Experiment').patch).toEqual({ isA: 'Experiment' })
    const result = frontmatterToEntryPatch('update', 'Belongs to', ['[[x]]'])
    expect(result.patch).toEqual({ belongsTo: ['[[x]]'] })
    expect(result.relationshipPatch).toEqual({ 'Belongs to': ['[[x]]'] })
  })

  it('returns propertiesPatch for unknown non-wikilink keys', () => {
    const result = frontmatterToEntryPatch('update', 'custom_field', 'value')
    expect(result.patch).toEqual({})
    expect(result.propertiesPatch).toEqual({ custom_field: 'value' })
    // Non-wikilink value → no relationship change
    expect(result.relationshipPatch).toBeNull()
  })

  it('produces relationship patch for wikilink values on unknown keys', () => {
    const result = frontmatterToEntryPatch('update', 'Notes', ['[[note-a]]', '[[note-b|Note B]]'])
    expect(result.patch).toEqual({})
    expect(result.relationshipPatch).toEqual({ Notes: ['[[note-a]]', '[[note-b|Note B]]'] })
  })

  it('produces relationship patch for single wikilink string', () => {
    const result = frontmatterToEntryPatch('update', 'Owner', '[[person/alice]]')
    expect(result.patch).toEqual({})
    expect(result.relationshipPatch).toEqual({ Owner: ['[[person/alice]]'] })
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
      expect(frontmatterToEntryPatch('delete', key).patch).toEqual(expected)
    },
  )

  it('maps _list_properties_display update to listPropertiesDisplay array', () => {
    const result = frontmatterToEntryPatch('update', '_list_properties_display', ['rating', 'genre'])
    expect(result.patch).toEqual({ listPropertiesDisplay: ['rating', 'genre'] })
  })

  it('maps _list_properties_display delete to empty array', () => {
    const result = frontmatterToEntryPatch('delete', '_list_properties_display')
    expect(result.patch).toEqual({ listPropertiesDisplay: [] })
  })

  it('returns empty patch for unknown key on delete, with relationship and properties removal', () => {
    const result = frontmatterToEntryPatch('delete', 'unknown_key')
    expect(result.patch).toEqual({})
    expect(result.relationshipPatch).toEqual({ unknown_key: null })
    expect(result.propertiesPatch).toEqual({ unknown_key: null })
  })

  it('delete of known key also produces relationship removal', () => {
    const result = frontmatterToEntryPatch('delete', 'status')
    expect(result.patch).toEqual({ status: null })
    expect(result.relationshipPatch).toEqual({ status: null })
  })
})

describe('applyRelationshipPatch', () => {
  it('adds new relationship key', () => {
    const existing = { 'Belongs to': ['[[eng]]'] }
    const result = applyRelationshipPatch(existing, { Notes: ['[[note-a]]', '[[note-b]]'] })
    expect(result).toEqual({ 'Belongs to': ['[[eng]]'], Notes: ['[[note-a]]', '[[note-b]]'] })
  })

  it('overwrites existing relationship key', () => {
    const existing = { Notes: ['[[old]]'] }
    const result = applyRelationshipPatch(existing, { Notes: ['[[new-a]]', '[[new-b]]'] })
    expect(result).toEqual({ Notes: ['[[new-a]]', '[[new-b]]'] })
  })

  it('removes relationship key when value is null', () => {
    const existing = { Notes: ['[[a]]'], Owner: ['[[alice]]'] }
    const result = applyRelationshipPatch(existing, { Notes: null })
    expect(result).toEqual({ Owner: ['[[alice]]'] })
  })

  it('does not mutate the original map', () => {
    const existing = { Notes: ['[[a]]'] }
    applyRelationshipPatch(existing, { Notes: ['[[b]]'] })
    expect(existing).toEqual({ Notes: ['[[a]]'] })
  })
})

describe('contentToEntryPatch', () => {
  it('extracts type from frontmatter', () => {
    const content = '---\ntype: Project\nstatus: Active\n---\nBody text'
    expect(contentToEntryPatch(content)).toEqual({ isA: 'Project', status: 'Active' })
  })

  it('returns empty patch when no frontmatter', () => {
    expect(contentToEntryPatch('Just a body')).toEqual({})
  })

  it('returns empty patch for empty content', () => {
    expect(contentToEntryPatch('')).toEqual({})
  })

  it('extracts color, icon, and aliases', () => {
    const content = '---\ncolor: red\nicon: star\naliases:\n  - Foo\n  - Bar\n---\n'
    expect(contentToEntryPatch(content)).toEqual({ color: 'red', icon: 'star', aliases: ['Foo', 'Bar'] })
  })

  it('handles is_a as alias for type', () => {
    const content = '---\nis_a: Essay\n---\n'
    expect(contentToEntryPatch(content)).toEqual({ isA: 'Essay' })
  })

  it('extracts title from frontmatter', () => {
    const content = '---\ntitle: My Title\ntype: Note\n---\nBody'
    expect(contentToEntryPatch(content)).toEqual({ title: 'My Title', isA: 'Note' })
  })

  it('extracts sidebar_label from frontmatter', () => {
    const content = '---\ntype: Type\nsidebar_label: Projects\n---\n'
    expect(contentToEntryPatch(content)).toEqual({ isA: 'Type', sidebarLabel: 'Projects' })
  })

  it('includes custom frontmatter keys in properties patch', () => {
    const content = '---\ntype: Note\ncustom: value\n---\n'
    expect(contentToEntryPatch(content)).toEqual({ isA: 'Note', properties: { custom: 'value' } })
  })

  it('preserves _favorite_index as a number (not null)', () => {
    const content = '---\n_favorite: true\n_favorite_index: 2\n---\nBody'
    const patch = contentToEntryPatch(content)
    expect(patch.favorite).toBe(true)
    expect(patch.favoriteIndex).toBe(2)
  })

  it('preserves _favorite_index: 0 as number 0', () => {
    const content = '---\n_favorite: true\n_favorite_index: 0\n---\nBody'
    const patch = contentToEntryPatch(content)
    expect(patch.favoriteIndex).toBe(0)
  })

  it('preserves order as a number', () => {
    const content = '---\ntype: Type\norder: 3\n---\n'
    expect(contentToEntryPatch(content)).toEqual({ isA: 'Type', order: 3 })
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

  it('does not include H1 heading with the date', () => {
    const content = buildDailyNoteContent('2026-03-02')
    expect(content).not.toMatch(/^# /m)
  })
})

describe('resolveDailyNote', () => {
  it('creates entry at vault root with date as filename', () => {
    const { entry } = resolveDailyNote('2026-03-02', '/my/vault')
    expect(entry.path).toBe('/my/vault/2026-03-02.md')
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

  it('uses provided vault path', () => {
    const { entry } = resolveDailyNote('2026-03-02', '/other/vault')
    expect(entry.path).toBe('/other/vault/2026-03-02.md')
  })
})

describe('findDailyNote', () => {
  it('finds entry by filename and Journal type', () => {
    const entries = [
      makeEntry({ path: '/Users/luca/Laputa/2026-03-02.md', filename: '2026-03-02.md', isA: 'Journal' }),
      makeEntry({ path: '/Users/luca/Laputa/other.md' }),
    ]
    const found = findDailyNote(entries, '2026-03-02')
    expect(found).toBeDefined()
    expect(found!.path).toBe('/Users/luca/Laputa/2026-03-02.md')
  })

  it('returns undefined when no matching entry exists', () => {
    const entries = [makeEntry({ path: '/Users/luca/Laputa/other.md' })]
    expect(findDailyNote(entries, '2026-03-02')).toBeUndefined()
  })

  it('does not match non-Journal notes with date filename', () => {
    const entries = [
      makeEntry({ path: '/vault/2026-03-02.md', filename: '2026-03-02.md', isA: 'Note' }),
    ]
    expect(findDailyNote(entries, '2026-03-02')).toBeUndefined()
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
    expect(createdEntry.path).toContain('test-note.md')
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
    expect(result.current.activeTabPath).toContain('fast-note.md')
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
    const target = makeEntry({ title: 'Target Note', path: '/vault/target.md' })

    const { result } = renderHook(() => useNoteActions(makeConfig([target])))

    await act(async () => {
      result.current.handleNavigateWikilink('Target Note')
    })

    expect(result.current.activeTabPath).toBe('/vault/target.md')
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

  it('handleCreateNoteImmediate creates note with timestamp-based title', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate()
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.title).toBe('Untitled Note 1700000000')
    expect(createdEntry.filename).toBe('untitled-note-1700000000.md')
    expect(createdEntry.isA).toBe('Note')
    vi.restoreAllMocks()
  })

  it('handleCreateNoteImmediate generates unique names on rapid calls via timestamp', () => {
    let ts = 1700000000000
    vi.spyOn(Date, 'now').mockImplementation(() => { ts += 1000; return ts })
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
      result.current.handleCreateNoteImmediate()
    })

    expect(addEntry).toHaveBeenCalledTimes(3)
    const filenames = addEntry.mock.calls.map(([e]: [VaultEntry]) => e.filename)
    // Each call consumes Date.now() multiple times, so just verify uniqueness and pattern
    expect(new Set(filenames).size).toBe(3)
    for (const fn of filenames) {
      expect(fn).toMatch(/^untitled-note-\d+\.md$/)
    }
    vi.restoreAllMocks()
  })

  it('handleCreateNoteImmediate accepts custom type', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const { result } = renderHook(() => useNoteActions(makeConfig()))

    act(() => {
      result.current.handleCreateNoteImmediate('Project')
    })

    expect(addEntry).toHaveBeenCalledTimes(1)
    const [createdEntry] = addEntry.mock.calls[0]
    expect(createdEntry.filename).toMatch(/^untitled-project-\d+\.md$/)
    expect(createdEntry.isA).toBe('Project')
    vi.restoreAllMocks()
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
    expect(createdEntry.path).toMatch(/\/\d{4}-\d{2}-\d{2}\.md$/)
  })

  it('handleOpenDailyNote opens existing daily note instead of creating', async () => {
    const today = todayDateString()
    const existing = makeEntry({ path: `/Users/luca/Laputa/${today}.md`, filename: `${today}.md`, title: today, isA: 'Journal' })
    const { result } = renderHook(() => useNoteActions(makeConfig([existing])))

    await act(async () => {
      result.current.handleOpenDailyNote()
      await new Promise((r) => setTimeout(r, 0))
    })

    // Should open existing note, not create a new one
    expect(addEntry).not.toHaveBeenCalled()
    expect(result.current.activeTabPath).toBe(`/Users/luca/Laputa/${today}.md`)
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

      expect(addPendingSave).toHaveBeenCalledWith(expect.stringContaining('pending-test.md'))
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

      expect(removePendingSave).toHaveBeenCalledWith(expect.stringContaining('persist-ok.md'))
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

      expect(addPendingSave).toHaveBeenCalledWith(expect.stringContaining('fail-save.md'))
      expect(removePendingSave).toHaveBeenCalledWith(expect.stringContaining('fail-save.md'))
      expect(removeEntry).toHaveBeenCalledWith(expect.stringContaining('fail-save.md'))
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

      expect(trackUnsaved).toHaveBeenCalledWith(expect.stringMatching(/untitled-note-\d+\.md$/))
      expect(markContentPending).toHaveBeenCalledWith(expect.stringMatching(/untitled-note-\d+\.md$/), expect.stringContaining('type: Note'))
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
      ['handleCreateNote', 'Failing Note', 'Note', 'failing-note.md'],
      ['handleCreateType', 'Recipe', 'Type', 'recipe.md'],
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

  })

  describe('type change does not move file', () => {
    it('changing type only updates frontmatter, does not move file', async () => {
      const entry = makeEntry({ path: '/test/vault/my-note.md', filename: 'my-note.md', title: 'My Note', isA: 'Note' })
      const config = makeConfig([entry])
      vi.mocked(mockInvoke).mockResolvedValue('')

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/my-note.md', 'type', 'Quarter')
      })

      expect(setToastMessage).toHaveBeenCalledWith('Property updated')
    })
  })

  describe('note open is read-only', () => {
    it('does not sync title or reload entry when opening or reopening a note', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      const entry = makeEntry({ path: '/test/vault/qa-test.md', filename: 'qa-test.md', title: 'Qa Test' })
      vi.mocked(invoke).mockResolvedValueOnce('# Qa Test\n')

      const { result } = renderHook(() => useNoteActions(makeConfig([entry])))

      await act(async () => { await result.current.handleSelectNote(entry) })
      const callCountAfterFirstOpen = vi.mocked(invoke).mock.calls.length

      const desyncedEntry = { ...entry, title: 'Wrong Title Desynced' }
      await act(async () => { await result.current.handleSelectNote(desyncedEntry) })

      expect(vi.mocked(invoke)).toHaveBeenCalledTimes(callCountAfterFirstOpen)
      expect(vi.mocked(invoke).mock.calls).toEqual([
        ['get_note_content', { path: '/test/vault/qa-test.md' }],
      ])
      expect(result.current.tabs[0].entry.title).toBe('Qa Test')
    })
  })

  describe('rename note updates wikilinks', () => {
    it('handleRenameNote passes entry title as old_title to rename_note', async () => {
      const entry = makeEntry({
        path: '/test/vault/weekly-review.md',
        filename: 'weekly-review.md',
        title: 'Weekly Review',
      })
      const replaceEntry = vi.fn()
      const config = makeConfig([entry])
      config.replaceEntry = replaceEntry

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'rename_note') return { new_path: '/test/vault/sprint-retro.md', updated_files: 2 }
        if (cmd === 'get_note_content') return '---\nIs A: Note\n---\n# Sprint Retro\n'
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleRenameNote(
          '/test/vault/weekly-review.md',
          'Sprint Retro',
          '/test/vault',
          replaceEntry,
        )
      })

      expect(mockInvoke).toHaveBeenCalledWith('rename_note', expect.objectContaining({
        vault_path: '/test/vault',
        old_path: '/test/vault/weekly-review.md',
        new_title: 'Sprint Retro',
        old_title: 'Weekly Review',
      }))
      expect(setToastMessage).toHaveBeenCalledWith('Renamed — updated 2 wiki links')
    })

    it('handleRenameNote passes null old_title when entry not found', async () => {
      const config = makeConfig([])

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'rename_note') return { new_path: '/test/vault/new.md', updated_files: 0 }
        if (cmd === 'get_note_content') return '# New\n'
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleRenameNote(
          '/test/vault/old.md', 'New', '/test/vault', vi.fn(),
        )
      })

      expect(mockInvoke).toHaveBeenCalledWith('rename_note', expect.objectContaining({
        old_title: null,
      }))
    })

    it('handleUpdateFrontmatter triggers rename when title key is changed', async () => {
      const entry = makeEntry({
        path: '/test/vault/old-name.md',
        filename: 'old-name.md',
        title: 'Old Name',
      })
      const replaceEntry = vi.fn()
      const config = makeConfig([entry])
      config.replaceEntry = replaceEntry

      vi.mocked(mockInvoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'rename_note') return { new_path: '/test/vault/new-name.md', updated_files: 1 }
        if (cmd === 'get_note_content') return '---\ntitle: New Name\n---\n# New Name\n'
        return ''
      })

      const { result } = renderHook(() => useNoteActions(config))

      // Open a tab for the entry so the rename can find it via tabsRef
      await act(async () => { result.current.handleSelectNote(entry) })

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/test/vault/old-name.md', 'title', 'New Name')
      })

      expect(mockInvoke).toHaveBeenCalledWith('rename_note', expect.objectContaining({
        old_path: '/test/vault/old-name.md',
        new_title: 'New Name',
        old_title: 'Old Name',
      }))
      expect(replaceEntry).toHaveBeenCalledWith(
        '/test/vault/old-name.md',
        expect.objectContaining({ path: '/test/vault/new-name.md', title: 'New Name' }),
      )
    })

    it('handleUpdateFrontmatter does not trigger rename for non-title keys', async () => {
      const config = makeConfig()
      vi.mocked(mockInvoke).mockResolvedValue('')

      const { result } = renderHook(() => useNoteActions(config))

      await act(async () => {
        await result.current.handleUpdateFrontmatter('/vault/note.md', 'status', 'Done')
      })

      expect(mockInvoke).not.toHaveBeenCalledWith('rename_note', expect.anything())
    })
  })
})
