import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GitRequiredModal } from './GitRequiredModal'

describe('GitRequiredModal', () => {
  it('renders title and explanation', () => {
    render(<GitRequiredModal onCreateRepo={vi.fn()} onChooseVault={vi.fn()} />)
    expect(screen.getByText('Git repository required')).toBeInTheDocument()
    expect(screen.getByText(/track changes/)).toBeInTheDocument()
  })

  it('renders both action buttons', () => {
    render(<GitRequiredModal onCreateRepo={vi.fn()} onChooseVault={vi.fn()} />)
    expect(screen.getByText('Create repository')).toBeInTheDocument()
    expect(screen.getByText('Choose another vault')).toBeInTheDocument()
  })

  it('calls onCreateRepo when primary button clicked', async () => {
    const onCreateRepo = vi.fn().mockResolvedValue(undefined)
    render(<GitRequiredModal onCreateRepo={onCreateRepo} onChooseVault={vi.fn()} />)
    fireEvent.click(screen.getByText('Create repository'))
    expect(onCreateRepo).toHaveBeenCalledOnce()
  })

  it('calls onChooseVault when secondary button clicked', () => {
    const onChooseVault = vi.fn()
    render(<GitRequiredModal onCreateRepo={vi.fn()} onChooseVault={onChooseVault} />)
    fireEvent.click(screen.getByText('Choose another vault'))
    expect(onChooseVault).toHaveBeenCalledOnce()
  })

  it('disables buttons and shows spinner while creating', async () => {
    let resolve: () => void
    const onCreateRepo = vi.fn().mockReturnValue(new Promise<void>(r => { resolve = r }))
    render(<GitRequiredModal onCreateRepo={onCreateRepo} onChooseVault={vi.fn()} />)
    fireEvent.click(screen.getByText('Create repository'))
    await waitFor(() => {
      expect(screen.getByText('Creating…')).toBeInTheDocument()
    })
    resolve!()
  })

  it('shows error message when creation fails', async () => {
    const onCreateRepo = vi.fn().mockRejectedValue(new Error('Permission denied'))
    render(<GitRequiredModal onCreateRepo={onCreateRepo} onChooseVault={vi.fn()} />)
    fireEvent.click(screen.getByText('Create repository'))
    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
    })
  })
})
