import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'

// Mock the useGithubAuth hook
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockCancel = vi.fn()
let mockStatus: any = { state: 'disconnected' }

vi.mock('../hooks/useGithubAuth', () => ({
  useGithubAuth: () => ({
    status: mockStatus,
    connect: mockConnect,
    disconnect: mockDisconnect,
    cancel: mockCancel,
  }),
}))

describe('SettingsPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = { state: 'disconnected' }
  })

  it('renders Settings title when open', () => {
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders nothing when not open', () => {
    const { container } = render(<SettingsPanel open={false} onClose={onClose} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows GitHub section header', () => {
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('shows Connect GitHub button when disconnected', () => {
    mockStatus = { state: 'disconnected' }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument()
  })

  it('calls connect when Connect GitHub is clicked', () => {
    mockStatus = { state: 'disconnected' }
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Connect GitHub'))
    expect(mockConnect).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    mockStatus = { state: 'loading' }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows device flow with user code', () => {
    mockStatus = {
      state: 'device_flow',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('ABCD-1234')).toBeInTheDocument()
    expect(screen.getByText('Open GitHub')).toBeInTheDocument()
    expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument()
  })

  it('opens GitHub verification URL in new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockStatus = {
      state: 'device_flow',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Open GitHub'))
    expect(openSpy).toHaveBeenCalledWith('https://github.com/login/device', '_blank')
    openSpy.mockRestore()
  })

  it('calls cancel during device flow', () => {
    mockStatus = {
      state: 'device_flow',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockCancel).toHaveBeenCalled()
  })

  it('shows connected user info with avatar', () => {
    mockStatus = {
      state: 'connected',
      user: {
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('The Octocat')).toBeInTheDocument()
    expect(screen.getByText('@octocat')).toBeInTheDocument()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
    const avatar = screen.getByAltText('octocat') as HTMLImageElement
    expect(avatar.src).toContain('avatars.githubusercontent.com')
  })

  it('shows login when name is null', () => {
    mockStatus = {
      state: 'connected',
      user: {
        login: 'bot-user',
        name: null,
        avatar_url: '',
      },
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('bot-user')).toBeInTheDocument()
    // Should NOT show @login when name is null (login IS the display name)
    expect(screen.queryByText('@bot-user')).not.toBeInTheDocument()
  })

  it('calls disconnect when Disconnect button is clicked', () => {
    mockStatus = {
      state: 'connected',
      user: { login: 'octocat', name: 'The Octocat', avatar_url: '' },
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Disconnect'))
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('shows error message and retry button', () => {
    mockStatus = {
      state: 'error',
      message: 'Device code expired. Please try again.',
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('Device code expired. Please try again.')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('calls connect on Try Again', () => {
    mockStatus = {
      state: 'error',
      message: 'Something went wrong',
    }
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Try Again'))
    expect(mockConnect).toHaveBeenCalled()
  })

  it('calls onClose when Close button is clicked', () => {
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows description text when disconnected', () => {
    mockStatus = { state: 'disconnected' }
    render(<SettingsPanel open={true} onClose={onClose} />)
    expect(screen.getByText('Enable repo-backed vaults and sync')).toBeInTheDocument()
  })
})
