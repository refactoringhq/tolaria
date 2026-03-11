import { describe, it, expect } from 'vitest'
import type { VaultEntry } from '../types'
import { wikilinkTarget, wikilinkDisplay, resolveEntry } from './wikilink'

function makeEntry(overrides: Partial<VaultEntry>): VaultEntry {
  return {
    path: '/vault/note.md', filename: 'note.md', title: 'Note', isA: null,
    aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
    cadence: null, archived: false, trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 100, snippet: '', wordCount: 0,
    relationships: {}, icon: null, color: null, order: null, template: null,
    sort: null, outgoingLinks: [], sidebarLabel: null, view: null, visible: null,
    properties: {},
    ...overrides,
  }
}

describe('wikilinkTarget', () => {
  it('strips brackets', () => {
    expect(wikilinkTarget('[[foo]]')).toBe('foo')
  })
  it('returns target before pipe', () => {
    expect(wikilinkTarget('[[path|display]]')).toBe('path')
  })
  it('handles bare text without brackets', () => {
    expect(wikilinkTarget('just text')).toBe('just text')
  })
})

describe('wikilinkDisplay', () => {
  it('returns text after pipe', () => {
    expect(wikilinkDisplay('[[path|My Title]]')).toBe('My Title')
  })
  it('humanises slug when no pipe', () => {
    expect(wikilinkDisplay('[[my-note]]')).toBe('My Note')
  })
})

describe('resolveEntry', () => {
  const alice = makeEntry({ path: '/vault/person/alice.md', filename: 'alice.md', title: 'Alice', isA: 'Person', aliases: ['Alice Smith'] })
  const bob = makeEntry({ path: '/vault/person/bob.md', filename: 'bob.md', title: 'Bob', isA: 'Person' })
  const project = makeEntry({ path: '/vault/project/my-project.md', filename: 'my-project.md', title: 'My Project', isA: 'Project' })
  const entries = [alice, bob, project]

  it('matches by title (case-insensitive)', () => {
    expect(resolveEntry(entries, 'alice')).toBe(alice)
    expect(resolveEntry(entries, 'ALICE')).toBe(alice)
    expect(resolveEntry(entries, 'Alice')).toBe(alice)
  })

  it('matches by alias (case-insensitive)', () => {
    expect(resolveEntry(entries, 'alice smith')).toBe(alice)
    expect(resolveEntry(entries, 'Alice Smith')).toBe(alice)
  })

  it('matches by filename stem (case-insensitive)', () => {
    expect(resolveEntry(entries, 'my-project')).toBe(project)
    expect(resolveEntry(entries, 'My-Project')).toBe(project)
  })

  it('matches by relative path suffix (type/slug)', () => {
    expect(resolveEntry(entries, 'person/alice')).toBe(alice)
    expect(resolveEntry(entries, 'project/my-project')).toBe(project)
  })

  it('handles pipe syntax: uses target part for lookup', () => {
    expect(resolveEntry(entries, 'person/alice|Alice S.')).toBe(alice)
    expect(resolveEntry(entries, 'Alice|A')).toBe(alice)
  })

  it('returns undefined for non-existent target', () => {
    expect(resolveEntry(entries, 'Does Not Exist')).toBeUndefined()
  })

  it('returns undefined for empty entries', () => {
    expect(resolveEntry([], 'Alice')).toBeUndefined()
  })

  it('matches by filename stem from last segment of path target', () => {
    // If target is "person/alice", the last segment "alice" should match filename stem
    expect(resolveEntry(entries, 'person/alice')).toBe(alice)
  })

  it('matches title-as-words from kebab-case target', () => {
    // "my-project" → "my project" should match title "My Project"
    expect(resolveEntry(entries, 'my-project')).toBe(project)
  })
})
