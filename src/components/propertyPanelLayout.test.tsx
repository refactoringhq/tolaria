import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import { DynamicRelationshipsPanel } from './InspectorPanels'
import type { VaultEntry } from '../types'
import { TooltipProvider } from '@/components/ui/tooltip'

const entry: VaultEntry = {
  path: '/vault/note.md',
  filename: 'note.md',
  title: 'Note',
  isA: 'Project',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 0,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: false,
  outgoingLinks: [],
  sidebarLabel: null,
}

const personalWorkspace = {
  id: 'personal',
  label: 'Personal',
  alias: 'personal',
  path: '/personal',
  shortLabel: 'PE',
  color: 'green',
  icon: null,
  mounted: true,
  available: true,
  defaultForNewNotes: true,
}

const teamWorkspace = {
  id: 'team',
  label: 'Team',
  alias: 'team',
  path: '/team',
  shortLabel: 'TE',
  color: 'purple',
  icon: null,
  mounted: true,
  available: true,
  defaultForNewNotes: false,
}

function renderPropertiesPanel(props: ComponentProps<typeof DynamicPropertiesPanel>) {
  return render(
    <TooltipProvider>
      <DynamicPropertiesPanel {...props} />
    </TooltipProvider>,
  )
}

describe('property panel shared grid layout', () => {
  it('uses a shared fit-content column grid with subgridded rows', () => {
    renderPropertiesPanel({
      entry,
      frontmatter: { VeryLongPropertyName: 'Value', Status: 'Active' },
      onUpdateProperty: vi.fn(),
    })

    const typeRow = screen.getByTestId('type-selector')
    const layoutGrid = typeRow.parentElement

    expect(layoutGrid).not.toBeNull()
    expect(layoutGrid?.style.gridTemplateColumns).toBe('fit-content(50%) minmax(0, 1fr)')
    expect(typeRow.style.gridTemplateColumns).toBe('subgrid')
    expect(typeRow.style.gridColumn).toBe('1 / -1')

    screen.getAllByTestId('editable-property').forEach((row) => {
      expect(row.style.gridTemplateColumns).toBe('subgrid')
      expect(row.style.gridColumn).toBe('1 / -1')
    })
  })

  it('keeps suggested and add-property rows on the shared grid', () => {
    renderPropertiesPanel({
      entry,
      frontmatter: {},
      onAddProperty: vi.fn(),
    })

    screen.getAllByTestId('suggested-property').forEach((row) => {
      expect(row.style.gridTemplateColumns).toBe('subgrid')
      expect(row.style.gridColumn).toBe('1 / -1')
    })

    const row = screen.getByTestId('add-property-row')
    expect(row.style.gridTemplateColumns).toBe('subgrid')
    expect(row.style.gridColumn).toBe('1 / -1')
  })

  it('uses the same fixed icon slot size for metadata, suggested, and add-property rows', () => {
    renderPropertiesPanel({
      entry: { ...entry, workspace: personalWorkspace },
      frontmatter: {},
      onAddProperty: vi.fn(),
      onUpdateProperty: vi.fn(),
      onChangeWorkspace: vi.fn(),
      workspaces: [personalWorkspace, teamWorkspace],
    })

    expect(screen.getByTestId('workspace-row-icon-slot')).toHaveClass('size-5')
    expect(screen.getByTestId('type-row-icon-slot')).toHaveClass('size-5')
    screen.getAllByTestId('suggested-property-icon-slot').forEach((slot) => {
      expect(slot).toHaveClass('size-5')
    })
    expect(screen.getByTestId('add-property-icon-slot')).toHaveClass('size-5')
  })

  it('renders suggested-property labels in lighter placeholder text', () => {
    renderPropertiesPanel({
      entry,
      frontmatter: {},
      onAddProperty: vi.fn(),
    })

    expect(screen.getByText('Status').parentElement).toHaveClass('text-text-muted')
    expect(screen.getByText('Date').parentElement).toHaveClass('text-text-muted')
  })

  it('renders the add-property row in lighter placeholder text', () => {
    renderPropertiesPanel({
      entry,
      frontmatter: {},
      onAddProperty: vi.fn(),
    })

    expect(screen.getByText('Add property').parentElement).toHaveClass('text-text-muted')
  })

  it('renders plain text values flush with the shared value column', () => {
    renderPropertiesPanel({
      entry,
      frontmatter: { Owner: 'Luca' },
      onUpdateProperty: vi.fn(),
    })

    expect(screen.getByText('Luca').parentElement).toHaveClass('px-0')
  })

  it('renders relationship groups as single-column stacks', () => {
    const relatedEntry: VaultEntry = {
      ...entry,
      path: '/vault/project-alpha.md',
      filename: 'project-alpha.md',
      title: 'Project Alpha',
      isA: 'Project',
    }

    render(
      <DynamicRelationshipsPanel
        frontmatter={{ 'Belongs to': '[[Project Alpha]]' }}
        entries={[relatedEntry]}
        typeEntryMap={{}}
        onNavigate={vi.fn()}
      />
    )

    const relationshipRow = screen.getByTestId('relationship-section-label').parentElement

    expect(relationshipRow).not.toBeNull()
    expect(relationshipRow).toHaveClass('flex-col')
    expect(relationshipRow).toHaveStyle({ gridColumn: '1 / -1' })
  })
})
