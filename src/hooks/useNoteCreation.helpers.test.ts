import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import {
  buildNewEntry,
  buildNoteContent,
  entryMatchesTarget,
  generateUntitledName,
  planNewNoteCreation,
  resolveNewNote,
  resolveNewType,
  resolveTemplate,
  resolveTypeInstanceDefaults,
  slugify,
} from './useNoteCreation'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/test.md', filename: 'test.md', title: 'Test Note', isA: 'Note',
  aliases: [], belongsTo: [], relatedTo: [], status: 'Active', archived: false,
  modifiedAt: 1700000000, createdAt: 1700000000, fileSize: 100, snippet: '',
  wordCount: 0, relationships: {}, icon: null, color: null, order: null,
  outgoingLinks: [], template: null, sort: null, sidebarLabel: null,
  view: null, visible: null, properties: {}, organized: false, favorite: false,
  favoriteIndex: null, listPropertiesDisplay: [], hasH1: false,
  ...overrides,
})

describe('slugify', () => {
  it('converts text to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('preserves unicode letters when building filenames', () => {
    expect(slugify('停智慧')).toBe('停智慧')
  })

  it('removes special characters', () => {
    expect(slugify('My Project! @#$%')).toBe('my-project')
  })

  it('handles empty string with fallback', () => {
    expect(slugify('')).toBe('untitled')
  })

  it('returns fallback for strings with only special characters', () => {
    expect(slugify('+++')).not.toBe('')
    expect(slugify('---')).not.toBe('')
  })
})

describe('buildNewEntry', () => {
  it('creates a VaultEntry with correct fields', () => {
    const entry = buildNewEntry({ path: '/vault/my-note.md', slug: 'my-note', title: 'My Note', type: 'Note', status: 'Active' })
    expect(entry.path).toBe('/vault/my-note.md')
    expect(entry.filename).toBe('my-note.md')
    expect(entry.title).toBe('My Note')
    expect(entry.isA).toBe('Note')
    expect(entry.status).toBe('Active')
    expect(entry.archived).toBe(false)
  })

  it('sets null status when provided', () => {
    const entry = buildNewEntry({ path: '/vault/ai.md', slug: 'ai', title: 'AI', type: 'Topic', status: null })
    expect(entry.status).toBeNull()
  })
})

describe('generateUntitledName', () => {
  it('returns base name when no conflicts', () => {
    expect(generateUntitledName({ entries: [], type: 'Note' })).toBe('Untitled note')
  })

  it('appends counter when base name exists', () => {
    expect(generateUntitledName({ entries: [makeEntry({ title: 'Untitled note' })], type: 'Note' })).toBe('Untitled note 2')
  })

  it('increments counter past existing numbered entries', () => {
    const entries = [
      makeEntry({ title: 'Untitled note' }),
      makeEntry({ title: 'Untitled note 2' }),
      makeEntry({ title: 'Untitled note 3' }),
    ]
    expect(generateUntitledName({ entries, type: 'Note' })).toBe('Untitled note 4')
  })

  it('avoids names in the pending set', () => {
    expect(generateUntitledName({ entries: [], type: 'Note', pendingTitles: new Set(['Untitled note']) })).toBe('Untitled note 2')
  })
})

describe('entryMatchesTarget', () => {
  it('matches by exact title (case-insensitive)', () => {
    expect(entryMatchesTarget({ entry: makeEntry({ title: 'My Project' }), target: 'my project' })).toBe(true)
  })

  it('matches by alias', () => {
    expect(entryMatchesTarget({ entry: makeEntry({ aliases: ['MP'] }), target: 'mp' })).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(entryMatchesTarget({ entry: makeEntry({ title: 'Something' }), target: 'nonexistent' })).toBe(false)
  })
})

describe('buildNoteContent', () => {
  it('generates frontmatter with title and status', () => {
    expect(buildNoteContent({ title: 'My Note', type: 'Note', status: 'Active' })).toBe('---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n')
  })

  it('omits title when null', () => {
    expect(buildNoteContent({ title: null, type: 'Note', status: 'Active' })).toBe('---\ntype: Note\nstatus: Active\n---\n')
  })

  it('omits status when null', () => {
    expect(buildNoteContent({ title: 'AI', type: 'Topic', status: null })).toBe('---\ntitle: AI\ntype: Topic\n---\n')
  })

  it('includes template body when provided', () => {
    const content = buildNoteContent({ title: 'P', type: 'Project', status: 'Active', template: '## Objective\n\n' })
    expect(content).toContain('## Objective')
  })

  it('prepends an empty H1 when requested for untitled-note flows', () => {
    expect(buildNoteContent({ title: null, type: 'Note', status: 'Active', initialEmptyHeading: true })).toBe('---\ntype: Note\nstatus: Active\n---\n\n# \n\n')
  })

  it('keeps the empty H1 before any template content', () => {
    const content = buildNoteContent({
      title: null,
      type: 'Project',
      status: 'Active',
      template: '## Objective\n\n',
      initialEmptyHeading: true,
    })
    expect(content).toBe('---\ntype: Project\nstatus: Active\n---\n\n# \n\n## Objective\n\n')
  })

  it('skips the empty H1 when the template already starts with one', () => {
    const content = buildNoteContent({
      title: null,
      type: 'Weekly',
      status: null,
      template: '# Woche 2026.21\n\nWochennotiz\n',
      initialEmptyHeading: true,
    })
    expect(content).toBe('---\ntype: Weekly\n---\n\n# Woche 2026.21\n\nWochennotiz\n')
  })

  it('skips the empty H1 when the template starts with an H1 after leading whitespace', () => {
    const content = buildNoteContent({
      title: null,
      type: 'Weekly',
      status: null,
      template: '\n\n# Woche 2026.21\n',
      initialEmptyHeading: true,
    })
    expect(content).toBe('---\ntype: Weekly\n---\n\n\n\n# Woche 2026.21\n')
  })
})

describe('resolveNewNote', () => {
  it('creates note at vault root', () => {
    const { entry, content } = resolveNewNote({ title: 'My Project', type: 'Project', vaultPath: '/vault' })
    expect(entry.path).toBe('/vault/my-project.md')
    expect(entry.isA).toBe('Project')
    expect(entry.status).toBeNull()
    expect(content).toContain('type: Project')
    expect(content).not.toContain('status:')
  })

  it('omits status for Topic type', () => {
    const { entry } = resolveNewNote({ title: 'ML', type: 'Topic', vaultPath: '/vault' })
    expect(entry.status).toBeNull()
  })

  it('does not add a default status for other regular types', () => {
    const { entry, content } = resolveNewNote({ title: 'Reflection', type: 'Journal', vaultPath: '/vault' })
    expect(entry.status).toBeNull()
    expect(content).not.toContain('status:')
  })

  it('creates notes in the configured default workspace and keeps its identity', () => {
    const { entry } = resolveNewNote({
      title: 'Team Brief',
      type: 'Note',
      vaultPath: '/personal',
      defaultWorkspacePath: '/team',
      vaults: [
        { label: 'Personal', path: '/personal', alias: 'personal', available: true, mounted: true },
        { label: 'Team Notes', path: '/team', alias: 'team', color: 'green', available: true, mounted: true },
      ],
    })

    expect(entry.path).toBe('/team/team-brief.md')
    expect(entry.workspace).toMatchObject({
      label: 'Team Notes',
      alias: 'team',
      path: '/team',
      color: 'green',
      defaultForNewNotes: true,
    })
  })

  it('falls back to the active workspace when the default workspace is unavailable', () => {
    const { entry } = resolveNewNote({
      title: 'Local Brief',
      type: 'Note',
      vaultPath: '/personal',
      defaultWorkspacePath: '/team',
      vaults: [
        { label: 'Personal', path: '/personal', alias: 'personal', available: true, mounted: true },
        { label: 'Team Notes', path: '/team', alias: 'team', available: false, mounted: true },
      ],
    })

    expect(entry.path).toBe('/personal/local-brief.md')
    expect(entry.workspace?.alias).toBe('personal')
  })

  it('applies valued properties and relationships from the type entry to newly created instances', () => {
    const typeEntry = makeEntry({
      title: 'Book',
      isA: 'Type',
      properties: {
        Rating: 5,
        'start date': null,
      },
      relationships: {
        Author: ['[[person/frank-herbert]]'],
      },
    })
    const defaults = resolveTypeInstanceDefaults({ entries: [typeEntry], typeName: 'Book' })
    const { entry, content } = resolveNewNote({
      title: 'Dune',
      type: 'Book',
      vaultPath: '/vault',
      defaults,
    })

    expect(content).toContain('Rating: 5')
    expect(content).toContain('Author: "[[person/frank-herbert]]"')
    expect(content).not.toContain('start date:')
    expect(entry.properties).toEqual({ Rating: 5 })
    expect(entry.relationships).toEqual({ Author: ['[[person/frank-herbert]]'] })
  })

  it('applies the type status to new instances when the type properties omit it', () => {
    const typeEntry = makeEntry({ title: 'Project', isA: 'Type', status: 'Active', properties: {} })
    const defaults = resolveTypeInstanceDefaults({ entries: [typeEntry], typeName: 'Project' })
    const { entry, content } = resolveNewNote({ title: 'Launch', type: 'Project', vaultPath: '/vault', defaults })

    expect(content).toContain('status: Active')
    expect(entry.status).toBe('Active')
    expect(entry.properties).toEqual({})
  })

  it('writes the type status once using the author key spelling and current value', () => {
    const typeEntry = makeEntry({ title: 'Project', isA: 'Type', status: 'Done', properties: { Status: 'Active' } })
    const defaults = resolveTypeInstanceDefaults({ entries: [typeEntry], typeName: 'Project' })
    const { content } = resolveNewNote({ title: 'Launch', type: 'Project', vaultPath: '/vault', defaults })

    expect(content).toContain('Status: Done')
    expect(content.match(/status:/gi)).toHaveLength(1)
  })

  it('blocks creation when macOS /tmp aliases point at the same note path', () => {
    const plan = planNewNoteCreation({
      entries: [makeEntry({ path: '/private/tmp/tolaria-vault/briefing.md', filename: 'briefing.md' })],
      title: 'Briefing',
      type: 'Note',
      vaultPath: '/tmp/tolaria-vault',
    })

    expect(plan.status).toBe('blocked')
  })
})

describe('resolveNewType', () => {
  it('creates a type entry at the vault root', () => {
    const { entry, content } = resolveNewType({ typeName: 'Recipe', vaultPath: '/vault' })
    expect(entry.path).toBe('/vault/recipe.md')
    expect(entry.isA).toBe('Type')
    expect(content).toContain('type: Type')
  })

  it('uses the unicode title when the type name has no ASCII characters', () => {
    const { entry } = resolveNewType({ typeName: '停智慧', vaultPath: '/vault' })
    expect(entry.path).toBe('/vault/停智慧.md')
    expect(entry.filename).toBe('停智慧.md')
  })

  it('creates type files in the configured default workspace', () => {
    const { entry } = resolveNewType({
      typeName: 'Decision',
      vaultPath: '/personal',
      defaultWorkspacePath: '/team',
      vaults: [
        { label: 'Team Notes', path: '/team', alias: 'team', available: true, mounted: true },
      ],
    })

    expect(entry.path).toBe('/team/decision.md')
    expect(entry.workspace?.alias).toBe('team')
  })
})

describe('resolveTemplate', () => {
  it('returns template from type entry when set', () => {
    const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', template: '## Ingredients\n\n' })
    expect(resolveTemplate({ entries: [typeEntry], typeName: 'Recipe' })).toBe('## Ingredients\n\n')
  })

  it('returns null for built-in types without an explicit type template', () => {
    expect(resolveTemplate({ entries: [], typeName: 'Project' })).toBeNull()
  })

  it('returns null when no template and no default', () => {
    expect(resolveTemplate({ entries: [], typeName: 'CustomType' })).toBeNull()
  })
})
