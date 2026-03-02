import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DynamicPropertiesPanel, containsWikilinks } from './DynamicPropertiesPanel'
import type { VaultEntry } from '../types'

// Mock localStorage (jsdom's may be incomplete)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Radix Select needs ResizeObserver and pointer/scroll APIs in JSDOM
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  // Radix Popover needs getComputedStyle in JSDOM
  if (!window.getComputedStyle) window.getComputedStyle = vi.fn().mockReturnValue({}) as never
})

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
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
  template: null,
  outgoingLinks: [],
  ...overrides,
})

describe('containsWikilinks', () => {
  it('returns true for string wikilinks', () => {
    expect(containsWikilinks('[[My Note]]')).toBe(true)
  })

  it('returns false for non-wikilink strings', () => {
    expect(containsWikilinks('plain text')).toBe(false)
  })

  it('returns true for arrays containing wikilinks', () => {
    expect(containsWikilinks(['[[Note1]]', '[[Note2]]'])).toBe(true)
  })

  it('returns false for arrays without wikilinks', () => {
    expect(containsWikilinks(['tag1', 'tag2'])).toBe(false)
  })

  it('returns false for booleans', () => {
    expect(containsWikilinks(true)).toBe(false)
  })

  it('returns false for null', () => {
    expect(containsWikilinks(null)).toBe(false)
  })
})

describe('DynamicPropertiesPanel', () => {
  const onUpdateProperty = vi.fn()
  const onDeleteProperty = vi.fn()
  const onAddProperty = vi.fn()
  const onNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders type row', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content="# Test\n\nSome words here"
        frontmatter={{ Status: 'Active' }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('renders word count', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content="---\ntitle: Test\n---\nOne two three four"
        frontmatter={{}}
      />
    )
    expect(screen.getByText('Words')).toBeInTheDocument()
  })

  it('renders status as colored pill', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ Status: 'Active' }}
      />
    )
    // Status rendered with CSS text-transform: uppercase, DOM text is still "Active"
    expect(screen.getByTitle('Active')).toBeInTheDocument()
  })

  it('renders properties from frontmatter', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ cadence: 'Weekly', owner: 'Luca' }}
      />
    )
    expect(screen.getByText('cadence')).toBeInTheDocument()
    expect(screen.getByText('Weekly')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('Luca')).toBeInTheDocument()
  })

  it('skips aliases and relationship keys', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ aliases: ['AL'], 'Belongs to': '[[Something]]', cadence: 'Monthly' }}
      />
    )
    // aliases and "Belongs to" should be skipped
    expect(screen.queryByText('aliases')).not.toBeInTheDocument()
    expect(screen.queryByText('Belongs to')).not.toBeInTheDocument()
    expect(screen.getByText('cadence')).toBeInTheDocument()
  })

  it('skips is_a, Is A, and type keys (shown via TypeRow instead)', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ is_a: 'Note', type: 'Note', 'Is A': 'Note', Status: 'Active' }}
      />
    )
    expect(screen.queryByText('is_a')).not.toBeInTheDocument()
    expect(screen.queryByText('Is A')).not.toBeInTheDocument()
    // 'type' as a property label should not appear (the TypeRow renders 'Type' differently)
    const typeLabels = screen.getAllByText('Type')
    // Only the TypeRow label should exist, not a property row
    expect(typeLabels).toHaveLength(1)
    expect(screen.getByTitle('Active')).toBeInTheDocument()
  })

  it('renders boolean property as toggle', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ archived: false }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    // Boolean should show as Yes/No toggle
    const toggleBtn = screen.getByText('\u2717 No')
    fireEvent.click(toggleBtn)
    expect(onUpdateProperty).toHaveBeenCalledWith('archived', true)
  })

  it('renders array property as tag pills', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ tags: ['ai', 'ml', 'deep-learning'] }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    expect(screen.getByText('ai')).toBeInTheDocument()
    expect(screen.getByText('ml')).toBeInTheDocument()
    expect(screen.getByText('deep-learning')).toBeInTheDocument()
  })

  it('shows Add property button', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    expect(screen.getByText('+ Add property')).toBeInTheDocument()
  })

  it('opens add property form when button clicked', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    expect(screen.getByPlaceholderText('Property name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Value')).toBeInTheDocument()
    expect(screen.getByTestId('add-property-type-trigger')).toBeInTheDocument()
  })

  it('adds property via the add form', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    const keyInput = screen.getByPlaceholderText('Property name')
    const valueInput = screen.getByPlaceholderText('Value')
    fireEvent.change(keyInput, { target: { value: 'priority' } })
    fireEvent.change(valueInput, { target: { value: 'high' } })
    fireEvent.click(screen.getByTestId('add-property-confirm'))
    expect(onAddProperty).toHaveBeenCalledWith('priority', 'high')
  })

  it('handles navigating to type via click in read-only mode', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry({ isA: 'Project' })}
        content=""
        frontmatter={{}}
        onNavigate={onNavigate}
      />
    )
    fireEvent.click(screen.getByText('Project'))
    expect(onNavigate).toHaveBeenCalledWith('type/project')
  })

  describe('TypeSelector', () => {
    const typeEntries = [
      makeEntry({ path: '/vault/type/project.md', title: 'Project', isA: 'Type' }),
      makeEntry({ path: '/vault/type/person.md', title: 'Person', isA: 'Type' }),
      makeEntry({ path: '/vault/type/topic.md', title: 'Topic', isA: 'Type' }),
    ]

    it('renders as dropdown when editable', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('type-selector')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('shows available types in dropdown', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, pointerType: 'mouse' })
      expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Person' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Project' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Topic' })).toBeInTheDocument()
    })

    function openAndSelect(optionName: string) {
      fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: optionName }))
    }

    it('calls onUpdateProperty when type selected', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      openAndSelect('Project')
      expect(onUpdateProperty).toHaveBeenCalledWith('type', 'Project')
    })

    it('clears type when None selected', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ isA: 'Project' })} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      openAndSelect('None')
      expect(onUpdateProperty).toHaveBeenCalledWith('type', null)
    })

    it('shows current type even when not in available types', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ isA: 'CustomType' })} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, pointerType: 'mouse' })
      expect(screen.getByRole('option', { name: 'CustomType' })).toBeInTheDocument()
    })

    it('shows None placeholder when entry has no type', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ isA: null })} content="" frontmatter={{}}
          entries={typeEntries} onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('type-selector')).toBeInTheDocument()
      expect(screen.getByText('None')).toBeInTheDocument()
    })
  })

  it('renders modified date', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry({ modifiedAt: 1700000000 })}
        content=""
        frontmatter={{}}
      />
    )
    expect(screen.getByText('Modified')).toBeInTheDocument()
  })

  it('opens status dropdown on click and selects a status', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ Status: 'Active' }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    // Click status pill to open dropdown
    fireEvent.click(screen.getByTitle('Active'))
    // Should show dropdown with search input
    expect(screen.getByTestId('status-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('status-search-input')).toBeInTheDocument()
    // Click on "Done" option in the suggested list
    fireEvent.click(screen.getByTestId('status-option-Done'))
    expect(onUpdateProperty).toHaveBeenCalledWith('Status', 'Done')
  })

  it('deletes property when delete button clicked', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ custom_field: 'value' }}
        onDeleteProperty={onDeleteProperty}
        onUpdateProperty={onUpdateProperty}
      />
    )
    const deleteBtn = screen.getByTitle('Delete property')
    fireEvent.click(deleteBtn)
    expect(onDeleteProperty).toHaveBeenCalledWith('custom_field')
  })

  it('coerces true/false strings to booleans on save', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ archived: 'false' }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    // Edit the value
    fireEvent.click(screen.getByText('false'))
    const input = screen.getByDisplayValue('false')
    fireEvent.change(input, { target: { value: 'true' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onUpdateProperty).toHaveBeenCalledWith('archived', true)
  })

  it('coerces numeric strings to numbers on save', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{ order: '3' }}
        onUpdateProperty={onUpdateProperty}
      />
    )
    fireEvent.click(screen.getByText('3'))
    const input = screen.getByDisplayValue('3')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onUpdateProperty).toHaveBeenCalledWith('order', 5)
  })

  it('cancels add form on Escape', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    const keyInput = screen.getByPlaceholderText('Property name')
    fireEvent.keyDown(keyInput, { key: 'Escape' })
    // Form should be hidden, button should reappear
    expect(screen.getByText('+ Add property')).toBeInTheDocument()
  })

  it('adds property on Enter in form', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    const keyInput = screen.getByPlaceholderText('Property name')
    const valueInput = screen.getByPlaceholderText('Value')
    fireEvent.change(keyInput, { target: { value: 'key' } })
    fireEvent.change(valueInput, { target: { value: 'val' } })
    fireEvent.keyDown(valueInput, { key: 'Enter' })
    expect(onAddProperty).toHaveBeenCalledWith('key', 'val')
  })

  it('handles comma-separated values as array', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    const keyInput = screen.getByPlaceholderText('Property name')
    const valueInput = screen.getByPlaceholderText('Value')
    fireEvent.change(keyInput, { target: { value: 'tags' } })
    fireEvent.change(valueInput, { target: { value: 'a, b, c' } })
    fireEvent.keyDown(valueInput, { key: 'Enter' })
    expect(onAddProperty).toHaveBeenCalledWith('tags', ['a', 'b', 'c'])
  })

  it('handles cancel button in add form', () => {
    render(
      <DynamicPropertiesPanel
        entry={makeEntry()}
        content=""
        frontmatter={{}}
        onAddProperty={onAddProperty}
      />
    )
    fireEvent.click(screen.getByText('+ Add property'))
    fireEvent.click(screen.getByTestId('add-property-cancel'))
    expect(screen.getByText('+ Add property')).toBeInTheDocument()
  })

  describe('editable vs read-only distinction', () => {
    it('renders Info section header', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
        />
      )
      expect(screen.getByText('Info')).toBeInTheDocument()
    })

    it('renders Modified and Words in read-only Info section', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ modifiedAt: 1700000000 })}
          content="---\ntitle: Test\n---\nOne two three"
          frontmatter={{}}
        />
      )
      const readOnlyRows = screen.getAllByTestId('readonly-property')
      const labels = readOnlyRows.map(row => row.querySelector('span')?.textContent)
      expect(labels).toContain('Modified')
      expect(labels).toContain('Words')
    })

    it('renders Created date in Info section', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ createdAt: 1700000000 })}
          content=""
          frontmatter={{}}
        />
      )
      const readOnlyRows = screen.getAllByTestId('readonly-property')
      const labels = readOnlyRows.map(row => row.querySelector('span')?.textContent)
      expect(labels).toContain('Created')
    })

    it('renders file size in Info section', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ fileSize: 4300 })}
          content=""
          frontmatter={{}}
        />
      )
      expect(screen.getByText('Size')).toBeInTheDocument()
      expect(screen.getByText('4.2 KB')).toBeInTheDocument()
    })

    it('shows em dash for null timestamps in Info section', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry({ modifiedAt: null, createdAt: null })}
          content=""
          frontmatter={{}}
        />
      )
      // Two em dashes for null Modified and Created
      const dashes = screen.getAllByText('\u2014')
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })

    it('editable properties have hover styling via data-testid', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly', owner: 'Luca' }}
          onUpdateProperty={onUpdateProperty}
          onDeleteProperty={onDeleteProperty}
        />
      )
      const editableRows = screen.getAllByTestId('editable-property')
      expect(editableRows.length).toBe(2)
      // Editable rows have hover:bg-muted class for interactivity
      editableRows.forEach(row => {
        expect(row.className).toContain('hover:bg-muted')
      })
    })

    it('read-only rows do not have hover styling', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
        />
      )
      const readOnlyRows = screen.getAllByTestId('readonly-property')
      readOnlyRows.forEach(row => {
        expect(row.className).not.toContain('hover:bg-muted')
      })
    })

    it('formats file sizes correctly', () => {
      // Small file — bytes
      const { rerender } = render(
        <DynamicPropertiesPanel
          entry={makeEntry({ fileSize: 500 })}
          content=""
          frontmatter={{}}
        />
      )
      expect(screen.getByText('500 B')).toBeInTheDocument()

      // KB range
      rerender(
        <DynamicPropertiesPanel
          entry={makeEntry({ fileSize: 2048 })}
          content=""
          frontmatter={{}}
        />
      )
      expect(screen.getByText('2.0 KB')).toBeInTheDocument()

      // MB range
      rerender(
        <DynamicPropertiesPanel
          entry={makeEntry({ fileSize: 1048576 })}
          content=""
          frontmatter={{}}
        />
      )
      expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    })
  })

  describe('URL property rendering', () => {
    it('renders URL values with link styling instead of plain EditableValue', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ url: 'https://example.com' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('url-link')).toBeInTheDocument()
      expect(screen.getByTestId('url-link')).toHaveTextContent('https://example.com')
    })

    it('renders bare domain values as URL links', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ website: 'example.com' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('url-link')).toBeInTheDocument()
    })

    it('does not render plain text as URL link', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.queryByTestId('url-link')).not.toBeInTheDocument()
    })

    it('shows edit button on URL property', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ url: 'https://example.com' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('url-edit-btn')).toBeInTheDocument()
    })

    it('enters edit mode when edit button clicked on URL property', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ url: 'https://example.com' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTestId('url-edit-btn'))
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    })
  })

  describe('smart property display — date', () => {
    it('renders date property with friendly format', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ deadline: '2026-03-31' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('date-display')).toBeInTheDocument()
      expect(screen.getByText('Mar 31, 2026')).toBeInTheDocument()
    })

    it('renders calendar icon in date trigger button', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ deadline: '2026-03-31' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      const trigger = screen.getByTestId('date-display')
      expect(trigger.tagName).toBe('BUTTON')
      expect(trigger.querySelector('svg')).toBeInTheDocument()
    })

    it('opens calendar popover when date button clicked', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ deadline: '2026-03-31' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTestId('date-display'))
      expect(screen.getByTestId('date-picker-popover')).toBeInTheDocument()
      // Clear button is inside the popover portal
      expect(screen.getByText('Clear date')).toBeInTheDocument()
    })
  })

  describe('smart property display — status auto-detection', () => {
    it('renders status badge for property named Status', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ Status: 'Active' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
    })

    it('renders status badge for known status values', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ phase: 'Draft' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
    })
  })

  describe('status dropdown interaction', () => {
    it('closes dropdown on Escape without saving', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ Status: 'Active' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTitle('Active'))
      expect(screen.getByTestId('status-dropdown')).toBeInTheDocument()
      fireEvent.keyDown(screen.getByTestId('status-search-input'), { key: 'Escape' })
      expect(screen.queryByTestId('status-dropdown')).not.toBeInTheDocument()
      expect(onUpdateProperty).not.toHaveBeenCalled()
    })

    it('closes dropdown on backdrop click without saving', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ Status: 'Active' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTitle('Active'))
      fireEvent.click(screen.getByTestId('status-dropdown-backdrop'))
      expect(screen.queryByTestId('status-dropdown')).not.toBeInTheDocument()
      expect(onUpdateProperty).not.toHaveBeenCalled()
    })

    it('creates custom status by typing and pressing Enter', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ Status: 'Active' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTitle('Active'))
      const input = screen.getByTestId('status-search-input')
      fireEvent.change(input, { target: { value: 'Needs Review' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdateProperty).toHaveBeenCalledWith('Status', 'Needs Review')
    })

    it('shows vault statuses from entries', () => {
      const entriesWithStatuses = [
        makeEntry({ path: '/vault/a.md', status: 'Reviewing' }),
        makeEntry({ path: '/vault/b.md', status: 'Shipped' }),
      ]
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ Status: 'Active' }}
          entries={entriesWithStatuses}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTitle('Active'))
      expect(screen.getByTestId('status-option-Reviewing')).toBeInTheDocument()
      expect(screen.getByTestId('status-option-Shipped')).toBeInTheDocument()
    })
  })

  describe('smart property display — boolean', () => {
    it('renders boolean toggle for true values', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ published: true }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('boolean-toggle')).toBeInTheDocument()
      expect(screen.getByText('\u2713 Yes')).toBeInTheDocument()
    })

    it('renders boolean toggle for false values', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ archived: false }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('boolean-toggle')).toBeInTheDocument()
      expect(screen.getByText('\u2717 No')).toBeInTheDocument()
    })
  })

  describe('display mode override', () => {
    beforeEach(() => {
      localStorageMock.clear()
    })

    it('renders display mode trigger on property rows', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('display-mode-trigger')).toBeInTheDocument()
    })

    it('opens display mode menu on trigger click', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTestId('display-mode-trigger'))
      expect(screen.getByTestId('display-mode-menu')).toBeInTheDocument()
      expect(screen.getByTestId('display-mode-option-text')).toBeInTheDocument()
      expect(screen.getByTestId('display-mode-option-date')).toBeInTheDocument()
      expect(screen.getByTestId('display-mode-option-boolean')).toBeInTheDocument()
      expect(screen.getByTestId('display-mode-option-status')).toBeInTheDocument()
      expect(screen.getByTestId('display-mode-option-url')).toBeInTheDocument()
    })

    it('persists override to localStorage when mode selected', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTestId('display-mode-trigger'))
      fireEvent.click(screen.getByTestId('display-mode-option-status'))
      const stored = JSON.parse(localStorageMock.getItem('laputa:display-mode-overrides') ?? '{}')
      expect(stored.cadence).toBe('status')
    })

    it('overrides rendering to status badge when status mode selected', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ cadence: 'status' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ cadence: 'Weekly' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
    })

    it('renders boolean toggle for string "true" when boolean mode overridden', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ draft: 'boolean' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ draft: 'true' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('boolean-toggle')).toBeInTheDocument()
      expect(screen.getByText('\u2713 Yes')).toBeInTheDocument()
    })

    it('renders boolean toggle for string "false" when boolean mode overridden', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ draft: 'boolean' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ draft: 'false' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('boolean-toggle')).toBeInTheDocument()
      expect(screen.getByText('\u2717 No')).toBeInTheDocument()
    })

    it('toggles string boolean from false to true', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ draft: 'boolean' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ draft: 'false' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      fireEvent.click(screen.getByTestId('boolean-toggle'))
      expect(onUpdateProperty).toHaveBeenCalledWith('draft', true)
    })

    it('renders date picker for empty value when date mode overridden', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ due: 'date' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ due: '' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('date-display')).toBeInTheDocument()
      expect(screen.getByText('Pick a date\u2026')).toBeInTheDocument()
    })

    it('renders date picker for non-date string when date mode overridden', () => {
      localStorageMock.setItem('laputa:display-mode-overrides', JSON.stringify({ deadline: 'date' }))
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{ deadline: 'soon' }}
          onUpdateProperty={onUpdateProperty}
        />
      )
      expect(screen.getByTestId('date-display')).toBeInTheDocument()
    })
  })

  describe('type-aware add property form', () => {
    it('shows boolean toggle when boolean type selected', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      // Switch type to boolean
      fireEvent.pointerDown(screen.getByTestId('add-property-type-trigger'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: /Boolean/ }))
      expect(screen.getByTestId('add-property-boolean-toggle')).toBeInTheDocument()
      expect(screen.getByText('\u2717 No')).toBeInTheDocument()
    })

    it('toggles boolean value in add form', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      fireEvent.pointerDown(screen.getByTestId('add-property-type-trigger'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: /Boolean/ }))
      // Toggle from No to Yes
      fireEvent.click(screen.getByTestId('add-property-boolean-toggle'))
      expect(screen.getByText('\u2713 Yes')).toBeInTheDocument()
    })

    it('stores actual boolean value when adding boolean property', { timeout: 15_000 }, () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      const keyInput = screen.getByPlaceholderText('Property name')
      fireEvent.change(keyInput, { target: { value: 'published' } })
      // Switch to boolean type
      fireEvent.pointerDown(screen.getByTestId('add-property-type-trigger'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: /Boolean/ }))
      // Default is false, toggle to true
      fireEvent.click(screen.getByTestId('add-property-boolean-toggle'))
      // Submit
      fireEvent.click(screen.getByTestId('add-property-confirm'))
      expect(onAddProperty).toHaveBeenCalledWith('published', true)
    })

    it('shows date picker trigger when date type selected', { timeout: 15_000 }, () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      fireEvent.pointerDown(screen.getByTestId('add-property-type-trigger'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: /Date/ }))
      expect(screen.getByTestId('add-property-date-trigger')).toBeInTheDocument()
      expect(screen.getByText('Pick a date\u2026')).toBeInTheDocument()
    })

    it('shows status dropdown when status type selected', { timeout: 15_000 }, () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      fireEvent.pointerDown(screen.getByTestId('add-property-type-trigger'), { button: 0, pointerType: 'mouse' })
      fireEvent.click(screen.getByRole('option', { name: /Status/ }))
      expect(screen.getByTestId('add-property-status-trigger')).toBeInTheDocument()
    })

    it('shows text input for text and url types', () => {
      render(
        <DynamicPropertiesPanel
          entry={makeEntry()}
          content=""
          frontmatter={{}}
          onAddProperty={onAddProperty}
        />
      )
      fireEvent.click(screen.getByText('+ Add property'))
      // Default mode is text
      expect(screen.getByPlaceholderText('Value')).toBeInTheDocument()
    })
  })
})
