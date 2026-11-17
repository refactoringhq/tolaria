import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppPreferencesProvider } from '../hooks/useAppPreferences'
import {
  MAC_USER_AGENT,
  makeBookTypeEntries,
  searchNoteList,
  WINDOWS_USER_AGENT,
  withUserAgent,
} from '../test-utils/noteListRenderingFixtures'
import {
  allSelection,
  buildNoteListProps,
  makeEntry,
  makeTypeDefinition,
  mockEntries,
  renderNoteList,
} from '../test-utils/noteListTestUtils'
import { NoteList } from './NoteList'

vi.mock('../hooks/useTabManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTabManagement')>()
  return { ...actual, prefetchNoteContent: vi.fn() }
})

describe('NoteList property chips', () => {
  it('renders status as a note-list chip when a type displays it', () => {
    renderNoteList({
      entries: makeBookTypeEntries(['status'], { status: 'Active' }),
      selection: { kind: 'sectionGroup', type: 'Book' },
    })

    const chip = screen.getByTestId('property-chip-status-0')
    expect(chip).toHaveTextContent('• Active')
    expect(chip).toHaveStyle({ backgroundColor: 'var(--accent-green-light)', color: 'var(--accent-green)' })
  })

  it('auto-detects status-like property values in note-list chips', () => {
    renderNoteList({
      entries: makeBookTypeEntries(['Phase'], { properties: { Phase: 'Draft' } }),
      selection: { kind: 'sectionGroup', type: 'Book' },
    })

    const chip = screen.getByTestId('property-chip-phase-0')
    expect(chip).toHaveTextContent('• Draft')
    expect(chip).toHaveStyle({ backgroundColor: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' })
  })

  it('formats date properties in note-list chips with the selected display format', async () => {
    const built = buildNoteListProps({
      entries: makeBookTypeEntries(['Due'], { properties: { Due: '2026-05-11' } }),
      selection: { kind: 'sectionGroup', type: 'Book' },
    })
    render(
      <AppPreferencesProvider dateDisplayFormat="european">
        <NoteList {...built.props} />
      </AppPreferencesProvider>,
    )

    expect(screen.getByTestId('property-chip-due-0')).toHaveTextContent('11/5/2026')

    await searchNoteList('11/5/2026')
    expect(screen.getByText('Book Note')).toBeInTheDocument()
  })

  it('keeps unknown status values on neutral note-list chip styling', () => {
    renderNoteList({
      entries: makeBookTypeEntries(['status'], { status: 'Needs Review' }),
      selection: { kind: 'sectionGroup', type: 'Book' },
    })

    const chip = screen.getByTestId('property-chip-status-0')
    expect(chip).toHaveTextContent('• Needs Review')
    expect(chip.getAttribute('style')).toBeNull()
  })

  it('uses inbox overrides when configured', () => {
    renderNoteList({
      entries: makeBookTypeEntries(['Priority'], { properties: { Priority: 'High', Owner: 'Luca' } }),
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: ['Owner'],
      onUpdateInboxNoteListProperties: () => undefined,
    })

    expect(screen.getByText('Luca')).toBeInTheDocument()
    expect(screen.queryByText('High')).not.toBeInTheDocument()
  })

  it('Cmd+clicks relationship chips through the note list without triggering the row click', async () => {
    const projectType = makeTypeDefinition('Project')
    const taskType = makeTypeDefinition('Task', ['Belongs to'])
    const projectEntry = makeEntry({
      path: '/vault/project/build-app.md',
      filename: 'build-app.md',
      title: 'Build App',
      isA: 'Project',
      createdAt: 1700000000,
    })
    const taskEntry = makeEntry({
      path: '/vault/task/write-tests.md',
      filename: 'write-tests.md',
      title: 'Write tests',
      isA: 'Task',
      relationships: { 'Belongs to': ['[[project/build-app]]'] },
      createdAt: 1700000001,
    })

    const { onReplaceActiveTab, onEnterNeighborhood } = renderNoteList({
      entries: [projectType, taskType, projectEntry, taskEntry],
      selection: { kind: 'sectionGroup', type: 'Task' },
    })

    const chip = screen.getByTestId('property-chip-belongs-to-0')

    fireEvent.click(chip)
    expect(onReplaceActiveTab).not.toHaveBeenCalled()
    expect(onEnterNeighborhood).not.toHaveBeenCalled()

    fireEvent.click(chip, { metaKey: true })
    await waitFor(() => {
      expect(onReplaceActiveTab).toHaveBeenCalledWith(projectEntry)
      expect(onEnterNeighborhood).toHaveBeenCalledWith(projectEntry)
    })
  })
})

describe('NoteList type sections', () => {
  const typeEntry = {
    ...makeEntry({
      path: '/Users/luca/Laputa/types/project.md',
      filename: 'project.md',
      title: 'Project',
      isA: 'Type',
      snippet: 'Defines the Project type.',
      modifiedAt: 1700000000,
      fileSize: 200,
      wordCount: 50,
    }),
  }
  const entriesWithType = [...mockEntries, typeEntry]

  it('does not show a type note pinned card while browsing the section', () => {
    renderNoteList({
      entries: entriesWithType,
      selection: { kind: 'sectionGroup', type: 'Project' },
    })

    expect(screen.queryByText('Defines the Project type.')).not.toBeInTheDocument()
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })

  it('renders a clickable type header that opens the type note', () => {
    const { onReplaceActiveTab } = renderNoteList({
      entries: entriesWithType,
      selection: { kind: 'sectionGroup', type: 'Project' },
    })

    const headerLink = screen.getByTestId('type-header-link')
    expect(headerLink).toHaveTextContent('Project')
    fireEvent.click(headerLink)
    expect(onReplaceActiveTab).toHaveBeenCalledWith(typeEntry)
  })

  it('does not render a type header outside type sections', () => {
    renderNoteList({ entries: entriesWithType, selection: allSelection })
    expect(screen.queryByTestId('type-header-link')).not.toBeInTheDocument()
  })
})

describe('NoteList traffic-light padding', () => {
  it('adds left padding for macOS traffic lights when the sidebar is collapsed', () => {
    withUserAgent(MAC_USER_AGENT, () => {
      const { container } = renderNoteList({ sidebarCollapsed: true })
      const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
      expect(header.style.paddingLeft).toBe('var(--tolaria-macos-traffic-light-padding, 90px)')
    })
  })

  it('does not add macOS traffic-light padding on Windows when the sidebar is collapsed', () => {
    withUserAgent(WINDOWS_USER_AGENT, () => {
      const { container } = renderNoteList({ sidebarCollapsed: true })
      const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
      expect(header.style.paddingLeft).toBe('')
    })
  })

  it('does not add extra left padding when the sidebar is expanded', () => {
    withUserAgent(MAC_USER_AGENT, () => {
      const { container } = renderNoteList({ sidebarCollapsed: false })
      const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
      expect(header.style.paddingLeft).toBe('')
    })
  })

  it('defaults to no extra padding when sidebarCollapsed is omitted', () => {
    const { container } = renderNoteList()
    const header = container.querySelector('.h-\\[52px\\]') as HTMLElement
    expect(header.style.paddingLeft).toBe('')
  })
})
