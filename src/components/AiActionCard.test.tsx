import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiActionCard } from './AiActionCard'

describe('AiActionCard', () => {
  it('renders label text', () => {
    render(<AiActionCard tool="create_note" label="Created test.md" status="done" />)
    expect(screen.getByText('Created test.md')).toBeTruthy()
  })

  it('shows pending spinner', () => {
    render(<AiActionCard tool="search_notes" label="Searching..." status="pending" />)
    expect(screen.getByTestId('status-pending')).toBeTruthy()
  })

  it('shows done check', () => {
    render(<AiActionCard tool="create_note" label="Created" status="done" />)
    expect(screen.getByTestId('status-done')).toBeTruthy()
  })

  it('shows error icon', () => {
    render(<AiActionCard tool="delete_note" label="Failed" status="error" />)
    expect(screen.getByTestId('status-error')).toBeTruthy()
  })

  it('is clickable when path and onOpenNote provided', () => {
    const onOpenNote = vi.fn()
    render(<AiActionCard tool="create_note" label="Open note" path="/vault/test.md" status="done" onOpenNote={onOpenNote} />)
    fireEvent.click(screen.getByTestId('ai-action-card'))
    expect(onOpenNote).toHaveBeenCalledWith('/vault/test.md')
  })

  it('has button role when clickable', () => {
    render(<AiActionCard tool="create_note" label="Open note" path="/vault/test.md" status="done" onOpenNote={vi.fn()} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('is not clickable without path', () => {
    const onOpenNote = vi.fn()
    render(<AiActionCard tool="create_note" label="Created" status="done" onOpenNote={onOpenNote} />)
    fireEvent.click(screen.getByTestId('ai-action-card'))
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('is not clickable without onOpenNote', () => {
    render(<AiActionCard tool="create_note" label="Created" path="/vault/test.md" status="done" />)
    const card = screen.getByTestId('ai-action-card')
    expect(card.getAttribute('role')).toBeNull()
  })

  it('uses lighter background for ui_ tools', () => {
    render(<AiActionCard tool="ui_open_tab" label="Opened tab" status="done" />)
    const card = screen.getByTestId('ai-action-card')
    expect(card.style.background).toContain('0.06')
  })

  it('uses standard background for vault tools', () => {
    render(<AiActionCard tool="create_note" label="Created" status="done" />)
    const card = screen.getByTestId('ai-action-card')
    expect(card.style.background).toContain('0.1')
  })
})
