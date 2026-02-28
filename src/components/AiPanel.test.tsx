import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiPanel } from './AiPanel'

describe('AiPanel', () => {
  it('renders panel with AI header', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByText('AI')).toBeTruthy()
  })

  it('renders data-testid ai-panel', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('ai-panel')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} />)
    // Find close button inside the panel header (last button with X icon)
    const panel = screen.getByTestId('ai-panel')
    const buttons = panel.querySelectorAll('button')
    const closeBtn = buttons[0] // First button in panel is the close button in header
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders mock messages', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const messages = screen.getAllByTestId('ai-message')
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  it('renders user message text from mock data', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByText('Crea una nota evento per la riunione con Marco domani')).toBeTruthy()
  })

  it('renders response text from mock data', () => {
    render(<AiPanel onClose={vi.fn()} />)
    expect(screen.getByText(/Ho creato la nota evento/)).toBeTruthy()
  })

  it('renders disabled input bar', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask the AI agent...')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).disabled).toBe(true)
  })

  it('passes onOpenNote to messages', () => {
    const onOpenNote = vi.fn()
    render(<AiPanel onClose={vi.fn()} onOpenNote={onOpenNote} />)
    // Action cards with paths should be clickable
    const cards = screen.getAllByTestId('ai-action-card')
    const clickableCard = cards.find(card => card.getAttribute('role') === 'button')
    if (clickableCard) {
      fireEvent.click(clickableCard)
      expect(onOpenNote).toHaveBeenCalled()
    }
  })

  it('renders action cards from mock data', () => {
    render(<AiPanel onClose={vi.fn()} />)
    const cards = screen.getAllByTestId('ai-action-card')
    expect(cards.length).toBeGreaterThanOrEqual(4) // First mock has 4 actions
  })
})
