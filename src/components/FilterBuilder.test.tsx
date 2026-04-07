import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import type { FilterGroup } from '../types'

describe('FilterBuilder value inputs', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderBuilder(group?: FilterGroup) {
    const defaultGroup: FilterGroup = {
      all: [{ field: 'title', op: 'contains', value: '' }],
    }
    return render(
      <FilterBuilder
        group={group ?? defaultGroup}
        onChange={onChange}
        availableFields={['type', 'status', 'title']}
      />,
    )
  }

  it('renders a plain text input for text operators', () => {
    renderBuilder()
    expect(screen.getByTestId('filter-value-input')).toBeInTheDocument()
    expect(screen.getByTestId('filter-value-input')).toHaveAttribute('placeholder', 'value')
  })

  it('keeps wikilink-style values in the plain text input without opening a dropdown', () => {
    renderBuilder({
      all: [{ field: 'belongs to', op: 'contains', value: '[[Alpha Project]]' }],
    })

    const input = screen.getByTestId('filter-value-input')
    fireEvent.focus(input)

    expect(input).toHaveValue('[[Alpha Project]]')
    expect(screen.queryByTestId('wikilink-dropdown')).not.toBeInTheDocument()
  })

  it('updates filter values as raw text strings', () => {
    renderBuilder()

    fireEvent.change(screen.getByTestId('filter-value-input'), {
      target: { value: 'plain text' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        all: [{ field: 'title', op: 'contains', value: 'plain text' }],
      }),
    )
  })

  it('does not render a value input for empty-check operators', () => {
    renderBuilder({
      all: [{ field: 'title', op: 'is_empty' }],
    })

    expect(screen.queryByTestId('filter-value-input')).not.toBeInTheDocument()
  })

  it('renders calendar date picker button for date operators', () => {
    renderBuilder({
      all: [{ field: 'created', op: 'before', value: '2024-06-01' }],
    })

    const dateButton = screen.getByTestId('date-picker-trigger')
    expect(dateButton).toBeInTheDocument()
    expect(dateButton).toHaveTextContent('Jun 1, 2024')
    expect(screen.queryByDisplayValue('2024-06-01')).not.toBeInTheDocument()
  })

  it('renders date picker placeholder when no date is selected', () => {
    renderBuilder({
      all: [{ field: 'created', op: 'after', value: '' }],
    })

    expect(screen.getByTestId('date-picker-trigger')).toHaveTextContent('Pick a date')
  })

  it('shows body field in field dropdown separated from property fields', () => {
    render(
      <FilterBuilder
        group={{ all: [{ field: 'body', op: 'contains', value: 'test' }] }}
        onChange={vi.fn()}
        availableFields={['type', 'status', 'body']}
      />,
    )

    expect(screen.getByText('body')).toBeInTheDocument()
  })
})
