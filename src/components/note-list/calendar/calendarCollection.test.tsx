import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useCallback, useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { presentationFromViewDefinition } from '../../../collections/presentationConfig'
import { SET_COLLECTION_LAYOUT_EVENT } from '../../../collections/collectionTypes'
import { useNoteActions } from '../../../hooks/useNoteActions'
import { updateFrontmatterContent } from '../../../lib/frontmatterText'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import type { SidebarSelection, VaultEntry, ViewFile } from '../../../types'
import { CollectionLayoutBody, type WriteNoteProperty } from '../CollectionLayoutBody'
import { CollectionLayoutHeaderControls } from '../CollectionLayoutControls'
import type { InitialNoteProperties } from '../noteListCreate'
import { type CollectionLayoutSource, useCollectionLayout } from '../useCollectionLayout'
import { canWriteCalendarDates } from './calendarBindings'
import { dayDropId } from './useCalendarDrag'

const { invoke, trackEvent, dndHandlers } = vi.hoisted(() => ({
  invoke: vi.fn(),
  trackEvent: vi.fn(),
  dndHandlers: { current: null as null | Record<string, (event: unknown) => void> },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../../../lib/telemetry', () => ({ trackEvent }))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: Parameters<typeof actual.DndContext>[0]) => {
      dndHandlers.current = props as unknown as Record<string, (event: unknown) => void>
      return <actual.DndContext {...props} />
    },
  }
})

const launch = makeEntry({ path: '/vault/launch.md', title: 'Launch', properties: { start: '2026-11-19', end: '2026-11-21' } })
const someday = makeEntry({ path: '/vault/someday.md', title: 'Someday', properties: { owner: 'Ada' } })

type HarnessProps = Partial<CollectionLayoutSource> & {
  onMove?: WriteNoteProperty
  onCreate?: (properties: InitialNoteProperties) => void
}

function Harness({ onMove = vi.fn(), onCreate = vi.fn(), ...overrides }: HarnessProps) {
  const source: CollectionLayoutSource = {
    presentation: { type: 'list', sort: null, properties: [] },
    selection: { kind: 'sectionGroup', type: 'Project' },
    visibleEntries: [launch, someday],
    views: [],
    onUpdateViewDefinition: () => undefined,
    vaultPath: '/vault',
    selectedNotePath: null,
    ...overrides,
  }
  const layout = useCollectionLayout(source)
  return (
    <div data-testid="layout-root" data-kanban-panel={layout.panel.open ? 'open' : 'closed'}>
      <CollectionLayoutHeaderControls
        layout={layout.layout}
        groupBy={layout.groupBy}
        groups={layout.groups}
        calendar={{ settings: layout.calendar, dateProperty: layout.dateProperty, dateOptions: layout.dateOptions, onChange: layout.changeCalendar }}
        locale="en"
        onLayoutChange={layout.changeLayout}
        onGroupByChange={layout.changeGroupBy}
      />
      <CollectionLayoutBody
        layout={layout}
        listContent={<div data-testid="classic-list">Classic list</div>}
        entries={source.visibleEntries}
        allEntries={source.visibleEntries}
        locale="en"
        typeEntryMap={{}}
        onOpen={vi.fn()}
        onMove={onMove}
        onCreate={onCreate}
      />
    </div>
  )
}

async function chooseMenuOption(triggerTestId: string, optionTestId: string) {
  const trigger = screen.getByTestId(triggerTestId)
  act(() => {
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  })
  fireEvent.click(await screen.findByTestId(optionTestId))
  // Radix closes the menu on the next tick; opening another one before that ignores its clicks in JSDOM.
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
}

function savedLayouts() {
  return invoke.mock.calls.filter(([command]) => command === 'save_collection_layout_cmd').map(([, args]) => args)
}

function dragEvent(path: string, day: string, fromTray = false) {
  const item = fromTray ? { entry: someday, start: '', end: '' } : { entry: launch, start: '2026-11-19', end: '2026-11-21' }
  return { active: { id: path, data: { current: { item, fromTray } } }, over: { id: dayDropId(day) } }
}

describe('calendar collection layout', () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({})
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 19, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('switches to Calendar from the layout menu, defaults to the best date property, and saves only on change', async () => {
    render(<Harness />)
    await chooseMenuOption('layout-menu-button', 'layout-option-calendar')
    expect(screen.getByTestId('calendar-board')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-date-menu-button')).toHaveAccessibleName('Calendar dates: start')
    expect(savedLayouts()).toEqual([{
      vaultPath: '/vault',
      collection: 'type:Project',
      presentation: expect.objectContaining({ type: 'calendar', dateProperty: 'start', endDateProperty: null, view: 'month', showWeekends: true }),
    }])

    await chooseMenuOption('calendar-date-menu-button', 'calendar-end-option-end')
    await chooseMenuOption('calendar-date-menu-button', 'calendar-show-weekends')

    expect(savedLayouts().at(-1)).toEqual({
      vaultPath: '/vault',
      collection: 'type:Project',
      presentation: expect.objectContaining({ type: 'calendar', dateProperty: 'start', endDateProperty: 'end', showWeekends: false }),
    })
    expect(trackEvent).toHaveBeenCalledWith('collection_layout_changed', { layout: 'calendar', collection: 'sectionGroup' })
  })

  it('restores the saved calendar settings when the list opens again', async () => {
    invoke.mockResolvedValueOnce({ 'type:Project': { type: 'calendar', dateProperty: 'start', endDateProperty: 'end', view: 'week', showWeekends: false } })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('calendar-board')).toBeInTheDocument())
    expect(screen.getAllByTestId('calendar-day')).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: 'Launch' })[0]).toHaveStyle({ gridColumn: '4 / span 2' })
  })

  it('switches from the command palette event', () => {
    render(<Harness />)
    act(() => window.dispatchEvent(new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: 'calendar' })))
    expect(screen.getByTestId('calendar-board')).toBeInTheDocument()
    act(() => window.dispatchEvent(new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: 'timeline' })))
    expect(screen.getByTestId('calendar-board')).toBeInTheDocument()
  })

  it('reschedules a range through the frontmatter writer: both dates move on disk and in memory, nothing else changes', async () => {
    const files = new Map([[launch.path, '---\ntitle: Launch\nstart: 2026-11-19\nend: 2026-11-21\nowner: Ada\n---\n\nBody [[Roadmap]].\n']])
    vi.stubGlobal('isTauri', true)
    invoke.mockImplementation(async (command, rawArgs) => {
      if (command !== 'update_frontmatter') return {}
      const args = rawArgs as { path: string; key: string; value: string }
      const next = updateFrontmatterContent(files.get(args.path) ?? '', args.key, args.value)
      files.set(args.path, next)
      return next
    })
    const latest: { entries: VaultEntry[] } = { entries: [] }
    function LiveVault() {
      const [entries, setEntries] = useState<VaultEntry[]>([launch, someday])
      useEffect(() => {
        latest.entries = entries
      }, [entries])
      const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) => {
        setEntries((current) => current.map((entry) => (entry.path === path ? { ...entry, ...patch } : entry)))
      }, [])
      const actions = useNoteActions({ addEntry: vi.fn(), removeEntry: vi.fn(), entries, setToastMessage: vi.fn(), updateEntry, vaultPath: '/vault' })
      return (
        <Harness
          visibleEntries={entries}
          presentation={{ type: 'calendar', dateProperty: 'start', endDateProperty: 'end', view: 'month', showWeekends: true, properties: [] }}
          onMove={(entry, key, value) => actions.handleUpdateFrontmatter(entry.path, key, value)}
        />
      )
    }
    render(<LiveVault />)

    act(() => {
      dndHandlers.current?.onDragStart(dragEvent(launch.path, '2026-11-19'))
      dndHandlers.current?.onDragOver(dragEvent(launch.path, '2026-11-19'))
    })
    act(() => dndHandlers.current?.onDragEnd(dragEvent(launch.path, '2026-11-24')))

    await waitFor(() => expect(files.get(launch.path)).toBe('---\ntitle: Launch\nstart: 2026-11-24\nend: 2026-11-26\nowner: Ada\n---\n\nBody [[Roadmap]].\n'))
    await waitFor(() => expect(latest.entries.find((entry) => entry.path === launch.path)?.properties).toMatchObject({ start: '2026-11-24', end: '2026-11-26' }))
    expect(trackEvent).toHaveBeenCalledWith('calendar_note_rescheduled', { source: 'grid', range: 1 })
  })

  it('schedules a tray note by writing only its date property', async () => {
    const onMove = vi.fn()
    render(<Harness presentation={{ type: 'calendar', dateProperty: 'start', endDateProperty: 'end', view: 'month', showWeekends: true, properties: [] }} onMove={onMove} />)
    expect(within(screen.getByTestId('calendar-tray')).getByRole('button', { name: 'Someday' })).toBeInTheDocument()
    act(() => {
      dndHandlers.current?.onDragStart(dragEvent(someday.path, '2026-11-24', true))
      dndHandlers.current?.onDragOver(dragEvent(someday.path, '2026-11-24', true))
    })
    act(() => dndHandlers.current?.onDragEnd(dragEvent(someday.path, '2026-11-24', true)))
    await waitFor(() => expect(onMove).toHaveBeenCalledWith(someday, 'start', '2026-11-24'))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('calendar-tray-note')).not.toBeInTheDocument()
  })

  it('creates a note on a day with the date prefilled and opens the editor panel', () => {
    const onCreate = vi.fn()
    render(<Harness presentation={{ type: 'calendar', dateProperty: 'start', endDateProperty: null, view: 'month', showWeekends: true, properties: [] }} onCreate={onCreate} selectedNotePath="/vault/launch.md" />)
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'closed')
    fireEvent.click(screen.getByRole('button', { name: 'New note on Tuesday, November 24, 2026' }))
    expect(onCreate).toHaveBeenCalledWith({ start: '2026-11-24' })
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'open')
  })

  it('explains a configured date property no note carries and offers another one', () => {
    render(<Harness presentation={{ type: 'calendar', dateProperty: 'due', endDateProperty: null, view: 'month', showWeekends: true, properties: [] }} />)
    expect(screen.getByTestId('calendar-empty')).toHaveTextContent('No note in this list has a date in due')
    fireEvent.click(screen.getAllByTestId('calendar-empty-use-property')[0])
    expect(screen.getByTestId('calendar-board')).toBeInTheDocument()
  })

  it('never writes timestamps or keys that are not plain frontmatter names', () => {
    expect(canWriteCalendarDates('start', null, ['start'])).toBe(true)
    expect(canWriteCalendarDates('$created', null, ['$created'])).toBe(false)
    expect(canWriteCalendarDates('start', 'end: x', ['start', 'end: x'])).toBe(false)
    expect(canWriteCalendarDates(null, null, [])).toBe(false)
  })

  it('keeps Kanban and Calendar View settings across layout switches', async () => {
    let currentView: ViewFile = {
      filename: 'plan.yml',
      definition: { name: 'Plan', icon: null, color: null, sort: null, filters: { all: [] }, presentation: { type: 'kanban', groupBy: 'owner', properties: ['owner'], columnOrder: [], collapsedColumns: [], hiddenColumns: [] } },
    }
    const selection: SidebarSelection = { kind: 'view', filename: 'plan.yml' }
    const updateView = vi.fn((_filename: string, patch: Partial<ViewFile['definition']>) => {
      currentView = { ...currentView, definition: { ...currentView.definition, ...patch } }
    })
    const viewProps = () => ({ selection, presentation: presentationFromViewDefinition(currentView.definition), views: [currentView], onUpdateViewDefinition: updateView })

    const first = render(<Harness {...viewProps()} />)
    await chooseMenuOption('layout-menu-button', 'layout-option-calendar')
    await chooseMenuOption('calendar-date-menu-button', 'calendar-end-option-end')
    expect(currentView.definition.presentation).toEqual(expect.objectContaining({
      type: 'calendar', dateProperty: 'start', endDateProperty: 'end', view: 'month', showWeekends: true,
      kanbanConfig: expect.objectContaining({ groupBy: 'owner' }),
    }))
    first.unmount()

    const second = render(<Harness {...viewProps()} />)
    expect(screen.getByTestId('calendar-date-menu-button')).toHaveAccessibleName('Calendar dates: start')
    await chooseMenuOption('layout-menu-button', 'layout-option-kanban')
    expect(screen.getByTestId('group-by-menu-button')).toHaveAccessibleName('Group by owner')
    second.unmount()

    render(<Harness {...viewProps()} />)
    await chooseMenuOption('layout-menu-button', 'layout-option-calendar')
    expect(currentView.definition.presentation).toEqual(expect.objectContaining({ type: 'calendar', endDateProperty: 'end' }))
  })
})

