import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBuildNumber } from './useBuildNumber'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue('b223'),
}))

beforeEach(() => { vi.clearAllMocks() })

describe('useBuildNumber', () => {
  it('returns build number from mock invoke', async () => {
    const { result } = renderHook(() => useBuildNumber())
    await waitFor(() => expect(result.current).toBe('b223'))
  })

  it('returns fallback on error', async () => {
    const { mockInvoke } = await import('../mock-tauri')
    vi.mocked(mockInvoke).mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useBuildNumber())
    await waitFor(() => expect(result.current).toBe('b?'))
  })
})
