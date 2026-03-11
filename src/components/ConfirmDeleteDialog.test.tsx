import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'

describe('ConfirmDeleteDialog', () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with title and message', () => {
    render(
      <ConfirmDeleteDialog
        open={true}
        title="Delete permanently?"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText('Delete permanently?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when delete button clicked', () => {
    render(
      <ConfirmDeleteDialog
        open={true}
        title="Delete permanently?"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', () => {
    render(
      <ConfirmDeleteDialog
        open={true}
        title="Delete permanently?"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not render when open is false', () => {
    render(
      <ConfirmDeleteDialog
        open={false}
        title="Delete permanently?"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.queryByText('Delete permanently?')).not.toBeInTheDocument()
  })

  it('uses custom confirm label when provided', () => {
    render(
      <ConfirmDeleteDialog
        open={true}
        title="Empty Trash?"
        message="Delete all notes?"
        confirmLabel="Empty Trash"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText('Empty Trash')).toBeInTheDocument()
  })
})
