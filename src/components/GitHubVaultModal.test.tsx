import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GitHubVaultModal } from './GitHubVaultModal'

// Mock mockInvoke — the component uses tauriCall which calls mockInvoke in browser
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

import { mockInvoke } from '../mock-tauri'
const mockInvokeFn = vi.mocked(mockInvoke)

const MOCK_REPOS = [
  { name: 'my-vault', full_name: 'user/my-vault', description: 'A personal vault', private: true, clone_url: 'https://github.com/user/my-vault.git', html_url: 'https://github.com/user/my-vault', updated_at: '2026-02-20T10:00:00Z' },
  { name: 'public-notes', full_name: 'user/public-notes', description: 'Public notes repo', private: false, clone_url: 'https://github.com/user/public-notes.git', html_url: 'https://github.com/user/public-notes', updated_at: '2026-02-19T10:00:00Z' },
]

describe('GitHubVaultModal', () => {
  const onClose = vi.fn()
  const onVaultCloned = vi.fn()
  const onOpenSettings = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'github_list_repos') return MOCK_REPOS
      if (cmd === 'github_create_repo') return MOCK_REPOS[0]
      if (cmd === 'clone_repo') return 'Cloned successfully'
      throw new Error(`Unknown command: ${cmd}`)
    })
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <GitHubVaultModal open={false} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )
    expect(container.querySelector('[data-testid="github-vault-modal"]')).not.toBeInTheDocument()
  })

  it('shows connect prompt when no GitHub token', () => {
    render(
      <GitHubVaultModal open={true} githubToken={null} onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )
    expect(screen.getByText(/Add your GitHub token in Settings/i)).toBeInTheDocument()
    expect(screen.getByTestId('github-open-settings')).toBeInTheDocument()
  })

  it('opens settings when "Open Settings" clicked without token', () => {
    render(
      <GitHubVaultModal open={true} githubToken={null} onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )
    fireEvent.click(screen.getByTestId('github-open-settings'))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('shows clone and create tabs when token is present', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )
    expect(screen.getByTestId('github-tab-clone')).toBeInTheDocument()
    expect(screen.getByTestId('github-tab-create')).toBeInTheDocument()
  })

  it('loads and displays repos in clone tab', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByText('user/my-vault')).toBeInTheDocument()
    })
    expect(screen.getByText('user/public-notes')).toBeInTheDocument()
    expect(screen.getByText('A personal vault')).toBeInTheDocument()
  })

  it('filters repos by search', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByText('user/my-vault')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('github-repo-search'), { target: { value: 'public' } })

    expect(screen.queryByText('user/my-vault')).not.toBeInTheDocument()
    expect(screen.getByText('user/public-notes')).toBeInTheDocument()
  })

  it('selects a repo and auto-fills clone path', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('repo-item-my-vault')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-item-my-vault'))

    const pathInput = screen.getByTestId('github-clone-path') as HTMLInputElement
    expect(pathInput.value).toBe('~/Vaults/my-vault')
  })

  it('clone button disabled without selection', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('github-clone-btn')).toBeInTheDocument()
    })

    expect(screen.getByTestId('github-clone-btn')).toBeDisabled()
  })

  it('calls clone_repo and onVaultCloned on clone', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('repo-item-my-vault')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-item-my-vault'))
    fireEvent.click(screen.getByTestId('github-clone-btn'))

    await waitFor(() => {
      expect(onVaultCloned).toHaveBeenCalledWith('~/Vaults/my-vault', 'my-vault')
    })
  })

  it('has create tab trigger that is clickable', () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    const createTab = screen.getByTestId('github-tab-create')
    expect(createTab).toBeInTheDocument()
    expect(createTab).toHaveTextContent('Create New')
    expect(createTab).not.toBeDisabled()
  })

  it('shows error when clone fails', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'github_list_repos') return MOCK_REPOS
      if (cmd === 'clone_repo') throw new Error('Permission denied')
      throw new Error(`Unknown: ${cmd}`)
    })

    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('repo-item-my-vault')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('repo-item-my-vault'))
    fireEvent.click(screen.getByTestId('github-clone-btn'))

    await waitFor(() => {
      expect(screen.getByText(/Clone failed/i)).toBeInTheDocument()
    })
    expect(onVaultCloned).not.toHaveBeenCalled()
  })

  it('shows Private/Public badges on repos', async () => {
    render(
      <GitHubVaultModal open={true} githubToken="gho_test" onClose={onClose} onVaultCloned={onVaultCloned} onOpenSettings={onOpenSettings} />
    )

    await waitFor(() => {
      expect(screen.getByText('user/my-vault')).toBeInTheDocument()
    })

    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
  })
})
