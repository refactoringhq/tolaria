import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiMessage } from './AiMessage'

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid="markdown-content">{content}</div>,
}))

describe('AiMessage', () => {
  it('renders user message', () => {
    render(<AiMessage userMessage="Hello AI" actions={[]} />)
    expect(screen.getByText('Hello AI')).toBeTruthy()
  })

  it('renders response as markdown', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Here is the **answer**" />)
    expect(screen.getByTestId('markdown-content')).toBeTruthy()
    expect(screen.getByText('Here is the **answer**')).toBeTruthy()
  })

  it('shows undo button with response', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.getByTestId('undo-button')).toBeTruthy()
  })

  it('shows reasoning expanded while streaming (reasoningDone=false)', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking about it..." reasoningDone={false} actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toBeTruthy()
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    expect(screen.getByText('Thinking about it...')).toBeTruthy()
  })

  it('auto-collapses reasoning when reasoningDone=true', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toBeTruthy()
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('expands collapsed reasoning on toggle click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    // Starts collapsed (reasoningDone=true)
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
  })

  it('collapses expanded reasoning on toggle click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone={false} actions={[]} />)
    // Starts expanded (reasoningDone=false)
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('renders action cards', () => {
    render(
      <AiMessage
        userMessage="Do something"
        actions={[
          { tool: 'create_note', toolId: 't1', label: 'Created test.md', status: 'done' },
          { tool: 'search_notes', toolId: 't2', label: 'Searched', status: 'pending' },
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
        actions={[{ tool: 'create_note', toolId: 't1', label: 'Open', path: '/vault/note.md', status: 'done' }]}
        onOpenNote={onOpenNote}
      />,
    )
    fireEvent.click(screen.getByTestId('action-card-header'))
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

  it('expands and collapses action cards independently', () => {
    render(
      <AiMessage
        userMessage="Do"
        actions={[
          { tool: 'search_notes', toolId: 't1', label: 'Searched', status: 'done', input: '{"q":"test"}', output: 'Found 3' },
          { tool: 'create_note', toolId: 't2', label: 'Created', status: 'done', input: '{"title":"x"}' },
        ]}
      />,
    )
    const headers = screen.getAllByTestId('action-card-header')
    // Both collapsed initially
    expect(screen.queryByTestId('action-card-details')).toBeNull()
    // Expand first card
    fireEvent.click(headers[0])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(1)
    // Expand second card too
    fireEvent.click(headers[1])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(2)
    // Collapse first card
    fireEvent.click(headers[0])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(1)
  })
})
