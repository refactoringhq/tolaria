import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EnableGitDialog } from './EnableGitDialog'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

describe('EnableGitDialog', () => {
  const onClose = vi.fn()
  const onEnabled = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    render(
      <EnableGitDialog
        open={false}
        vaultPath="/some/vault"
        onClose={onClose}
        onEnabled={onEnabled}
      />
    )
    expect(screen.queryByTestId('enable-git-dialog')).not.toBeInTheDocument()
  })

  it('renders dialog content when open', () => {
    render(
      <EnableGitDialog
        open={true}
        vaultPath="/some/vault"
        onClose={onClose}
        onEnabled={onEnabled}
      />
    )
    expect(screen.getByTestId('enable-git-dialog')).toBeInTheDocument()
    expect(screen.getByText('Enable Git for this vault')).toBeInTheDocument()
  })

  it('calls onEnabled and onClose when Enable Git is confirmed', async () => {
    render(
      <EnableGitDialog
        open={true}
        vaultPath="/some/vault"
        onClose={onClose}
        onEnabled={onEnabled}
      />
    )
    fireEvent.click(screen.getByTestId('enable-git-confirm'))
    await waitFor(() => {
      expect(onEnabled).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <EnableGitDialog
        open={true}
        vaultPath="/some/vault"
        onClose={onClose}
        onEnabled={onEnabled}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onEnabled).not.toHaveBeenCalled()
  })
})
