import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVaultConfig } from './useVaultConfig'

const mockInvokeFn = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: any) => mockInvokeFn(cmd, args),
}))

describe('useVaultConfig', () => {
  beforeEach(() => {
    mockInvokeFn.mockReset()
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vaults') return [{ label: 'Demo', path: '/demo' }]
      if (cmd === 'add_vault') return { label: 'New', path: '/new' }
      if (cmd === 'remove_vault') return null
      if (cmd === 'init_vault') return null
      return null
    })
  })

  it('loads vaults on mount', async () => {
    const { result } = renderHook(() => useVaultConfig())
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.vaults).toEqual([{ label: 'Demo', path: '/demo' }])
    expect(mockInvokeFn).toHaveBeenCalledWith('get_vaults', undefined)
  })

  it('addVault calls add_vault and updates state', async () => {
    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let addedVault: any
    await act(async () => {
      addedVault = await result.current.addVault('/new')
    })

    expect(addedVault).toEqual({ label: 'New', path: '/new' })
    expect(result.current.vaults).toHaveLength(2)
    expect(result.current.vaults[1]).toEqual({ label: 'New', path: '/new' })
    expect(mockInvokeFn).toHaveBeenCalledWith('add_vault', { path: '/new' })
  })

  it('addVault deduplicates by path', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vaults') return [{ label: 'Demo', path: '/demo' }]
      if (cmd === 'add_vault') return { label: 'Demo', path: '/demo' }
      return null
    })

    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addVault('/demo')
    })

    // Should still have just 1 vault, not duplicated
    expect(result.current.vaults).toHaveLength(1)
  })

  it('removeVault calls remove_vault and updates state', async () => {
    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeVault('/demo')
    })

    expect(result.current.vaults).toHaveLength(0)
    expect(mockInvokeFn).toHaveBeenCalledWith('remove_vault', { path: '/demo' })
  })

  it('initVault calls init_vault', async () => {
    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.initVault('/new-vault')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('init_vault', { path: '/new-vault' })
  })

  it('addVault sets error on failure', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vaults') return []
      if (cmd === 'add_vault') throw new Error('Folder does not exist: /bad')
      return null
    })

    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      try { await result.current.addVault('/bad') } catch { /* expected */ }
    })

    expect(result.current.error).toContain('Folder does not exist')
  })

  it('clearError resets error state', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vaults') return []
      if (cmd === 'add_vault') throw new Error('fail')
      return null
    })

    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      try { await result.current.addVault('/bad') } catch { /* expected */ }
    })
    expect(result.current.error).toBeTruthy()

    act(() => { result.current.clearError() })
    expect(result.current.error).toBeNull()
  })

  it('handles empty vault list gracefully', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vaults') return []
      return null
    })

    const { result } = renderHook(() => useVaultConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.vaults).toEqual([])
  })
})
