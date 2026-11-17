import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { searchNoteList } from '../test-utils/noteListRenderingFixtures'
import { makeEntry, mockEntries, renderNoteList } from '../test-utils/noteListTestUtils'

vi.mock('../hooks/useTabManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTabManagement')>()
  return { ...actual, prefetchNoteContent: vi.fn() }
})

describe('NoteList neighborhood', () => {
  it('shows backlinks from outgoing links in entity view', () => {
    const entriesWithBacklink = mockEntries.map((entry) =>
      entry.path === mockEntries[2].path ? { ...entry, outgoingLinks: ['Build Laputa App'] } : entry,
    )

    renderNoteList({
      entries: entriesWithBacklink,
      selection: { kind: 'entity', entry: mockEntries[0] },
    })

    expect(screen.getByText('Backlinks')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
  })

  it('shows no placeholder neighborhood groups when none exist', () => {
    const standalone = makeEntry({
      path: '/vault/solo.md',
      filename: 'solo.md',
      title: 'Standalone',
      isA: 'Note',
    })

    renderNoteList({
      entries: [standalone],
      selection: { kind: 'entity', entry: standalone },
    })

    expect(screen.queryByRole('button', { name: /Children/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Events/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Referenced by/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Backlinks/i })).not.toBeInTheDocument()
  })

  it('keeps existing neighborhood groups visible at zero after search filters them out', async () => {
    const parent = makeEntry({
      path: '/vault/parent.md',
      filename: 'parent.md',
      title: 'Parent',
      isA: 'Project',
    })
    const child = makeEntry({
      path: '/vault/child.md',
      filename: 'child.md',
      title: 'Child Note',
      isA: 'Note',
      belongsTo: ['[[parent]]'],
    })

    renderNoteList({
      entries: [parent, child],
      selection: { kind: 'entity', entry: parent },
    })

    expect(screen.getByRole('button', { name: /Children\s*1/i })).toBeInTheDocument()

    await searchNoteList('missing-neighborhood-match')

    expect(screen.getByRole('button', { name: /Children\s*0/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Events/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Referenced by/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Backlinks/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Child Note')).not.toBeInTheDocument()
  })

  it('shows the same note in multiple neighborhood groups when relationships overlap', () => {
    const parent = makeEntry({
      path: '/vault/parent.md',
      filename: 'parent.md',
      title: 'Parent',
      isA: 'Project',
      relationships: { 'Related to': ['[[shared-note]]'] },
    })
    const shared = makeEntry({
      path: '/vault/shared-note.md',
      filename: 'shared-note.md',
      title: 'Shared Note',
      isA: 'Note',
      relatedTo: ['[[parent]]'],
    })

    renderNoteList({
      entries: [parent, shared],
      selection: { kind: 'entity', entry: parent },
    })

    expect(screen.getByText('Related to')).toBeInTheDocument()
    expect(screen.getByText('Referenced by')).toBeInTheDocument()
    expect(screen.getAllByText('Shared Note')).toHaveLength(2)
  })

  it('shows all real inverse relationship groups for custom relationship keys', () => {
    const parent = makeEntry({
      path: '/vault/parent.md',
      filename: 'parent.md',
      title: 'Parent',
      isA: 'Project',
    })
    const topicNote = makeEntry({
      path: '/vault/topic-note.md',
      filename: 'topic-note.md',
      title: 'Topic Note',
      isA: 'Note',
      relationships: { Topics: ['[[parent]]'] },
    })
    const mentorNote = makeEntry({
      path: '/vault/mentor-note.md',
      filename: 'mentor-note.md',
      title: 'Mentor Note',
      isA: 'Note',
      relationships: { Mentors: ['[[parent]]'] },
    })
    const hostEvent = makeEntry({
      path: '/vault/host-event.md',
      filename: 'host-event.md',
      title: 'Host Event',
      isA: 'Event',
      relationships: { Hosts: ['[[parent]]'] },
    })

    renderNoteList({
      entries: [parent, topicNote, mentorNote, hostEvent],
      selection: { kind: 'entity', entry: parent },
    })

    expect(screen.getByText('← Topics')).toBeInTheDocument()
    expect(screen.getByText('← Mentors')).toBeInTheDocument()
    expect(screen.getByText('← Hosts')).toBeInTheDocument()
    expect(screen.getByText('Topic Note')).toBeInTheDocument()
    expect(screen.getByText('Mentor Note')).toBeInTheDocument()
    expect(screen.getByText('Host Event')).toBeInTheDocument()
  })

  it('collapses and expands entity groups', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Children'))
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Children'))
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
  })

  it('shows the pinned neighborhood note using the standard row content', () => {
    renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    expect(screen.getByText('Build a personal knowledge management app.')).toBeInTheDocument()
  })
})

describe('NoteList click behavior', () => {
  it('opens the current tab on a regular click', () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'))
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
    expect(onEnterNeighborhood).not.toHaveBeenCalled()
  })

  it('enters Neighborhood on Cmd+Click', async () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'), { metaKey: true })
    await waitFor(() => {
      expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
      expect(onEnterNeighborhood).toHaveBeenCalledWith(mockEntries[0])
    })
  })

  it('enters Neighborhood on Ctrl+Click', async () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList()
    fireEvent.click(screen.getByText('Build Laputa App'), { ctrlKey: true })
    await waitFor(() => {
      expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
      expect(onEnterNeighborhood).toHaveBeenCalledWith(mockEntries[0])
    })
  })

  it('supports Cmd+Click on the entity pinned card', async () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1], { metaKey: true })
    await waitFor(() => {
      expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
      expect(onEnterNeighborhood).toHaveBeenCalledWith(mockEntries[0])
    })
  })

  it('opens the current tab from the entity pinned card on regular click', () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    const titles = screen.getAllByText('Build Laputa App')
    fireEvent.click(titles[titles.length - 1])
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[0])
    expect(onEnterNeighborhood).not.toHaveBeenCalled()
  })

  it('opens child notes from entity view in the current tab', () => {
    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList({ selection: { kind: 'entity', entry: mockEntries[0] } })
    fireEvent.click(screen.getByText('Facebook Ads Strategy'))
    expect(onReplaceActiveTab).toHaveBeenCalledWith(mockEntries[1])
    expect(onEnterNeighborhood).not.toHaveBeenCalled()
  })
})
