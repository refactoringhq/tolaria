import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCompositionAwareEditorChange } from './useCompositionAwareEditorChange'

function CompositionChangeHarness({ onChange }: { onChange: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleChange = useCompositionAwareEditorChange({ containerRef, onChange })

  return (
    <div data-testid="composition-container" ref={containerRef}>
      <button data-testid="editor-change" onClick={handleChange} type="button" />
    </div>
  )
}

describe('useCompositionAwareEditorChange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for ProseMirror change reconciliation after compositionend', async () => {
    vi.useFakeTimers()
    let reconciled = false
    const reconciliationStates: boolean[] = []
    const onChange = vi.fn(() => reconciliationStates.push(reconciled))

    render(<CompositionChangeHarness onChange={onChange} />)
    const container = screen.getByTestId('composition-container')
    const editorChange = screen.getByTestId('editor-change')

    fireEvent.compositionStart(container)
    fireEvent.click(editorChange)
    fireEvent.compositionEnd(container)

    expect(onChange).not.toHaveBeenCalled()

    setTimeout(() => {
      reconciled = true
      fireEvent.click(editorChange)
    }, 20)
    await act(async () => vi.advanceTimersByTimeAsync(20))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(reconciliationStates).toEqual([true])

    await act(async () => vi.advanceTimersByTimeAsync(50))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('flushes the pending composition change when no reconciled change arrives', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()

    render(<CompositionChangeHarness onChange={onChange} />)
    const container = screen.getByTestId('composition-container')

    fireEvent.compositionStart(container)
    fireEvent.click(screen.getByTestId('editor-change'))
    fireEvent.compositionEnd(container)

    await act(async () => vi.advanceTimersByTimeAsync(49))
    expect(onChange).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
