import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ArchivedNoteBanner } from './ArchivedNoteBanner'

describe('ArchivedNoteBanner', () => {
  it('renders archive icon and label', () => {
    render(<ArchivedNoteBanner onUnarchive={vi.fn()} />)
    expect(screen.getByTestId('archived-note-banner')).toBeTruthy()
    expect(screen.getByText('Archived')).toBeTruthy()
  })

  it('renders unarchive button with keyboard hint', () => {
    render(<ArchivedNoteBanner onUnarchive={vi.fn()} />)
    const btn = screen.getByTestId('unarchive-btn')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('Unarchive')
    expect(btn.title).toBe('Unarchive (Cmd+E)')
  })

  it('calls onUnarchive when button is clicked', () => {
    const onUnarchive = vi.fn()
    render(<ArchivedNoteBanner onUnarchive={onUnarchive} />)
    fireEvent.click(screen.getByTestId('unarchive-btn'))
    expect(onUnarchive).toHaveBeenCalledOnce()
  })
})
