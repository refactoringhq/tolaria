import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { presentationFromViewDefinition } from '../../collections/presentationConfig'
import type { NoteActionsConfig } from '../../hooks/useNoteActions'
import { useNoteActions } from '../../hooks/useNoteActions'
import { updateFrontmatterContent } from '../../lib/frontmatterText'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import type { SidebarSelection, VaultEntry, ViewFile } from '../../types'
import { CollectionLayoutBody } from './CollectionLayoutBody'
import { type CollectionLayoutSource, supportsLayouts, useCollectionLayout } from './useCollectionLayout'
import { CollectionLayoutHeaderControls } from './CollectionLayoutControls'
import { layoutPropertyPicker } from './kanbanCardFieldsPicker'

const { invoke, trackEvent } = vi.hoisted(() => ({ invoke: vi.fn(), trackEvent: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../../lib/telemetry', () => ({ trackEvent }))
vi.mock('./KanbanLayout', () => ({
  KanbanLayout: ({ entries, onMove, onOpen, collapsedColumns, hiddenColumns, onToggleColumnCollapsed, onToggleColumnHidden }: MockKanbanProps) => (
    <div data-testid="kanban-board" data-collapsed-columns={JSON.stringify(collapsedColumns)} data-hidden-columns={JSON.stringify(hiddenColumns)}>
      <button type="button" onClick={() => onMove(entries[0], null)}>drop first card in No value</button>
      <button type="button" onClick={(event) => onOpen(entries[0], event)}>open first card</button>
      <button type="button" onClick={() => onToggleColumnCollapsed('Doing')}>toggle Doing collapsed</button>
      <button type="button" onClick={() => onToggleColumnHidden('')}>toggle No value hidden</button>
    </div>
  ),
}))

type MockKanbanProps = {
  entries: VaultEntry[]
  onMove: (entry: VaultEntry, value: string | null) => void
  onOpen: (entry: VaultEntry, event: React.MouseEvent) => void
  collapsedColumns: string[]
  hiddenColumns: string[]
  onToggleColumnCollapsed: (group: string) => void
  onToggleColumnHidden: (group: string) => void
}

type HarnessProps = Partial<CollectionLayoutSource> & {
  onMove?: (entry: VaultEntry, property: string, value: string | null) => void
  onOpen?: (entry: VaultEntry) => void
}

const alpha = makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing', properties: { owner: 'Ada', priority: 'High' } })

function Harness({ onMove = vi.fn(), onOpen = vi.fn(), ...overrides }: HarnessProps) {
  const source: CollectionLayoutSource = {
    presentation: { type: 'list', sort: null, properties: [] },
    selection: { kind: 'filter', filter: 'all' },
    visibleEntries: [alpha],
    views: [],
    onUpdateViewDefinition: () => undefined,
    vaultPath: '/vault',
    selectedNotePath: null,
    ...overrides,
  }
  const layout = useCollectionLayout(source)
  const picker = layoutPropertyPicker(layout, { scope: 'all', availableProperties: ['priority'], currentDisplay: ['priority'], onSave: vi.fn(), triggerTitle: 'Customize columns' }, 'en')
  return (
    <div data-collection-layout={layout.layout} data-kanban-panel={layout.panel.open ? 'open' : 'closed'} data-testid="layout-root">
      <CollectionLayoutHeaderControls layout={layout.layout} groupBy={layout.groupBy} groups={layout.groups} locale="en" onLayoutChange={layout.changeLayout} onGroupByChange={layout.changeGroupBy} />
      <output data-testid="card-fields">{picker?.currentDisplay.join(',')}</output>
      <button type="button" onClick={() => picker?.onSave(['owner'])}>show owner on cards</button>
      <button type="button" onClick={layout.panel.close}>close panel</button>
      <CollectionLayoutBody
        layout={layout}
        listContent={<div data-testid="classic-list">Classic list</div>}
        entries={source.visibleEntries}
        allEntries={source.visibleEntries}
        locale="en"
        typeEntryMap={{}}
        onOpen={(entry) => onOpen(entry)}
        onMove={onMove}
      />
    </div>
  )
}

async function chooseMenuOption(triggerTestId: string, optionTestId: string) {
  const trigger = screen.getAllByTestId(triggerTestId).at(-1)
  if (!trigger) throw new Error(`Missing ${triggerTestId}`)
  act(() => {
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  })
  fireEvent.click(await screen.findByTestId(optionTestId))
}

function savedView(presentation: ViewFile['definition']['presentation']): ViewFile {
  return {
    filename: 'active-projects.yml',
    definition: { name: 'Active Projects', icon: null, color: null, sort: 'modified', listPropertiesDisplay: ['priority'], filters: { all: [] }, presentation },
  }
}

describe('collection layouts', () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({}))
  afterEach(() => vi.unstubAllGlobals())

  it('shows List by default and switches one collection to Kanban from the header menu', async () => {
    const rendered = render(<Harness />)
    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
    expect(screen.getByTestId('layout-menu-button')).toHaveAccessibleName('Layout: List')
    expect(screen.queryByTestId('group-by-menu-button')).not.toBeInTheDocument()

    await chooseMenuOption('layout-menu-button', 'layout-option-kanban')

    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    expect(screen.getByTestId('layout-menu-button')).toHaveAccessibleName('Layout: Kanban')
    expect(screen.getByTestId('group-by-menu-button')).toHaveAccessibleName('Group by status')
    expect(screen.getByTestId('group-by-menu-button')).not.toHaveTextContent(/\S/)

    rendered.rerender(<Harness selection={{ kind: 'filter', filter: 'archived' }} />)
    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })

  it('does not write layout files when a menu choice changes nothing', async () => {
    const saves = () => invoke.mock.calls.filter(([command]) => command === 'save_collection_layout_cmd')
    render(<Harness />)
    await chooseMenuOption('layout-menu-button', 'layout-option-list')
    expect(saves()).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    await chooseMenuOption('group-by-menu-button', 'group-by-option-status')

    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    expect(saves()).toHaveLength(1)
  })

  it('loads and saves non-View layout config through the owning vault', async () => {
    invoke.mockResolvedValueOnce({ 'builtin:all': { type: 'kanban', groupBy: 'status', properties: ['owner'] } })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('kanban-board')).toBeInTheDocument())
    expect(screen.getByTestId('card-fields')).toHaveTextContent('owner')

    await chooseMenuOption('group-by-menu-button', 'group-by-option-priority')

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('save_collection_layout_cmd', {
      vaultPath: '/vault',
      collection: 'builtin:all',
      presentation: { type: 'kanban', groupBy: 'priority', columnOrder: [], properties: ['owner'], collapsedColumns: [], hiddenColumns: [] },
    }))
  })

  it('saves collapsed and hidden columns in the vault layout file and restores them on reopen', async () => {
    invoke.mockResolvedValueOnce({ 'builtin:all': { type: 'kanban', groupBy: 'status', collapsedColumns: ['Done'] } })
    const first = render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-collapsed-columns', '["Done"]'))

    fireEvent.click(screen.getByText('toggle Doing collapsed'))
    fireEvent.click(screen.getByText('toggle No value hidden'))
    expect(trackEvent).toHaveBeenCalledWith('kanban_column_visibility_changed', { action: 'collapse' })
    expect(trackEvent).toHaveBeenCalledWith('kanban_column_visibility_changed', { action: 'hide' })

    const saved = { type: 'kanban', groupBy: 'status', columnOrder: [], properties: [], collapsedColumns: ['Done', 'Doing'], hiddenColumns: [''] }
    expect(invoke).toHaveBeenLastCalledWith('save_collection_layout_cmd', { vaultPath: '/vault', collection: 'builtin:all', presentation: saved })
    first.unmount()

    invoke.mockResolvedValueOnce({ 'builtin:all': saved })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-hidden-columns', '[""]'))
    expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-collapsed-columns', '["Done","Doing"]')
    fireEvent.click(screen.getByText('toggle No value hidden'))
    expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-hidden-columns', '[]')
    expect(trackEvent).toHaveBeenLastCalledWith('kanban_column_visibility_changed', { action: 'show' })
  })

  it('preserves Kanban View settings across repeated List and Kanban switches', async () => {
    const view = savedView({ type: 'kanban', groupBy: 'status', properties: ['owner'], columnOrder: ['Done', 'Doing'], collapsedColumns: ['Done'], hiddenColumns: [''] })
    const selection: SidebarSelection = { kind: 'view', filename: view.filename }
    let currentView = view
    const updateView = vi.fn((_filename: string, patch: Partial<ViewFile['definition']>) => {
      currentView = { ...currentView, definition: { ...currentView.definition, ...patch } }
    })
    const viewProps = () => ({
      selection,
      presentation: presentationFromViewDefinition(currentView.definition),
      views: [currentView],
      onUpdateViewDefinition: updateView,
    })

    const first = render(<Harness {...viewProps()} />)
    await chooseMenuOption('layout-menu-button', 'layout-option-list')
    expect(currentView.definition.presentation).toEqual(expect.objectContaining({
      type: 'list',
      properties: ['priority'],
      kanbanConfig: { groupBy: 'status', properties: ['owner'], columnOrder: ['Done', 'Doing'], collapsedColumns: ['Done'], hiddenColumns: [''] },
    }))
    first.unmount()

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const mount = render(<Harness {...viewProps()} />)
      await chooseMenuOption('layout-menu-button', 'layout-option-kanban')
      expect(screen.getByTestId('group-by-menu-button')).toHaveAccessibleName('Group by status')
      expect(screen.getByTestId('card-fields')).toHaveTextContent('owner')
      expect(currentView.definition.presentation).toEqual(expect.objectContaining({
        type: 'kanban', groupBy: 'status', properties: ['owner'], columnOrder: ['Done', 'Doing'], collapsedColumns: ['Done'], hiddenColumns: [''],
      }))
      await chooseMenuOption('layout-menu-button', 'layout-option-list')
      mount.unmount()
    }
  })

  it('uses list properties as card fields until the board has its own', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('card-fields')).toHaveTextContent('priority')
    fireEvent.click(screen.getByText('show owner on cards'))
    expect(screen.getByTestId('card-fields')).toHaveTextContent('owner')
    expect(invoke).toHaveBeenCalledWith('save_collection_layout_cmd', expect.objectContaining({
      presentation: expect.objectContaining({ type: 'kanban', properties: ['owner'] }),
    }))
  })

  it('switches layouts through the keyboard and command event', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('laputa:toggle-collection-layout')))

    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })

  it('keeps Neighborhood and Changes lists on List', () => {
    expect(supportsLayouts({ kind: 'entity', entry: alpha })).toBe(false)
    expect(supportsLayouts({ kind: 'filter', filter: 'changes' })).toBe(false)
    render(<Harness selection={{ kind: 'filter', filter: 'changes' }} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })

  it('starts Kanban with the editor panel closed and opens it for the clicked card', () => {
    const onOpen = vi.fn()
    const rendered = render(<Harness selectedNotePath="/vault/a.md" onOpen={onOpen} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'closed')

    fireEvent.click(screen.getByText('open first card'))
    expect(onOpen).toHaveBeenCalledWith(alpha)
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'open')

    fireEvent.click(screen.getByText('close panel'))
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'closed')

    rendered.rerender(<Harness selectedNotePath="/vault/b.md" onOpen={onOpen} />)
    expect(screen.getByTestId('layout-root')).toHaveAttribute('data-kanban-panel', 'open')
  })

  it('explains a missing group property and offers List instead', () => {
    render(<Harness visibleEntries={[makeEntry({ path: '/vault/x.md', title: 'X' })]} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('kanban-missing-property')).toHaveTextContent('No notes have a value for status')

    fireEvent.click(screen.getByRole('button', { name: 'Show as List' }))

    expect(screen.getByTestId('classic-list')).toBeInTheDocument()
  })

  it('moves a card through the frontmatter writer without changing the rest of the note', () => {
    const original = '---\ntitle: Alpha\nstatus: Doing\nowner: Ada\ntags:\n  - project\n---\n\nSee [[Roadmap|the roadmap]].\n'
    let persistedContent = original
    const updateEntry = vi.fn()
    const actionConfig: NoteActionsConfig = {
      addEntry: vi.fn(),
      removeEntry: vi.fn(),
      entries: [alpha],
      setToastMessage: vi.fn(),
      updateEntry,
      vaultPath: '/vault',
    }
    vi.stubGlobal('isTauri', true)
    invoke.mockImplementation(async (command, rawArgs) => {
      if (command !== 'update_frontmatter') return {}
      const args = rawArgs as { key: string; value: string | number | boolean | string[] | null }
      persistedContent = updateFrontmatterContent(persistedContent, args.key, args.value)
      return persistedContent
    })
    const { result } = renderHook(() => useNoteActions(actionConfig))
    render(<Harness onMove={(entry, key, value) => result.current.handleUpdateFrontmatter(entry.path, key, value)} />)
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    fireEvent.click(screen.getByText('drop first card in No value'))

    return waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('update_frontmatter', { path: '/vault/a.md', key: 'status', value: null })
      expect(updateEntry).toHaveBeenCalledWith('/vault/a.md', { status: null })
      expect(persistedContent).toBe('---\ntitle: Alpha\nstatus: null\nowner: Ada\ntags:\n  - project\n---\n\nSee [[Roadmap|the roadmap]].\n')
    })
  })
})
