import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useUpdater } from './useUpdater'

// Mock isTauri
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

// Mock openExternalUrl
const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

// Mock the dynamic imports
const mockCheck = vi.fn()
const mockRelaunch = vi.fn()

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}))

import { isTauri } from '../mock-tauri'

describe('useUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts in idle state', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const { result } = renderHook(() => useUpdater())
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('does nothing when not in Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockCheck).not.toHaveBeenCalled()
  })

  it('checks for updates after 3s delay when in Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockResolvedValue(null) // no update

    renderHook(() => useUpdater())
    expect(mockCheck).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3500)
    await vi.waitFor(() => {
      expect(mockCheck).toHaveBeenCalledOnce()
    })
  })

  it('stays idle when no update is available', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockResolvedValue(null)

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(mockCheck).toHaveBeenCalled()
    })
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('transitions to available when update is found', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockResolvedValue({
      version: '1.2.0',
      body: 'Bug fixes and improvements',
      downloadAndInstall: vi.fn(),
    })

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(result.current.status).toEqual({
        state: 'available',
        version: '1.2.0',
        notes: 'Bug fixes and improvements',
      })
    })
  })

  it('handles missing body gracefully', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockResolvedValue({
      version: '2.0.0',
      body: null,
      downloadAndInstall: vi.fn(),
    })

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(result.current.status).toEqual({
        state: 'available',
        version: '2.0.0',
        notes: undefined,
      })
    })
  })

  it('stays idle on network error (fails silently)', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        '[updater] Failed to check for updates'
      )
    })
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('dismiss returns to idle from available', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    mockCheck.mockResolvedValue({
      version: '1.2.0',
      body: 'Notes',
      downloadAndInstall: vi.fn(),
    })

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(result.current.status.state).toBe('available')
    })

    act(() => {
      result.current.actions.dismiss()
    })

    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('openReleaseNotes opens the release notes URL via openExternalUrl', async () => {
    vi.mocked(isTauri).mockReturnValue(false)

    const { result } = renderHook(() => useUpdater())

    act(() => {
      result.current.actions.openReleaseNotes()
    })

    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      'https://refactoringhq.github.io/laputa-app/'
    )
  })

  it('startDownload transitions through downloading to ready', async () => {
    vi.mocked(isTauri).mockReturnValue(true)

    const mockDownload = vi.fn(async (callback: (event: { event: string; data?: Record<string, unknown> }) => void) => {
      callback({ event: 'Started', data: { contentLength: 1000 } })
      callback({ event: 'Progress', data: { chunkLength: 500 } })
      callback({ event: 'Progress', data: { chunkLength: 500 } })
      callback({ event: 'Finished' })
    })

    mockCheck.mockResolvedValue({
      version: '1.2.0',
      body: 'Notes',
      downloadAndInstall: mockDownload,
    })

    const { result } = renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(3500)

    await vi.waitFor(() => {
      expect(result.current.status.state).toBe('available')
    })

    await act(async () => {
      await result.current.actions.startDownload()
    })

    expect(result.current.status).toEqual({ state: 'ready', version: '1.2.0' })
    expect(mockDownload).toHaveBeenCalled()
  })

  describe('checkForUpdates (manual)', () => {
    it('returns up-to-date when no update is available', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      mockCheck.mockResolvedValue(null)

      const { result } = renderHook(() => useUpdater())

      let checkResult: string | undefined
      await act(async () => {
        checkResult = await result.current.actions.checkForUpdates()
      })

      expect(checkResult).toBe('up-to-date')
      expect(result.current.status).toEqual({ state: 'idle' })
    })

    it('returns available and sets status when update exists', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      mockCheck.mockResolvedValue({
        version: '3.0.0',
        body: 'Major release',
        downloadAndInstall: vi.fn(),
      })

      const { result } = renderHook(() => useUpdater())

      let checkResult: string | undefined
      await act(async () => {
        checkResult = await result.current.actions.checkForUpdates()
      })

      expect(checkResult).toBe('available')
      expect(result.current.status).toEqual({
        state: 'available',
        version: '3.0.0',
        notes: 'Major release',
      })
    })

    it('returns error on network failure', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      mockCheck.mockRejectedValue(new Error('No internet'))

      const { result } = renderHook(() => useUpdater())

      let checkResult: string | undefined
      await act(async () => {
        checkResult = await result.current.actions.checkForUpdates()
      })

      expect(checkResult).toBe('error')
      expect(console.warn).toHaveBeenCalledWith('[updater] Failed to check for updates')
    })

    it('returns up-to-date when not in Tauri', async () => {
      vi.mocked(isTauri).mockReturnValue(false)

      const { result } = renderHook(() => useUpdater())

      let checkResult: string | undefined
      await act(async () => {
        checkResult = await result.current.actions.checkForUpdates()
      })

      expect(checkResult).toBe('up-to-date')
      expect(mockCheck).not.toHaveBeenCalled()
    })
  })
})
