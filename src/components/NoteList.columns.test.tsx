import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppPreferencesProvider } from '../hooks/useAppPreferences'
import {
  MAC_USER_AGENT,
  makeBookTypeEntries,
  makeViewDefinition,
  renderBookNoteList,
  renderManagedViewNoteList,
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
import { openNoteListPropertiesPicker } from './note-list/noteListPropertiesEvents'

vi.mock('../hooks/useTabManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTabManagement')>()
  return { ...actual, prefetchNoteContent: vi.fn() }
})

function openTypeColumnPicker(entryOverrides: Parameters<typeof makeBookTypeEntries>[1]) {
  renderNoteList({
    entries: makeBookTypeEntries([], entryOverrides),
    selection: { kind: 'sectionGroup', type: 'Book' },
    onUpdateTypeSort: () => undefined,
  })

  act(() => {
    openNoteListPropertiesPicker('type')
  })

  expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
}

describe('NoteList columns and chips', () => {
  it.each([
    {
      label: 'Inbox',
      overrides: { selection: { kind: 'filter', filter: 'inbox' }, inboxNoteListProperties: null },
    },
    { label: 'All Notes', overrides: { allNotesNoteListProperties: null } },
  ] as const)('shows the $label customize-columns action and falls back to type-defined chips', ({ label, overrides }) => {
    renderBookNoteList({
      entryOverrides: { properties: { Priority: 'High', Owner: 'Luca' } },
      ...overrides,
    })

    expect(screen.getByTitle(`Customize ${label} columns`)).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByText('Luca')).not.toBeInTheDocument()
  })

  it('opens the all-notes column picker as a searchable combobox and saves new columns', async () => {
    const onUpdateAllNotesNoteListProperties = vi.fn()
    const archivedOwnerEntry = makeEntry({
      path: '/vault/book-archive.md',
      filename: 'book-archive.md',
      title: 'Archived Book',
      isA: 'Book',
      archived: true,
      properties: { Owner: 'Luca' },
    })

    renderNoteList({
      entries: [
        ...makeBookTypeEntries(['Priority'], { properties: { Priority: 'High' } }),
        archivedOwnerEntry,
      ],
      selection: allSelection,
      allNotesNoteListProperties: null,
      onUpdateAllNotesNoteListProperties,
    })

    act(() => {
      openNoteListPropertiesPicker('all')
    })

    expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
    expect(screen.getByTestId('list-properties-popover')).toHaveClass('overflow-hidden')
    expect(screen.getByTestId('list-properties-scroll-area')).toBeInTheDocument()
    expect(screen.getByTestId('list-properties-scroll-area')).toHaveClass('overflow-y-auto')
    expect(screen.getByRole('checkbox', { name: 'Priority' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeInTheDocument()

    const combobox = screen.getByRole('combobox', { name: 'Search note-list properties' })
    await waitFor(() => expect(combobox).toHaveFocus())

    fireEvent.change(combobox, { target: { value: 'Owner' } })
    expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Priority' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    expect(onUpdateAllNotesNoteListProperties).toHaveBeenCalledWith(['Priority', 'Owner'])

    fireEvent.keyDown(combobox, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('list-properties-popover')).not.toBeInTheDocument())
  })

  it('opens the inbox column picker from the global event and saves new columns', () => {
    const onUpdateInboxNoteListProperties = vi.fn()

    renderNoteList({
      entries: makeBookTypeEntries(['Priority'], { properties: { Priority: 'High', Owner: 'Luca' } }),
      selection: { kind: 'filter', filter: 'inbox' },
      inboxNoteListProperties: null,
      onUpdateInboxNoteListProperties,
    })

    act(() => {
      openNoteListPropertiesPicker('inbox')
    })

    expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Search note-list properties' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Priority' })).toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    expect(onUpdateInboxNoteListProperties).toHaveBeenCalledWith(['Priority', 'Owner'])
  })

  it('opens the view column picker from the global event and applies the saved columns', () => {
    renderManagedViewNoteList({
      entries: makeBookTypeEntries(['Priority'], { properties: { Priority: 'High', Owner: 'Luca' } }),
    })

    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByText('Luca')).not.toBeInTheDocument()

    act(() => {
      openNoteListPropertiesPicker('view')
    })

    expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))

    expect(screen.getByText('Luca')).toBeInTheDocument()
  })

  it('shows an empty-state picker for views with no matching properties', () => {
    renderManagedViewNoteList({
      entries: makeBookTypeEntries(),
      view: makeViewDefinition({
        filename: 'empty-view.yml',
        definition: {
          name: 'Empty View',
          filters: { all: [{ field: 'type', op: 'equals', value: 'Project' }] },
        },
      }),
    })

    act(() => {
      openNoteListPropertiesPicker('view')
    })

    expect(screen.getByTestId('list-properties-popover')).toBeInTheDocument()
    expect(screen.getByText('No properties match this search.')).toBeInTheDocument()
  })

  it('shows status in the type column picker when at least one note has it set', () => {
    openTypeColumnPicker({ status: 'Active' })

    expect(screen.getByRole('combobox', { name: 'Search note-list properties' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'status' })).toBeInTheDocument()
  })

  it('keeps blank statuses out of the type column picker', () => {
    openTypeColumnPicker({ status: '', properties: { Owner: 'Luca' } })

    expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'status' })).not.toBeInTheDocument()
  })

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
