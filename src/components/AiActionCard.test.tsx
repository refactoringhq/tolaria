import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiActionCard } from './AiActionCard'

const defaults = {
  tool: 'create_note',
  label: 'Creating note... (abc123)',
  status: 'done' as const,
  expanded: false,
  onToggle: vi.fn(),
}

describe('AiActionCard', () => {
  it('renders label text', () => {
    render(<AiActionCard {...defaults} label="Created test.md" />)
    expect(screen.getByText('Created test.md')).toBeTruthy()
  })

  it('shows pending spinner', () => {
    render(<AiActionCard {...defaults} tool="search_notes" label="Searching..." status="pending" />)
    expect(screen.getByTestId('status-pending')).toBeTruthy()
  })

  it('shows done check', () => {
    render(<AiActionCard {...defaults} status="done" />)
    expect(screen.getByTestId('status-done')).toBeTruthy()
  })

  it('shows error icon', () => {
    render(<AiActionCard {...defaults} tool="delete_note" label="Failed" status="error" />)
    expect(screen.getByTestId('status-error')).toBeTruthy()
  })

  it('navigates to note when no details and path+onOpenNote provided', () => {
    const onOpenNote = vi.fn()
    const toggle = vi.fn()
    render(
      <AiActionCard {...defaults} path="/vault/test.md" onOpenNote={onOpenNote} onToggle={toggle} />,
    )
    fireEvent.click(screen.getByTestId('action-card-header'))
    expect(onOpenNote).toHaveBeenCalledWith('/vault/test.md')
    expect(toggle).not.toHaveBeenCalled()
  })

  it('toggles expand instead of navigating when details exist', () => {
    const onOpenNote = vi.fn()
    const toggle = vi.fn()
    render(
      <AiActionCard
        {...defaults}
        path="/vault/test.md"
        onOpenNote={onOpenNote}
        onToggle={toggle}
        input='{"title":"test"}'
      />,
    )
    fireEvent.click(screen.getByTestId('action-card-header'))
    expect(toggle).toHaveBeenCalled()
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('header has button role and is focusable', () => {
    render(<AiActionCard {...defaults} />)
    const header = screen.getByTestId('action-card-header')
    expect(header.getAttribute('role')).toBe('button')
    expect(header.getAttribute('tabindex')).toBe('0')
  })

  it('uses lighter background for open_note tool', () => {
    render(<AiActionCard {...defaults} tool="open_note" label="Opening note" />)
    const card = screen.getByTestId('ai-action-card')
    expect(card.style.background).toBe('var(--accent-blue-light)')
  })

  it('uses standard background for vault tools', () => {
    render(<AiActionCard {...defaults} />)
    const card = screen.getByTestId('ai-action-card')
    expect(card.style.background).toBe('var(--accent-blue-bg)')
  })

  // --- Expand / collapse ---

  it('does not show details when collapsed', () => {
    render(<AiActionCard {...defaults} input='{"q":"test"}' output="found 3" expanded={false} />)
    expect(screen.queryByTestId('action-card-details')).toBeNull()
  })

  it('shows details when expanded with input and output', () => {
    render(<AiActionCard {...defaults} input='{"q":"test"}' output="found 3" expanded />)
    expect(screen.getByTestId('action-card-details')).toBeTruthy()
    expect(screen.getByTestId('detail-input')).toBeTruthy()
    expect(screen.getByTestId('detail-output')).toBeTruthy()
  })

  it('shows only input when no output', () => {
    render(<AiActionCard {...defaults} input='{"q":"test"}' expanded />)
    expect(screen.getByTestId('detail-input')).toBeTruthy()
    expect(screen.queryByTestId('detail-output')).toBeNull()
  })

  it('shows only output when no input', () => {
    render(<AiActionCard {...defaults} output="result text" expanded />)
    expect(screen.queryByTestId('detail-input')).toBeNull()
    expect(screen.getByTestId('detail-output')).toBeTruthy()
  })

  it('does not show details when expanded but no input or output', () => {
    render(<AiActionCard {...defaults} expanded />)
    expect(screen.queryByTestId('action-card-details')).toBeNull()
  })

  it('formats JSON input prettily', () => {
    render(<AiActionCard {...defaults} input='{"title":"Hello","content":"world"}' expanded />)
    const inputBlock = screen.getByTestId('detail-input')
    expect(inputBlock.textContent).toContain('"title": "Hello"')
  })

  it('truncates very long output', () => {
    const longOutput = 'x'.repeat(1000)
    render(<AiActionCard {...defaults} output={longOutput} expanded />)
    const outputBlock = screen.getByTestId('detail-output')
    expect(outputBlock.textContent!.length).toBeLessThan(1000)
  })

  // --- Keyboard accessibility ---

  it('expands on Enter key', () => {
    const toggle = vi.fn()
    render(<AiActionCard {...defaults} onToggle={toggle} input='{"a":1}' />)
    fireEvent.keyDown(screen.getByTestId('action-card-header'), { key: 'Enter' })
    expect(toggle).toHaveBeenCalled()
  })

  it('expands on Space key', () => {
    const toggle = vi.fn()
    render(<AiActionCard {...defaults} onToggle={toggle} input='{"a":1}' />)
    fireEvent.keyDown(screen.getByTestId('action-card-header'), { key: ' ' })
    expect(toggle).toHaveBeenCalled()
  })

  it('collapses on Escape key when expanded', () => {
    const toggle = vi.fn()
    render(<AiActionCard {...defaults} onToggle={toggle} expanded input='{"a":1}' />)
    fireEvent.keyDown(screen.getByTestId('action-card-header'), { key: 'Escape' })
    expect(toggle).toHaveBeenCalled()
  })

  it('does not collapse on Escape when already collapsed', () => {
    const toggle = vi.fn()
    render(<AiActionCard {...defaults} onToggle={toggle} expanded={false} input='{"a":1}' />)
    fireEvent.keyDown(screen.getByTestId('action-card-header'), { key: 'Escape' })
    expect(toggle).not.toHaveBeenCalled()
  })

  it('sets aria-expanded attribute', () => {
    const { rerender } = render(<AiActionCard {...defaults} expanded={false} />)
    expect(screen.getByTestId('action-card-header').getAttribute('aria-expanded')).toBe('false')
    rerender(<AiActionCard {...defaults} expanded />)
    expect(screen.getByTestId('action-card-header').getAttribute('aria-expanded')).toBe('true')
  })

  it('shows error output in red for error status', () => {
    render(<AiActionCard {...defaults} status="error" output="Permission denied" expanded />)
    const outputBlock = screen.getByTestId('detail-output')
    expect(outputBlock.style.color).toContain('destructive')
  })
})
