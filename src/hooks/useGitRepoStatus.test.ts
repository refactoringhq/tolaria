import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGitRepoStatus } from './useGitRepoStatus'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('useGitRepoStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults isGitVault to true (fail-open) in browser mode', async () => {
    const { result } = renderHook(() => useGitRepoStatus('/some/vault'))
    await waitFor(() => {
      expect(result.current.isGitVault).toBe(true)
    })
  })

  it('returns isGitVault true when path is null', async () => {
    const { result } = renderHook(() => useGitRepoStatus(null))
    await waitFor(() => {
      expect(result.current.isGitVault).toBe(true)
    })
  })

  it('exposes a refresh function', async () => {
    const { result } = renderHook(() => useGitRepoStatus('/some/vault'))
    await waitFor(() => {
      expect(typeof result.current.refresh).toBe('function')
    })
  })
})
