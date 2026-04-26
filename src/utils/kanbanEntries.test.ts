import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import { isKanbanEligibleEntry } from './kanbanEntries'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: 'notes/foo.md',
    filename: 'foo.md',
    title: 'Foo',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    ...overrides,
  }
}

describe('isKanbanEligibleEntry', () => {
  it('keeps a regular markdown note', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'notes/foo.md' }))).toBe(true)
  })

  it('rejects binary files', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'attachments/image.png', fileKind: 'binary' }))).toBe(false)
  })

  it('rejects view definition YAMLs at the root views/ folder', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'views/inbox.yml' }))).toBe(false)
    expect(isKanbanEligibleEntry(makeEntry({ path: 'views/board.yaml' }))).toBe(false)
  })

  it('rejects view definition YAMLs in a nested vault', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'subvault/views/board.yml' }))).toBe(false)
  })

  it('keeps notes that just happen to contain "views" in the name', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'notes/my-views-note.md' }))).toBe(true)
    expect(isKanbanEligibleEntry(makeEntry({ path: 'projects/views-rework.md' }))).toBe(true)
  })

  it('keeps non-binary text files that are not view configs', () => {
    expect(isKanbanEligibleEntry(makeEntry({ path: 'snippets/code.txt', fileKind: 'text' }))).toBe(true)
  })
})
