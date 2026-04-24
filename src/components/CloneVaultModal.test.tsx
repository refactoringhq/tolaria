import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CloneVaultModal } from './CloneVaultModal'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

import { mockInvoke } from '../mock-tauri'

const mockInvokeFn = vi.mocked(mockInvoke)

describe('CloneVaultModal', () => {
  const onClose = vi.fn()
  const onVaultCloned = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockResolvedValue('Cloned successfully')
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <CloneVaultModal open={false} onClose={onClose} onVaultCloned={onVaultCloned} />
    )

    expect(container.querySelector('[data-testid="clone-vault-modal"]')).not.toBeInTheDocument()
  })

  it('renders the clone form when open', () => {
    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    expect(screen.getByText('Clone Git Repo')).toBeInTheDocument()
    expect(screen.getByTestId('clone-repo-url')).toBeInTheDocument()
    expect(screen.getByTestId('clone-vault-path')).toBeInTheDocument()
  })

  it('focuses the repository field when the modal opens', async () => {
    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    await waitFor(() => {
      expect(screen.getByTestId('clone-repo-url')).toHaveFocus()
    })
  })

  it('suggests a vault path from the repository URL', () => {
    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    fireEvent.change(screen.getByTestId('clone-repo-url'), {
      target: { value: 'https://gitlab.com/user/my-vault.git' },
    })

    expect(screen.getByTestId('clone-vault-path')).toHaveValue('~/Vaults/my-vault')
  })

  it('calls clone_git_repo and reports the cloned vault on submit', async () => {
    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    fireEvent.change(screen.getByTestId('clone-repo-url'), {
      target: { value: 'git@github.com:user/my-vault.git' },
    })
    fireEvent.click(screen.getByTestId('clone-vault-submit'))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('clone_git_repo', {
        url: 'git@github.com:user/my-vault.git',
        localPath: '~/Vaults/my-vault',
      })
    })

    expect(onVaultCloned).toHaveBeenCalledWith('~/Vaults/my-vault', 'my-vault')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the backend error when cloning fails', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Permission denied'))

    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    fireEvent.change(screen.getByTestId('clone-repo-url'), {
      target: { value: 'https://example.com/user/private-vault.git' },
    })
    fireEvent.change(screen.getByTestId('clone-vault-path'), {
      target: { value: '~/Vaults/private-vault' },
    })
    fireEvent.click(screen.getByTestId('clone-vault-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('clone-vault-error')).toHaveTextContent('Clone failed: Error: Permission denied')
    })
  })

  it('keeps progress visible while the clone request is pending', async () => {
    let resolveClone: ((value: string) => void) | null = null
    mockInvokeFn.mockReturnValueOnce(new Promise((resolve) => {
      resolveClone = resolve
    }))

    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    fireEvent.change(screen.getByTestId('clone-repo-url'), {
      target: { value: 'git@github.com:user/my-vault.git' },
    })
    fireEvent.click(screen.getByTestId('clone-vault-submit'))

    expect(screen.getByTestId('clone-vault-submit')).toHaveTextContent('Cloning...')
    expect(screen.getByTestId('clone-vault-submit')).toBeDisabled()

    resolveClone?.('Cloned successfully')

    await waitFor(() => {
      expect(onVaultCloned).toHaveBeenCalledWith('~/Vaults/my-vault', 'my-vault')
    })
  })

  it('submits with Enter and blocks overlapping clone attempts while pending', async () => {
    let resolveClone: ((value: string) => void) | null = null
    mockInvokeFn.mockReturnValueOnce(new Promise((resolve) => {
      resolveClone = resolve
    }))

    render(<CloneVaultModal open={true} onClose={onClose} onVaultCloned={onVaultCloned} />)

    fireEvent.change(screen.getByTestId('clone-repo-url'), {
      target: { value: 'git@github.com:user/my-vault.git' },
    })

    fireEvent.submit(screen.getByTestId('clone-vault-form'))
    fireEvent.submit(screen.getByTestId('clone-vault-form'))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('clone-repo-url')).toBeDisabled()
    expect(screen.getByTestId('clone-vault-path')).toBeDisabled()
    expect(screen.getByTestId('clone-vault-cancel')).toBeDisabled()
    expect(screen.getByTestId('clone-vault-submit')).toHaveTextContent('Cloning...')

    resolveClone?.('Cloned successfully')

    await waitFor(() => {
      expect(onVaultCloned).toHaveBeenCalledWith('~/Vaults/my-vault', 'my-vault')
    })
  })
})
