import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableValue, TagPillList, UrlValue } from './EditableValue'
import { isUrlValue, normalizeUrl } from '../utils/url'

vi.mock('../utils/url', async () => {
  const actual = await vi.importActual('../utils/url')
  return { ...actual, openExternalUrl: vi.fn().mockResolvedValue(undefined) }
})

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & { openExternalUrl: ReturnType<typeof vi.fn> }

describe('EditableValue', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const onStartEdit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays value text in view mode', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('displays em-dash when value is empty', () => {
    render(<EditableValue value="" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    expect(screen.getByText('\u2014')).toBeInTheDocument()
  })

  it('calls onStartEdit when clicked in view mode', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByText('Active'))
    expect(onStartEdit).toHaveBeenCalled()
  })

  it('uses a full-width truncating layout in view mode', () => {
    render(<EditableValue value="A very long property value" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    const value = screen.getByText('A very long property value')
    expect(value.parentElement).toHaveClass('w-full', 'overflow-hidden')
    expect(value).toHaveClass('truncate')
  })

  it('shows input in editing mode', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('Active')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('calls onSave when Enter is pressed', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('Active')
    fireEvent.change(input, { target: { value: 'Done' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Done')
  })

  it('calls onCancel and resets when Escape is pressed', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('Active')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSave on blur', () => {
    render(<EditableValue value="Active" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('Active')
    fireEvent.change(input, { target: { value: 'Paused' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith('Paused')
  })
})

describe('TagPillList', () => {
  const onSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all items as pills', () => {
    render(<TagPillList items={['Tag1', 'Tag2', 'Tag3']} onSave={onSave} label="Tags" />)
    expect(screen.getByText('Tag1')).toBeInTheDocument()
    expect(screen.getByText('Tag2')).toBeInTheDocument()
    expect(screen.getByText('Tag3')).toBeInTheDocument()
  })

  it('shows add button with + text', () => {
    render(<TagPillList items={['A']} onSave={onSave} label="Tags" />)
    expect(screen.getByTitle('Add tags')).toBeInTheDocument()
  })

  it('shows add input when + button is clicked', () => {
    render(<TagPillList items={[]} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByTitle('Add tags'))
    expect(screen.getByPlaceholderText('Tags...')).toBeInTheDocument()
  })

  it('adds new item on Enter in add input', () => {
    render(<TagPillList items={['A']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByTitle('Add tags'))
    const input = screen.getByPlaceholderText('Tags...')
    fireEvent.change(input, { target: { value: 'NewTag' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(['A', 'NewTag'])
  })

  it('cancels add on Escape', () => {
    render(<TagPillList items={['A']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByTitle('Add tags'))
    const input = screen.getByPlaceholderText('Tags...')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    // Add button should reappear
    expect(screen.getByTitle('Add tags')).toBeInTheDocument()
  })

  it('deletes item when X button is clicked', () => {
    render(<TagPillList items={['A', 'B', 'C']} onSave={onSave} label="Tags" />)
    const removeButtons = screen.getAllByTitle('Remove')
    fireEvent.click(removeButtons[1]) // Remove B
    expect(onSave).toHaveBeenCalledWith(['A', 'C'])
  })

  it('enters edit mode when clicking a pill', () => {
    render(<TagPillList items={['Hello', 'World']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByText('Hello'))
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument()
  })

  it('saves edit on Enter', () => {
    render(<TagPillList items={['Old']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByText('Old'))
    const input = screen.getByDisplayValue('Old')
    fireEvent.change(input, { target: { value: 'New' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(['New'])
  })

  it('removes item when edit value is cleared', () => {
    render(<TagPillList items={['Remove', 'Keep']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByText('Remove'))
    const input = screen.getByDisplayValue('Remove')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(['Keep'])
  })

  it('cancels edit on Escape', () => {
    render(<TagPillList items={['Stay']} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByText('Stay'))
    const input = screen.getByDisplayValue('Stay')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    // Pill should reappear
    expect(screen.getByText('Stay')).toBeInTheDocument()
  })

  it('adds item on blur when input has value', () => {
    render(<TagPillList items={[]} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByTitle('Add tags'))
    const input = screen.getByPlaceholderText('Tags...')
    fireEvent.change(input, { target: { value: 'BlurAdd' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith(['BlurAdd'])
  })

  it('cancels add on blur when input is empty', () => {
    render(<TagPillList items={[]} onSave={onSave} label="Tags" />)
    fireEvent.click(screen.getByTitle('Add tags'))
    const input = screen.getByPlaceholderText('Tags...')
    fireEvent.blur(input)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('truncates long pill labels independently', () => {
    render(<TagPillList items={['A very long property list value']} onSave={onSave} label="Tags" />)
    expect(screen.getByText('A very long property list value')).toHaveClass('truncate')
  })
})

describe('isUrlValue', () => {
  it('detects http URLs', () => {
    expect(isUrlValue('http://example.com')).toBe(true)
  })

  it('detects https URLs', () => {
    expect(isUrlValue('https://example.com/path?q=1')).toBe(true)
  })

  it('detects bare domain names', () => {
    expect(isUrlValue('example.com')).toBe(true)
    expect(isUrlValue('docs.google.com/spreadsheets')).toBe(true)
  })

  it('rejects plain text', () => {
    expect(isUrlValue('just some text')).toBe(false)
    expect(isUrlValue('Weekly')).toBe(false)
    expect(isUrlValue('Luca Rossi')).toBe(false)
  })

  it('rejects empty strings', () => {
    expect(isUrlValue('')).toBe(false)
  })

  it('rejects single words without TLD', () => {
    expect(isUrlValue('localhost')).toBe(false)
    expect(isUrlValue('active')).toBe(false)
  })
})

describe('normalizeUrl', () => {
  it('returns http/https URLs unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('prepends https:// to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('docs.google.com/sheet')).toBe('https://docs.google.com/sheet')
  })
})

describe('UrlValue', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const onStartEdit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays URL text in view mode', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    expect(screen.getByTestId('url-link')).toHaveTextContent('https://example.com')
  })

  it('opens URL via openExternalUrl on click', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByTestId('url-link'))
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('normalizes bare domain before opening', () => {
    render(<UrlValue value="example.com" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByTestId('url-link'))
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('uses a flexible truncating layout for long URL values', () => {
    render(<UrlValue value="https://example.com/very/long/path/that/needs/truncation" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    const link = screen.getByTestId('url-link')
    const value = screen.getByText('https://example.com/very/long/path/that/needs/truncation')
    expect(link).toHaveClass('flex-1', 'overflow-hidden')
    expect(value).toHaveClass('truncate')
  })

  it('does not open malformed URL', () => {
    render(<UrlValue value="://broken" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByTestId('url-link'))
    expect(openExternalUrl).not.toHaveBeenCalled()
  })

  it('does not trigger edit mode when URL link is clicked', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByTestId('url-link'))
    expect(onStartEdit).not.toHaveBeenCalled()
  })

  it('shows edit button that calls onStartEdit', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={false} onStartEdit={onStartEdit} />)
    fireEvent.click(screen.getByTestId('url-edit-btn'))
    expect(onStartEdit).toHaveBeenCalled()
  })

  it('shows input in editing mode', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('https://example.com')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('calls onSave when Enter is pressed in edit mode', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('https://example.com')
    fireEvent.change(input, { target: { value: 'https://new.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('https://new.com')
  })

  it('calls onCancel when Escape is pressed in edit mode', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('https://example.com')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSave on blur in edit mode', () => {
    render(<UrlValue value="https://example.com" onSave={onSave} onCancel={onCancel} isEditing={true} onStartEdit={onStartEdit} />)
    const input = screen.getByDisplayValue('https://example.com')
    fireEvent.change(input, { target: { value: 'https://updated.com' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith('https://updated.com')
  })
})
