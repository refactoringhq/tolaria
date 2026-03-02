import { describe, it, expect } from 'vitest'
import { resolveTarget, collectLinkedEntries, buildContextualPrompt } from './ai-context'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
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
  ...overrides,
})

describe('resolveTarget', () => {
  const entries = [
    makeEntry({ path: '/vault/a.md', title: 'Alpha', filename: 'a.md' }),
    makeEntry({ path: '/vault/b.md', title: 'Beta', filename: 'beta-note.md', aliases: ['B'] }),
  ]

  it('resolves by title (case-insensitive)', () => {
    expect(resolveTarget('alpha', entries)?.path).toBe('/vault/a.md')
    expect(resolveTarget('Alpha', entries)?.path).toBe('/vault/a.md')
  })

  it('resolves by alias (case-insensitive)', () => {
    expect(resolveTarget('B', entries)?.path).toBe('/vault/b.md')
    expect(resolveTarget('b', entries)?.path).toBe('/vault/b.md')
  })

  it('resolves by filename stem', () => {
    expect(resolveTarget('beta-note', entries)?.path).toBe('/vault/b.md')
  })

  it('returns undefined for unresolvable target', () => {
    expect(resolveTarget('nonexistent', entries)).toBeUndefined()
  })
})

describe('collectLinkedEntries', () => {
  const entryA = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
  const entryB = makeEntry({ path: '/vault/b.md', title: 'Beta' })
  const entryC = makeEntry({ path: '/vault/c.md', title: 'Gamma' })
  const entryD = makeEntry({ path: '/vault/d.md', title: 'Delta' })
  const allEntries = [entryA, entryB, entryC, entryD]

  it('returns empty array when active has no links', () => {
    expect(collectLinkedEntries(entryA, allEntries)).toEqual([])
  })

  it('collects entries from outgoingLinks', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Beta'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Beta'])
  })

  it('collects entries from relationships', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      relationships: { relatedTo: ['[[Alpha]]', '[[Gamma]]'] },
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Gamma'])
  })

  it('collects entries from belongsTo', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      belongsTo: ['[[Delta]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Delta'])
  })

  it('collects entries from relatedTo', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      relatedTo: ['[[Beta]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Beta'])
  })

  it('deduplicates entries across all link sources', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Beta'],
      relationships: { people: ['[[Alpha]]'] },
      belongsTo: ['[[Beta]]'],
      relatedTo: ['[[Alpha]]'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha', 'Beta'])
  })

  it('excludes the active note itself', () => {
    const active = makeEntry({
      path: '/vault/a.md', title: 'Alpha',
      outgoingLinks: ['Alpha'],
    })
    const linked = collectLinkedEntries(active, allEntries)
    expect(linked).toEqual([])
  })

  it('ignores unresolvable links', () => {
    const active = makeEntry({
      path: '/vault/main.md', title: 'Main',
      outgoingLinks: ['Alpha', 'Nonexistent'],
    })
    const linked = collectLinkedEntries(active, [...allEntries, active])
    expect(linked.map(e => e.title)).toEqual(['Alpha'])
  })
})

describe('buildContextualPrompt', () => {
  it('includes active note title and content', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha', isA: 'Project' })
    const content = { '/vault/a.md': '# Alpha\nThis is the alpha project.' }
    const prompt = buildContextualPrompt(active, [], content)
    expect(prompt).toContain('Alpha')
    expect(prompt).toContain('Project')
    expect(prompt).toContain('This is the alpha project.')
  })

  it('includes linked note content', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const linked = makeEntry({ path: '/vault/b.md', title: 'Beta', isA: 'Person' })
    const content = {
      '/vault/a.md': '# Alpha\nMain note.',
      '/vault/b.md': '# Beta\nLinked person.',
    }
    const prompt = buildContextualPrompt(active, [linked], content)
    expect(prompt).toContain('Beta')
    expect(prompt).toContain('Person')
    expect(prompt).toContain('Linked person.')
    expect(prompt).toContain('Linked Notes')
  })

  it('shows (no content) when content is missing', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const prompt = buildContextualPrompt(active, [], {})
    expect(prompt).toContain('(no content)')
  })

  it('truncates linked note content to 2000 chars', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const linked = makeEntry({ path: '/vault/b.md', title: 'Beta' })
    const longContent = 'x'.repeat(3000)
    const content = {
      '/vault/a.md': '# Alpha',
      '/vault/b.md': longContent,
    }
    const prompt = buildContextualPrompt(active, [linked], content)
    // The linked note content should be truncated
    const betaIdx = prompt.indexOf('### Beta')
    const afterBeta = prompt.slice(betaIdx)
    expect(afterBeta.length).toBeLessThan(2200)
  })

  it('includes the system preamble', () => {
    const active = makeEntry({ path: '/vault/a.md', title: 'Alpha' })
    const prompt = buildContextualPrompt(active, [], { '/vault/a.md': 'content' })
    expect(prompt).toContain('AI assistant integrated into Laputa')
  })
})
