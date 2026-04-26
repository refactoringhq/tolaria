import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { buildKanbanAgentContext } from './kanbanAgentContext'

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

describe('buildKanbanAgentContext', () => {
  it('includes the task title, path, type, status and body', async () => {
    const entry = makeEntry({
      path: 'projects/cerbonix.md',
      filename: 'cerbonix.md',
      title: 'Cerbonix',
      isA: 'Project',
      status: 'doing',
    })
    const noteContent = '---\nstatus: doing\n---\n# Cerbonix\n\nDeploy the new server.\n'

    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent,
      allEntries: [entry],
      getContent: vi.fn(),
    })

    expect(prompt).toContain('# Task: Cerbonix')
    expect(prompt).toContain('projects/cerbonix.md')
    expect(prompt).toContain('Type: Project')
    expect(prompt).toContain('Status: doing')
    expect(prompt).toContain('Deploy the new server.')
    expect(prompt).toContain('## Instructions')
  })

  it('falls back to filename when title is empty', async () => {
    const entry = makeEntry({ path: 'projects/foo.md', filename: 'foo.md', title: '' })
    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: 'body',
      allEntries: [entry],
      getContent: vi.fn(),
    })
    expect(prompt).toContain('# Task: foo.md')
  })

  it('falls back to "backlog" status when entry.status is null', async () => {
    const entry = makeEntry({ status: null })
    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: 'x',
      allEntries: [entry],
      getContent: vi.fn(),
    })
    expect(prompt).toContain('Status: backlog')
  })

  it('inlines the body of linked notes resolved via wikilinks', async () => {
    const target = makeEntry({
      path: 'projects/related.md',
      filename: 'related.md',
      title: 'Related Project',
    })
    const entry = makeEntry({
      path: 'projects/source.md',
      filename: 'source.md',
      title: 'Source',
      outgoingLinks: ['Related Project'],
    })
    const getContent = vi.fn(async (path: string) => {
      if (path === 'projects/related.md') return '---\nstatus: doing\n---\n# Related Project\n\nDetails of related work.\n'
      throw new Error('unexpected path: ' + path)
    })

    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: '# Source\n\nMain task.',
      allEntries: [entry, target],
      getContent,
    })

    expect(prompt).toContain('## Related notes (linked via wikilinks)')
    expect(prompt).toContain('### Related Project (projects/related.md)')
    expect(prompt).toContain('Details of related work.')
    expect(getContent).toHaveBeenCalledWith('projects/related.md')
  })

  it('drops linked notes whose content cannot be read', async () => {
    const target = makeEntry({ path: 'gone.md', filename: 'gone.md', title: 'Gone' })
    const entry = makeEntry({ outgoingLinks: ['Gone'] })
    const getContent = vi.fn(async () => { throw new Error('not found') })

    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: 'body',
      allEntries: [entry, target],
      getContent,
    })

    expect(prompt).not.toContain('### Gone')
    expect(prompt).not.toContain('## Related notes')
  })

  it('caps the number of linked notes at maxLinkedNotes', async () => {
    const targets = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ path: `link-${i}.md`, filename: `link-${i}.md`, title: `Link ${i}` }),
    )
    const entry = makeEntry({ outgoingLinks: targets.map((t) => t.title) })
    const getContent = vi.fn(async () => '# body\n\nstuff')

    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: 'main',
      allEntries: [entry, ...targets],
      getContent,
      maxLinkedNotes: 2,
    })

    expect(prompt).toContain('### Link 0')
    expect(prompt).toContain('### Link 1')
    expect(prompt).not.toContain('### Link 2')
    expect(getContent).toHaveBeenCalledTimes(2)
  })

  it('truncates linked note bodies past maxLinkedBodyChars', async () => {
    const target = makeEntry({ path: 'big.md', filename: 'big.md', title: 'Big' })
    const entry = makeEntry({ outgoingLinks: ['Big'] })
    const longBody = 'x'.repeat(5000)
    const getContent = vi.fn(async () => `# Big\n\n${longBody}`)

    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: 'main',
      allEntries: [entry, target],
      getContent,
      maxLinkedBodyChars: 100,
    })

    expect(prompt).toContain('_[truncated]_')
    const linkedSection = prompt.split('## Related notes')[1] ?? ''
    expect(linkedSection.length).toBeLessThan(longBody.length)
  })

  it('renders empty body placeholder when the note body is blank', async () => {
    const entry = makeEntry({ title: 'Empty' })
    const prompt = await buildKanbanAgentContext({
      entry,
      noteContent: '---\nstatus: doing\n---\n',
      allEntries: [entry],
      getContent: vi.fn(),
    })
    expect(prompt).toContain('_(empty body)_')
  })
})
