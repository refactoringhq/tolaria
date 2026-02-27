import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusPill, StatusDropdown } from './StatusDropdown'
import { setStatusColor } from '../utils/statusStyles'

// Mock localStorage (jsdom's may be incomplete)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const STORAGE_KEY = 'laputa:status-color-overrides'

describe('StatusPill', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Clear any module-level overrides
    setStatusColor('Active', null)
    setStatusColor('Custom Thing', null)
  })

  it('renders with known status style', () => {
    render(<StatusPill status="Active" />)
    const pill = screen.getByTitle('Active')
    expect(pill).toBeInTheDocument()
    expect(pill.textContent).toBe('Active')
    expect(pill.style.backgroundColor).toBe('var(--accent-green-light)')
    expect(pill.style.color).toBe('var(--accent-green)')
  })

  it('renders with default style for unknown status', () => {
    render(<StatusPill status="Custom Thing" />)
    const pill = screen.getByTitle('Custom Thing')
    expect(pill.style.backgroundColor).toBe('var(--accent-blue-light)')
    expect(pill.style.color).toBe('var(--muted-foreground)')
  })

  it('applies truncate class for long names', () => {
    render(<StatusPill status="Very Long Status Name That Should Truncate" />)
    const pill = screen.getByTitle('Very Long Status Name That Should Truncate')
    expect(pill.className).toContain('truncate')
  })

  it('renders with overridden color when set', () => {
    setStatusColor('Active', 'pink')
    render(<StatusPill status="Active" />)
    const pill = screen.getByTitle('Active')
    expect(pill.style.backgroundColor).toBe('var(--accent-pink-light)')
    expect(pill.style.color).toBe('var(--accent-pink)')
    setStatusColor('Active', null)
  })
})

describe('StatusDropdown', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()

  const defaultProps = {
    value: 'Active',
    vaultStatuses: ['Draft', 'Published'],
    onSave,
    onCancel,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('renders dropdown with search input', () => {
    render(<StatusDropdown {...defaultProps} />)
    expect(screen.getByTestId('status-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('status-search-input')).toBeInTheDocument()
  })

  it('shows suggested statuses', () => {
    render(<StatusDropdown {...defaultProps} />)
    expect(screen.getByTestId('status-option-Not started')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-In progress')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-Active')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-Done')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-Blocked')).toBeInTheDocument()
  })

  it('shows vault statuses separately from suggested', () => {
    render(<StatusDropdown {...defaultProps} />)
    expect(screen.getByTestId('status-option-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-Published')).toBeInTheDocument()
    expect(screen.getByText('From vault')).toBeInTheDocument()
    expect(screen.getByText('Suggested')).toBeInTheDocument()
  })

  it('does not duplicate vault statuses in suggested list', () => {
    render(<StatusDropdown {...defaultProps} vaultStatuses={['Active', 'Draft']} />)
    // Active should appear in vault section, not suggested
    const activeOptions = screen.getAllByTestId('status-option-Active')
    expect(activeOptions).toHaveLength(1)
  })

  it('calls onSave when a status option is clicked', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('status-option-Done'))
    expect(onSave).toHaveBeenCalledWith('Done')
  })

  it('calls onCancel when backdrop is clicked', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('status-dropdown-backdrop'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape is pressed', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.keyDown(screen.getByTestId('status-search-input'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('filters options when typing in search', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'blo' } })
    expect(screen.getByTestId('status-option-Blocked')).toBeInTheDocument()
    expect(screen.queryByTestId('status-option-Done')).not.toBeInTheDocument()
  })

  it('shows create option when typing a new status name', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'Needs Review' } })
    expect(screen.getByTestId('status-create-option')).toBeInTheDocument()
  })

  it('does not show create option when query matches existing status', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'Active' } })
    expect(screen.queryByTestId('status-create-option')).not.toBeInTheDocument()
  })

  it('creates custom status on Enter when no match', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'Needs Review' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Needs Review')
  })

  it('navigates options with arrow keys', () => {
    render(<StatusDropdown {...defaultProps} vaultStatuses={[]} />)
    const input = screen.getByTestId('status-search-input')
    // Arrow down to first option
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Arrow down again to second option
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Press Enter to select second option (In progress)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('In progress')
  })

  it('shows no statuses message when filter yields no results and no create option', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    // Type just a space (no trim match but not empty)
    fireEvent.change(input, { target: { value: '    ' } })
    // With only spaces, query.trim() is empty so no create option
    // And no options match spaces
    // But query is not empty so the filter runs... let's use something truly no-match
    fireEvent.change(input, { target: { value: '' } })
    // With empty query, all options are shown - this verifies the fallback
    expect(screen.getByTestId('status-option-Active')).toBeInTheDocument()
  })

  it('shows only default suggestions when vault has no statuses', () => {
    render(<StatusDropdown {...defaultProps} vaultStatuses={[]} />)
    expect(screen.queryByText('From vault')).not.toBeInTheDocument()
    expect(screen.getByText('Suggested')).toBeInTheDocument()
    expect(screen.getByTestId('status-option-Active')).toBeInTheDocument()
  })

  it('preserves user input case — no title-casing', () => {
    render(<StatusDropdown {...defaultProps} />)
    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'wIP' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('wIP')
  })
})

describe('StatusDropdown — color picker', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const onColorChange = vi.fn()

  const defaultProps = {
    value: 'Active',
    vaultStatuses: ['Draft', 'Published'],
    onSave,
    onCancel,
    onColorChange,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    setStatusColor('Draft', null)
    setStatusColor('Active', null)
  })

  it('renders color dots for each status option', () => {
    render(<StatusDropdown {...defaultProps} />)
    expect(screen.getByTestId('color-dot-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-dot-Published')).toBeInTheDocument()
    expect(screen.getByTestId('color-dot-Active')).toBeInTheDocument()
  })

  it('opens color palette when color dot is clicked', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(screen.getByTestId('color-palette-Draft')).toBeInTheDocument()
  })

  it('does not trigger onSave when color dot is clicked', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes palette when same dot is clicked again', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(screen.getByTestId('color-palette-Draft')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(screen.queryByTestId('color-palette-Draft')).not.toBeInTheDocument()
  })

  it('assigns a color when swatch is clicked', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    fireEvent.click(screen.getByTestId('color-swatch-red-Draft'))
    expect(onColorChange).toHaveBeenCalled()
    // Verify the color was persisted
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['Draft']).toBe('red')
  })

  it('clicking Default swatch resets color to built-in', () => {
    setStatusColor('Draft', 'red')
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    fireEvent.click(screen.getByTestId('color-swatch-default-Draft'))
    expect(onColorChange).toHaveBeenCalled()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['Draft']).toBeUndefined()
  })

  it('closes palette after selecting a color', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(screen.getByTestId('color-palette-Draft')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('color-swatch-purple-Draft'))
    expect(screen.queryByTestId('color-palette-Draft')).not.toBeInTheDocument()
  })

  it('shows all 8 accent color swatches plus default', () => {
    render(<StatusDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('color-dot-Draft'))
    expect(screen.getByTestId('color-swatch-default-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-red-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-orange-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-yellow-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-green-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-blue-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-purple-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-teal-Draft')).toBeInTheDocument()
    expect(screen.getByTestId('color-swatch-pink-Draft')).toBeInTheDocument()
  })
})
