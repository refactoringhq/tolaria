import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const mockInvokeFn = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('../utils/vault-dialog', () => ({
  pickFolder: vi.fn(),
}))

import { useOnboarding } from './useOnboarding'
import { pickFolder } from '../utils/vault-dialog'

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('transitions to ready when vault exists', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return true
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/path'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })
    expect(result.current.state).toEqual({ status: 'ready', vaultPath: '/vault/path' })
  })

  it('shows welcome screen when vault does not exist', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })
    expect(result.current.state).toEqual({ status: 'welcome', defaultPath: '/mock/Documents/Getting Started' })
  })

  it('shows vault-missing when previously dismissed and vault gone', async () => {
    localStorage.setItem('laputa_welcome_dismissed', '1')

    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/deleted'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('vault-missing')
    })
    expect(result.current.state).toEqual({
      status: 'vault-missing',
      vaultPath: '/vault/deleted',
      defaultPath: '/mock/Documents/Getting Started',
    })
  })

  it('handleCreateVault creates vault and transitions to ready', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      if (cmd === 'create_getting_started_vault') return '/mock/Documents/Getting Started'
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })

    await act(async () => {
      await result.current.handleCreateVault()
    })

    expect(result.current.state).toEqual({ status: 'ready', vaultPath: '/mock/Documents/Getting Started' })
    expect(localStorage.getItem('laputa_welcome_dismissed')).toBe('1')
  })

  it('handleCreateVault sets error on failure', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      if (cmd === 'create_getting_started_vault') throw 'Permission denied'
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })

    await act(async () => {
      await result.current.handleCreateVault()
    })

    expect(result.current.error).toBe('Permission denied')
    expect(result.current.state.status).toBe('welcome')
  })

  it('handleOpenFolder opens folder picker and transitions to ready', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      return null
    })
    vi.mocked(pickFolder).mockResolvedValue('/selected/folder')

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })

    await act(async () => {
      await result.current.handleOpenFolder()
    })

    expect(result.current.state).toEqual({ status: 'ready', vaultPath: '/selected/folder' })
    expect(localStorage.getItem('laputa_welcome_dismissed')).toBe('1')
  })

  it('handleOpenFolder does nothing when picker is cancelled', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      return null
    })
    vi.mocked(pickFolder).mockResolvedValue(null)

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })

    await act(async () => {
      await result.current.handleOpenFolder()
    })

    expect(result.current.state.status).toBe('welcome')
  })

  it('handleDismiss marks dismissed and transitions to ready', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_default_vault_path') return '/mock/Documents/Getting Started'
      if (cmd === 'check_vault_exists') return false
      return null
    })

    const { result } = renderHook(() => useOnboarding('/vault/missing'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('welcome')
    })

    act(() => {
      result.current.handleDismiss()
    })

    expect(result.current.state).toEqual({ status: 'ready', vaultPath: '/vault/missing' })
    expect(localStorage.getItem('laputa_welcome_dismissed')).toBe('1')
  })

  it('falls back to ready if commands fail', async () => {
    mockInvokeFn.mockRejectedValue(new Error('command not found'))

    const { result } = renderHook(() => useOnboarding('/vault/path'))

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })
  })
})
