import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIndexing } from './useIndexing'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue({
    available: true,
    qmd_installed: true,
    collection_exists: true,
    indexed_count: 100,
    embedded_count: 80,
    pending_embed: 0,
  }),
}))

const { mockInvoke } = await import('../mock-tauri') as { mockInvoke: ReturnType<typeof vi.fn> }

describe('useIndexing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({
      available: true,
      qmd_installed: true,
      collection_exists: true,
      indexed_count: 100,
      embedded_count: 80,
      pending_embed: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with idle phase', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(result.current.progress.phase).toBe('idle')
  })

  it('auto-dismisses error phase after 15 seconds', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    // Simulate setting error state via retryIndexing
    mockInvoke.mockRejectedValueOnce(new Error('qmd update failed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('error')

    act(() => { vi.advanceTimersByTime(15000) })
    expect(result.current.progress.phase).toBe('idle')
  })

  it('sets unavailable phase for missing qmd errors', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('bun not installed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('unavailable')
  })

  it('auto-dismisses unavailable phase after 8 seconds', async () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))

    mockInvoke.mockRejectedValueOnce(new Error('bun not installed'))
    await act(async () => { await result.current.retryIndexing() })
    expect(result.current.progress.phase).toBe('unavailable')

    act(() => { vi.advanceTimersByTime(8000) })
    expect(result.current.progress.phase).toBe('idle')
  })

  it('exposes retryIndexing function', () => {
    const { result } = renderHook(() => useIndexing('/test/vault'))
    expect(typeof result.current.retryIndexing).toBe('function')
  })
})
