import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'
import { LAPUTA_GITHUB_ISSUES_URL } from '../constants/feedback'

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & {
  openExternalUrl: ReturnType<typeof vi.fn>
}

describe('FeedbackDialog', () => {
  it('renders the instructional copy when open', () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
    expect(screen.getByText('Share feedback')).toBeInTheDocument()
    expect(screen.getByText(/best way to share product feedback/i)).toBeInTheDocument()
    expect(screen.getByText(/check whether a similar one already exists/i)).toBeInTheDocument()
  })

  it('focuses the primary CTA when opened', async () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />)
    const cta = screen.getByRole('button', { name: 'Go to Issues' })
    await waitFor(() => expect(cta).toHaveFocus())
  })

  it('opens GitHub Issues without closing the modal', async () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Go to Issues' }))

    await waitFor(() => expect(openExternalUrl).toHaveBeenCalledWith(LAPUTA_GITHUB_ISSUES_URL))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
  })

  it('closes when pressing Escape', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when clicking Close', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
