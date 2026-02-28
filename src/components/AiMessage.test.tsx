import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiMessage } from './AiMessage'

describe('AiMessage', () => {
  it('renders user message', () => {
    render(<AiMessage userMessage="Hello AI" actions={[]} />)
    expect(screen.getByText('Hello AI')).toBeTruthy()
  })

  it('renders response text', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Here is the answer" />)
    expect(screen.getByText('Here is the answer')).toBeTruthy()
  })

  it('shows undo button with response', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.getByTestId('undo-button')).toBeTruthy()
  })

  it('renders reasoning toggle collapsed by default', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking about it..." actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toBeTruthy()
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('expands reasoning on toggle click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking about it..." actions={[]} />)
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    expect(screen.getByText('Thinking about it...')).toBeTruthy()
  })

  it('collapses reasoning on second click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." actions={[]} />)
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('renders action cards', () => {
    render(
      <AiMessage
        userMessage="Do something"
        actions={[
          { tool: 'create_note', label: 'Created test.md', status: 'done' },
          { tool: 'search_notes', label: 'Searched', status: 'pending' },
        ]}
      />,
    )
    expect(screen.getAllByTestId('ai-action-card')).toHaveLength(2)
  })

  it('passes onOpenNote to action cards', () => {
    const onOpenNote = vi.fn()
    render(
      <AiMessage
        userMessage="Do"
        actions={[{ tool: 'create_note', label: 'Open', path: '/vault/note.md', status: 'done' }]}
        onOpenNote={onOpenNote}
      />,
    )
    fireEvent.click(screen.getByTestId('ai-action-card'))
    expect(onOpenNote).toHaveBeenCalledWith('/vault/note.md')
  })

  it('shows streaming indicator when streaming without response', () => {
    const { container } = render(
      <AiMessage userMessage="Ask" actions={[]} isStreaming />,
    )
    expect(container.querySelector('.typing-dot')).toBeTruthy()
  })

  it('does not show streaming indicator when response is present', () => {
    const { container } = render(
      <AiMessage userMessage="Ask" actions={[]} response="Done" isStreaming />,
    )
    expect(container.querySelector('.typing-dot')).toBeNull()
  })

  it('does not render reasoning block when no reasoning', () => {
    render(<AiMessage userMessage="Ask" actions={[]} />)
    expect(screen.queryByTestId('reasoning-toggle')).toBeNull()
  })

  it('does not render actions when empty array', () => {
    render(<AiMessage userMessage="Ask" actions={[]} />)
    expect(screen.queryByTestId('ai-action-card')).toBeNull()
  })
})
