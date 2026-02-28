import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'
import type { Settings } from '../types'

// Mock the tauri/mock-tauri calls used by GitHubSection
const mockInvokeFn = vi.fn()
const mockOpenExternalUrl = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const emptySettings: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: null,
  github_username: null,
  auto_pull_interval_minutes: null,
}

const populatedSettings: Settings = {
  anthropic_key: 'sk-ant-api03-test123',
  openai_key: 'sk-openai-test456',
  google_key: null,
  github_token: null,
  github_username: null,
  auto_pull_interval_minutes: 5,
}

describe('SettingsPanel', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <SettingsPanel open={false} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when open', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('AI Provider Keys')).toBeInTheDocument()
    expect(screen.getByText(/stored locally/)).toBeInTheDocument()
  })

  it('shows three key fields with labels', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Google AI')).toBeInTheDocument()
  })

  it('populates fields from settings', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    const openaiInput = screen.getByTestId('settings-key-openai') as HTMLInputElement
    const googleInput = screen.getByTestId('settings-key-google-ai') as HTMLInputElement

    expect(anthropicInput.value).toBe('sk-ant-api03-test123')
    expect(openaiInput.value).toBe('sk-openai-test456')
    expect(googleInput.value).toBe('')
  })

  it('calls onSave with trimmed keys on save', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: '  sk-ant-test  ' } })

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: 'sk-ant-test',
      openai_key: null,
      google_key: null,
      github_token: null,
      github_username: null,
      auto_pull_interval_minutes: 5,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('converts empty/whitespace keys to null', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    // Clear the anthropic key field
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: '   ' } })

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: null,
      openai_key: 'sk-openai-test456',
      google_key: null,
      github_token: null,
      github_username: null,
      auto_pull_interval_minutes: 5,
    })
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTitle('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves on Cmd+Enter', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: 'sk-ant-test' } })
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: 'sk-ant-test',
      openai_key: null,
      google_key: null,
      github_token: null,
      github_username: null,
      auto_pull_interval_minutes: 5,
    })
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('settings-panel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('clears a key field when X button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const clearBtn = screen.getByTestId('clear-anthropic')
    fireEvent.click(clearBtn)

    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(anthropicInput.value).toBe('')
  })

  it('shows keyboard shortcut hint in footer', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText(/to open settings/)).toBeInTheDocument()
  })

  it('resets fields when reopened with different settings', () => {
    const { rerender } = render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    // Verify initial state
    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(anthropicInput.value).toBe('sk-ant-api03-test123')

    // Close and reopen with different settings
    rerender(
      <SettingsPanel open={false} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const newSettings: Settings = { ...emptySettings, anthropic_key: 'new-key' }
    rerender(
      <SettingsPanel open={true} settings={newSettings} onSave={onSave} onClose={onClose} />
    )
    const updatedInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(updatedInput.value).toBe('new-key')
  })

  describe('GitHub OAuth section', () => {
    it('shows Login with GitHub button when not connected', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.getByTestId('github-login')).toBeInTheDocument()
      expect(screen.getByText('Login with GitHub')).toBeInTheDocument()
    })

    it('does not show GitHub token input field', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.queryByTestId('settings-key-github-token')).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText('ghp_... or gho_...')).not.toBeInTheDocument()
    })

    it('shows connected state with username when GitHub is connected', () => {
      const connectedSettings: Settings = {
        ...emptySettings,
        github_token: 'gho_test_token',
        github_username: 'lucaong',
      }
      render(
        <SettingsPanel open={true} settings={connectedSettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.getByTestId('github-connected')).toBeInTheDocument()
      expect(screen.getByText('lucaong')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByTestId('github-disconnect')).toBeInTheDocument()
    })

    it('clears GitHub connection on disconnect', () => {
      const connectedSettings: Settings = {
        ...emptySettings,
        github_token: 'gho_test_token',
        github_username: 'lucaong',
      }
      render(
        <SettingsPanel open={true} settings={connectedSettings} onSave={onSave} onClose={onClose} />
      )
      fireEvent.click(screen.getByTestId('github-disconnect'))

      // onSave should be called with cleared GitHub fields
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        github_token: null,
        github_username: null,
      }))
    })

    it('shows waiting state with user code during OAuth flow', async () => {
      mockInvokeFn.mockImplementation(async (cmd: string) => {
        if (cmd === 'github_device_flow_start') {
          return {
            device_code: 'test_device_code',
            user_code: 'TEST-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 5,
          }
        }
        if (cmd === 'github_device_flow_poll') {
          return { status: 'pending', access_token: null, error: 'authorization_pending' }
        }
        return null
      })

      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      fireEvent.click(screen.getByTestId('github-login'))

      await waitFor(() => {
        expect(screen.getByTestId('github-waiting')).toBeInTheDocument()
        expect(screen.getByTestId('github-user-code')).toHaveTextContent('TEST-1234')
      })

      expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://github.com/login/device')
    })

    it('shows verification URL as clickable link in waiting state', async () => {
      mockInvokeFn.mockImplementation(async (cmd: string) => {
        if (cmd === 'github_device_flow_start') {
          return {
            device_code: 'test_device_code',
            user_code: 'TEST-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 5,
          }
        }
        if (cmd === 'github_device_flow_poll') {
          return { status: 'pending', access_token: null, error: 'authorization_pending' }
        }
        return null
      })

      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      fireEvent.click(screen.getByTestId('github-login'))

      await waitFor(() => {
        const urlButton = screen.getByTestId('github-open-url')
        expect(urlButton).toBeInTheDocument()
        expect(urlButton).toHaveTextContent('https://github.com/login/device')
      })
    })

    it('shows retry button when OAuth flow errors', async () => {
      mockInvokeFn.mockImplementation(async (cmd: string) => {
        if (cmd === 'github_device_flow_start') {
          throw 'Network error'
        }
        return null
      })

      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      fireEvent.click(screen.getByTestId('github-login'))

      await waitFor(() => {
        expect(screen.getByTestId('github-error')).toHaveTextContent('Network error')
        expect(screen.getByTestId('github-retry')).toBeInTheDocument()
      })
    })

    it('shows GitHub section description about connecting', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.getByText(/Connect your GitHub account/)).toBeInTheDocument()
    })

    it('displays the actual backend error string when device flow start fails', async () => {
      mockInvokeFn.mockImplementation(async (cmd: string) => {
        if (cmd === 'github_device_flow_start') {
          // Tauri invoke rejects with a plain string, not an Error instance
          throw 'GitHub device flow not available. Ensure a GitHub App is registered.'
        }
        return null
      })

      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      fireEvent.click(screen.getByTestId('github-login'))

      await waitFor(() => {
        expect(screen.getByTestId('github-error')).toHaveTextContent(
          'GitHub device flow not available. Ensure a GitHub App is registered.'
        )
      })
    })

    it('prevents double-click by disabling button during login flow', async () => {
      let resolveStart: ((v: unknown) => void) | null = null
      mockInvokeFn.mockImplementation(async (cmd: string) => {
        if (cmd === 'github_device_flow_start') {
          return new Promise(r => { resolveStart = r })
        }
        return null
      })

      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      const loginBtn = screen.getByTestId('github-login') as HTMLButtonElement
      fireEvent.click(loginBtn)

      // Button should be disabled while waiting
      await waitFor(() => {
        expect(loginBtn.disabled).toBe(true)
      })

      // Clean up
      resolveStart?.({
        device_code: 'dc', user_code: 'UC-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900, interval: 5,
      })
    })
  })
})
