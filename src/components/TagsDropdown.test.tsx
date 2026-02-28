import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagPill, TagsDropdown } from './TagsDropdown'

describe('TagPill', () => {
  it('renders tag text', () => {
    render(<TagPill tag="React" />)
    const pill = screen.getByTitle('React')
    expect(pill).toBeInTheDocument()
    expect(pill.textContent).toBe('React')
  })

  it('renders with default style (blue)', () => {
    render(<TagPill tag="Unknown" />)
    const pill = screen.getByTitle('Unknown')
    expect(pill.style.backgroundColor).toBe('var(--accent-blue-light)')
    expect(pill.style.color).toBe('var(--accent-blue)')
  })

  it('applies truncate for long names', () => {
    render(<TagPill tag="Very Long Tag Name That Should Truncate" />)
    const pill = screen.getByTitle('Very Long Tag Name That Should Truncate')
    expect(pill.className).toContain('truncate')
  })
})

describe('TagsDropdown', () => {
  const onToggle = vi.fn()
  const onClose = vi.fn()

  const defaultProps = {
    selectedTags: ['React', 'Tauri'],
    vaultTags: ['React', 'TypeScript', 'Tauri', 'Vite'],
    onToggle,
    onClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dropdown with search input', () => {
    render(<TagsDropdown {...defaultProps} />)
    expect(screen.getByTestId('tags-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('tags-search-input')).toBeInTheDocument()
  })

  it('shows vault tags as options', () => {
    render(<TagsDropdown {...defaultProps} />)
    expect(screen.getByTestId('tag-option-React')).toBeInTheDocument()
    expect(screen.getByTestId('tag-option-TypeScript')).toBeInTheDocument()
    expect(screen.getByTestId('tag-option-Tauri')).toBeInTheDocument()
    expect(screen.getByTestId('tag-option-Vite')).toBeInTheDocument()
  })

  it('shows "From vault" section label', () => {
    render(<TagsDropdown {...defaultProps} />)
    expect(screen.getByText('From vault')).toBeInTheDocument()
  })

  it('shows checkmark for selected tags', () => {
    render(<TagsDropdown {...defaultProps} />)
    // React and Tauri are selected — their check marks should show
    const reactOption = screen.getByTestId('tag-option-React').closest('div')!
    const checkSpans = reactOption.querySelectorAll('span')
    const hasCheck = Array.from(checkSpans).some(s => s.textContent === '\u2713')
    expect(hasCheck).toBe(true)
  })

  it('calls onToggle when a tag option is clicked', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('tag-option-TypeScript'))
    expect(onToggle).toHaveBeenCalledWith('TypeScript')
  })

  it('calls onClose when backdrop is clicked', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('tags-dropdown-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('filters tags by search query', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.change(screen.getByTestId('tags-search-input'), { target: { value: 'type' } })
    expect(screen.getByTestId('tag-option-TypeScript')).toBeInTheDocument()
    expect(screen.queryByTestId('tag-option-Vite')).not.toBeInTheDocument()
  })

  it('shows "Create" option when query does not match any vault tag', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.change(screen.getByTestId('tags-search-input'), { target: { value: 'NewTag' } })
    expect(screen.getByTestId('tag-create-option')).toBeInTheDocument()
    expect(screen.getByTestId('tag-create-option').textContent).toContain('Create')
    expect(screen.getByTestId('tag-create-option').textContent).toContain('NewTag')
  })

  it('does not show create option when query matches an existing tag (case-insensitive)', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.change(screen.getByTestId('tags-search-input'), { target: { value: 'react' } })
    expect(screen.queryByTestId('tag-create-option')).not.toBeInTheDocument()
  })

  it('calls onToggle with new tag name when Create option is clicked', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.change(screen.getByTestId('tags-search-input'), { target: { value: 'Flutter' } })
    fireEvent.click(screen.getByTestId('tag-create-option'))
    expect(onToggle).toHaveBeenCalledWith('Flutter')
  })

  it('shows "No matching tags" when filter yields no results and query is empty-ish', () => {
    render(<TagsDropdown {...defaultProps} vaultTags={[]} />)
    expect(screen.getByText('No matching tags')).toBeInTheDocument()
  })

  it('shows color swatch for each tag option', () => {
    render(<TagsDropdown {...defaultProps} />)
    expect(screen.getByTestId('tag-color-swatch-React')).toBeInTheDocument()
    expect(screen.getByTestId('tag-color-swatch-TypeScript')).toBeInTheDocument()
  })

  it('opens color picker when color swatch is clicked', () => {
    render(<TagsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByTestId('tag-color-swatch-React'))
    expect(screen.getByTestId('tag-color-picker-React')).toBeInTheDocument()
  })

  it('navigates options with arrow keys', () => {
    render(<TagsDropdown {...defaultProps} />)
    const input = screen.getByTestId('tags-search-input')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledWith('React')
  })

  it('closes dropdown on Escape key', () => {
    render(<TagsDropdown {...defaultProps} />)
    const input = screen.getByTestId('tags-search-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('creates new tag on Enter when query is typed and no highlight', () => {
    render(<TagsDropdown {...defaultProps} />)
    const input = screen.getByTestId('tags-search-input')
    fireEvent.change(input, { target: { value: 'Brand New' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledWith('Brand New')
  })
})
