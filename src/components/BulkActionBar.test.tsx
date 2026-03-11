import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkActionBar } from './BulkActionBar'

describe('BulkActionBar', () => {
  const defaultProps = {
    count: 3,
    onArchive: vi.fn(),
    onTrash: vi.fn(),
    onRestore: vi.fn(),
    onDeletePermanently: vi.fn(),
    onClear: vi.fn(),
    isTrashView: false,
  }

  it('shows Archive and Trash buttons in normal view', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByTestId('bulk-archive-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-trash-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('bulk-restore-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-delete-btn')).not.toBeInTheDocument()
  })

  it('shows Restore and Delete permanently in trash view', () => {
    render(<BulkActionBar {...defaultProps} isTrashView={true} />)
    expect(screen.getByTestId('bulk-restore-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('bulk-archive-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-trash-btn')).not.toBeInTheDocument()
  })

  it('calls onRestore when Restore button clicked in trash view', () => {
    const onRestore = vi.fn()
    render(<BulkActionBar {...defaultProps} isTrashView={true} onRestore={onRestore} />)
    fireEvent.click(screen.getByTestId('bulk-restore-btn'))
    expect(onRestore).toHaveBeenCalledTimes(1)
  })

  it('calls onDeletePermanently when Delete button clicked in trash view', () => {
    const onDeletePermanently = vi.fn()
    render(<BulkActionBar {...defaultProps} isTrashView={true} onDeletePermanently={onDeletePermanently} />)
    fireEvent.click(screen.getByTestId('bulk-delete-btn'))
    expect(onDeletePermanently).toHaveBeenCalledTimes(1)
  })

  it('shows selected count', () => {
    render(<BulkActionBar {...defaultProps} count={5} />)
    expect(screen.getByText('5 selected')).toBeInTheDocument()
  })
})
