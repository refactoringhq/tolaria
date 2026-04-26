import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../../types'
import { KanbanBoard } from './KanbanBoard'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: 'notes/foo.md',
    filename: 'foo.md',
    title: 'Foo note',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: 'Some snippet',
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

function renderBoard(entries: VaultEntry[], extra: Partial<Parameters<typeof KanbanBoard>[0]> = {}) {
  return render(
    <KanbanBoard
      entries={entries}
      selectedNotePath={null}
      onSelectNote={vi.fn()}
      onUpdateStatus={vi.fn().mockResolvedValue(undefined)}
      {...extra}
    />,
  )
}

describe('KanbanBoard', () => {
  it('renders the empty state when there are no entries', () => {
    renderBoard([])
    expect(screen.getByTestId('kanban-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
  })

  it('renders the five canonical columns when entries exist', () => {
    renderBoard([makeEntry({ path: 'a.md', status: 'doing' })])
    for (const key of ['backlog', 'doing', 'review', 'done', 'blocked']) {
      expect(screen.getByTestId(`kanban-column-${key}`)).toBeInTheDocument()
    }
  })

  it('shows the count badge per column', () => {
    renderBoard([
      makeEntry({ path: 'a.md', status: 'doing' }),
      makeEntry({ path: 'b.md', status: 'doing' }),
      makeEntry({ path: 'c.md', status: 'done' }),
    ])
    expect(screen.getByTestId('kanban-column-count-doing')).toHaveTextContent('2')
    expect(screen.getByTestId('kanban-column-count-done')).toHaveTextContent('1')
    expect(screen.getByTestId('kanban-column-count-backlog')).toHaveTextContent('0')
  })

  it('appends a custom column for non-canonical statuses', () => {
    renderBoard([makeEntry({ path: 'a.md', status: 'wip' })])
    const wip = screen.getByTestId('kanban-column-wip')
    expect(wip).toBeInTheDocument()
    expect(wip).toHaveTextContent('custom')
  })

  it('invokes onSelectNote when a card is clicked', () => {
    const onSelectNote = vi.fn()
    renderBoard([makeEntry({ path: 'a.md', title: 'Foo', status: 'doing' })], { onSelectNote })
    fireEvent.click(screen.getByTestId('kanban-card-a.md'))
    expect(onSelectNote).toHaveBeenCalledTimes(1)
    expect(onSelectNote.mock.calls[0]?.[0]?.path).toBe('a.md')
  })

  it('renders the note title and snippet on the card', () => {
    renderBoard([makeEntry({ path: 'a.md', title: 'My note', snippet: 'A short summary', status: 'doing' })])
    expect(screen.getByText('My note')).toBeInTheDocument()
    expect(screen.getByText('A short summary')).toBeInTheDocument()
  })
})
