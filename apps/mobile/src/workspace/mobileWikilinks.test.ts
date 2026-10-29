import { describe, expect, it } from 'vitest'
import {
  mobileNoteIdForWikilinkTarget,
  mobileWikilinkHref,
  mobileWikilinkTargetForNote,
  parseMobileWikilink,
} from './mobileWikilinks'
import type { MobileNote } from './mobileWorkspaceModel'

describe('mobile wikilink resolution', () => {
  it('parses desktop wikilink frontmatter values with surrounding whitespace', () => {
    expect(parseMobileWikilink(' [[Cafe Notes.md|Café]] ')).toEqual({
      display: 'Café',
      target: 'Cafe Notes.md',
    })
  })

  it('builds the native TenTap href used for Tolaria wikilink marks', () => {
    expect(mobileWikilinkHref('Tolaria/Mobile UI')).toBe('tolaria://wikilink/Tolaria%2FMobile%20UI')
  })

  it('resolves aliases using the same note identity candidates as desktop', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({
        aliases: ['Alpha Project'],
        id: 'projects/project-alpha.md',
        path: 'projects/project-alpha.md',
        title: 'Project A',
      }),
    ], 'alpha project')).toBe('projects/project-alpha.md')
  })

  it('resolves title targets with the same diacritic folding as search and autocomplete', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'journal/cafe-notes.md',
        path: 'journal/cafe-notes.md',
        title: 'Café Notes',
      }),
    ], 'Cafe Notes')).toBe('journal/cafe-notes.md')
  })

  it('resolves md-suffixed path and title targets to the same note identity', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'research/project-alpha.md',
        path: 'research/project-alpha.md',
        title: 'Project Alpha',
      }),
    ], 'research/project-alpha.md')).toBe('research/project-alpha.md')
    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'research/project-alpha.md',
        path: 'research/project-alpha.md',
        title: 'Project Alpha',
      }),
    ], 'Project Alpha.md')).toBe('research/project-alpha.md')
  })

  it('opens the note when a wikilink includes a heading fragment', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({ id: 'research/project-alpha.md', path: 'research/project-alpha.md', title: 'Project Alpha' }),
    ], 'research/project-alpha#Background')).toBe('research/project-alpha.md')
  })

  it('resolves desktop legacy path-style targets through path suffixes and filename stems', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'docs/adr/0031-foo.md',
        path: 'docs/adr/0031-foo.md',
        title: '0031 Foo',
      }),
      note({
        id: 'hello.md',
        path: 'hello.md',
        title: 'Hello',
      }),
    ], 'adr/0031-foo')).toBe('docs/adr/0031-foo.md')

    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'alice.md',
        path: 'alice.md',
        title: 'Alice',
      }),
    ], 'person/alice')).toBe('alice.md')
  })

  it('resolves and formats cross-workspace targets with the stable workspace alias', () => {
    const source = note({
      id: 'source.md',
      path: 'source.md',
      title: 'Source',
      workspace: 'Personal',
      workspaceAlias: 'personal',
    })
    const target = note({
      id: 'projects/alpha.md',
      path: 'projects/alpha.md',
      title: 'Alpha',
      workspace: 'Team',
      workspaceAlias: 'team',
    })

    expect(mobileWikilinkTargetForNote(target, source)).toBe('team/projects/alpha')
    expect(mobileNoteIdForWikilinkTarget([source, target], 'team/projects/alpha')).toBe('projects/alpha.md')
    expect(mobileNoteIdForWikilinkTarget([source, target], 'personal/projects/alpha')).toBeNull()
  })

  it('resolves desktop kebab-case targets through humanized titles', () => {
    expect(mobileNoteIdForWikilinkTarget([
      note({
        id: 'renamed-file.md',
        path: 'renamed-file.md',
        title: 'My Project',
      }),
    ], 'my-project')).toBe('renamed-file.md')
  })
})

function note(overrides: Partial<MobileNote>): MobileNote {
  return {
    created: 'today',
    date: 'today',
    favorite: false,
    id: 'note.md',
    links: 0,
    modified: 'today',
    relationships: [],
    snippet: '',
    status: '',
    tags: [],
    title: 'Note',
    type: 'Note',
    typeTone: 'gray',
    workspace: 'Vault',
    ...overrides,
  }
}
