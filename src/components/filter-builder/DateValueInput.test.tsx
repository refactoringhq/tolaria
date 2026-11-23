import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DateValueInput } from './DateValueInput'

describe('DateValueInput', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderControlledDateValueInput(initialValue = '') {
    function ControlledDateValueInput() {
      const [value, setValue] = useState(initialValue)
      return <DateValueInput value={value} onChange={setValue} />
    }

    return render(<ControlledDateValueInput />)
  }

  it('shows a debounced resolved-date preview while focused', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'))

    renderControlledDateValueInput()

    const input = screen.getByTestId('date-value-input')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '10 days ago' } })

    expect(screen.queryByTestId('date-value-preview')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(screen.getByTestId('date-value-preview')).toHaveTextContent('Resolves to Mar 29, 2026')
  })

  it('shows a neutral hint for unrecognized input and hides the preview on blur', async () => {
    vi.useFakeTimers()

    renderControlledDateValueInput()

    const input = screen.getByTestId('date-value-input')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'eventually maybe' } })

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(screen.getByTestId('date-value-preview-unrecognized')).toHaveTextContent('Not recognized')

    fireEvent.blur(input)

    expect(screen.queryByTestId('date-value-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('date-value-preview-unrecognized')).not.toBeInTheDocument()
  })
})
