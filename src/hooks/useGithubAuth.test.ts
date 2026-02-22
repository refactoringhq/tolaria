import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGithubAuth } from './useGithubAuth'

// Command-based mock: route by command name
let mockResponses: Record<string, () => any> = {}
const mockInvokeFn = vi.fn(async (cmd: string) => {
  const handler = mockResponses[cmd]
  if (!handler) throw new Error(`No mock for command: ${cmd}`)
  return handler()
})

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: any[]) => mockInvokeFn(...args),
}))

describe('useGithubAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResponses = {}
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in loading state and transitions to disconnected when no stored token', async () => {
    mockResponses = { github_get_stored_token: () => null }

    const { result } = renderHook(() => useGithubAuth())
    expect(result.current.status.state).toBe('loading')

    // Flush the init effect's async work
    await act(async () => {})

    expect(result.current.status.state).toBe('disconnected')
  })

  it('loads user when stored token exists', async () => {
    mockResponses = {
      github_get_stored_token: () => 'gho_existing_token',
      github_get_user: () => ({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://example.com/avatar.png' }),
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})

    expect(result.current.status.state).toBe('connected')
    if (result.current.status.state === 'connected') {
      expect(result.current.status.user.login).toBe('octocat')
    }
  })

  it('falls back to disconnected when stored token is invalid', async () => {
    mockResponses = {
      github_get_stored_token: () => 'gho_bad_token',
      github_get_user: () => { throw new Error('Token is invalid or revoked') },
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})

    expect(result.current.status.state).toBe('disconnected')
  })

  it('starts device flow on connect', async () => {
    mockResponses = {
      github_get_stored_token: () => null,
      github_start_device_flow: () => ({
        device_code: 'dc_test',
        user_code: 'TEST-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
      github_poll_token: () => null,
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})
    expect(result.current.status.state).toBe('disconnected')

    // Await the connect() promise directly
    await act(async () => { await result.current.connect() })

    expect(result.current.status.state).toBe('device_flow')
    if (result.current.status.state === 'device_flow') {
      expect(result.current.status.userCode).toBe('TEST-CODE')
      expect(result.current.status.verificationUri).toBe('https://github.com/login/device')
    }
  })

  it('cancels device flow', async () => {
    mockResponses = {
      github_get_stored_token: () => null,
      github_start_device_flow: () => ({
        device_code: 'dc_test',
        user_code: 'CANCEL-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
      github_poll_token: () => null,
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})

    await act(async () => { await result.current.connect() })
    expect(result.current.status.state).toBe('device_flow')

    act(() => { result.current.cancel() })
    expect(result.current.status.state).toBe('disconnected')
  })

  it('disconnects successfully', async () => {
    mockResponses = {
      github_get_stored_token: () => 'gho_token',
      github_get_user: () => ({ login: 'user', name: 'User', avatar_url: '' }),
      github_disconnect: () => undefined,
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})
    expect(result.current.status.state).toBe('connected')

    await act(async () => { await result.current.disconnect() })
    expect(result.current.status.state).toBe('disconnected')
  })

  it('shows error when device flow start fails', async () => {
    mockResponses = {
      github_get_stored_token: () => null,
      github_start_device_flow: () => { throw new Error('Network error') },
    }

    const { result } = renderHook(() => useGithubAuth())
    await act(async () => {})

    await act(async () => { await result.current.connect() })

    expect(result.current.status.state).toBe('error')
    if (result.current.status.state === 'error') {
      expect(result.current.status.message).toContain('Network error')
    }
  })

  it('transitions from device flow to connected when poll returns token', async () => {
    // Use real timers with short interval for this integration-style test
    vi.useRealTimers()
    let pollCount = 0
    mockResponses = {
      github_get_stored_token: () => null,
      github_start_device_flow: () => ({
        device_code: 'dc_poll_test',
        user_code: 'POLL-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
      github_poll_token: () => {
        pollCount++
        return pollCount >= 2 ? 'gho_new_token' : null
      },
      github_get_user: () => ({ login: 'newuser', name: 'New User', avatar_url: 'https://example.com/new.png' }),
    }

    const { result } = renderHook(() => useGithubAuth())
    await waitFor(() => expect(result.current.status.state).toBe('disconnected'))

    await act(async () => { await result.current.connect() })
    expect(result.current.status.state).toBe('device_flow')

    // Wait for polling to complete (interval=5s enforced minimum, needs 2 polls → ~10-12s)
    await waitFor(() => {
      expect(result.current.status.state).toBe('connected')
    }, { timeout: 15000 })

    if (result.current.status.state === 'connected') {
      expect(result.current.status.user.login).toBe('newuser')
    }
  }, 20000)

  it('handles poll error by showing error state', async () => {
    vi.useRealTimers()
    mockResponses = {
      github_get_stored_token: () => null,
      github_start_device_flow: () => ({
        device_code: 'dc_err',
        user_code: 'ERR-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
      github_poll_token: () => { throw new Error('Authorization was denied by the user.') },
    }

    const { result } = renderHook(() => useGithubAuth())
    await waitFor(() => expect(result.current.status.state).toBe('disconnected'))

    await act(async () => { await result.current.connect() })
    expect(result.current.status.state).toBe('device_flow')

    // Wait for poll to fire and error (interval=5s minimum)
    await waitFor(() => {
      expect(result.current.status.state).toBe('error')
    }, { timeout: 10000 })
  }, 15000)
})
