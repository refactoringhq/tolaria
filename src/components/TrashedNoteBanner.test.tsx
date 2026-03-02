import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TrashedNoteBanner } from './TrashedNoteBanner'

describe('TrashedNoteBanner', () => {
  it('renders the banner with trash message', () => {
    render(<TrashedNoteBanner onRestore={vi.fn()} onDeletePermanently={vi.fn()} />)
    expect(screen.getByText('This note is in the Trash')).toBeInTheDocument()
    expect(screen.getByTestId('trashed-note-banner')).toBeInTheDocument()
  })

  it('shows Restore and Delete permanently buttons', () => {
    render(<TrashedNoteBanner onRestore={vi.fn()} onDeletePermanently={vi.fn()} />)
    expect(screen.getByText('Restore')).toBeInTheDocument()
    expect(screen.getByText('Delete permanently')).toBeInTheDocument()
  })

  it('calls onRestore when Restore button is clicked', () => {
    const onRestore = vi.fn()
    render(<TrashedNoteBanner onRestore={onRestore} onDeletePermanently={vi.fn()} />)
    fireEvent.click(screen.getByTestId('trashed-banner-restore'))
    expect(onRestore).toHaveBeenCalledOnce()
  })

  it('calls onDeletePermanently when Delete permanently button is clicked', () => {
    const onDeletePermanently = vi.fn()
    render(<TrashedNoteBanner onRestore={vi.fn()} onDeletePermanently={onDeletePermanently} />)
    fireEvent.click(screen.getByTestId('trashed-banner-delete'))
    expect(onDeletePermanently).toHaveBeenCalledOnce()
  })
})
