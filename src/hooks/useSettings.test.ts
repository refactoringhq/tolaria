import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Settings } from '../types'
import { useSettings } from './useSettings'

const defaultSettings: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: null,
  github_username: null,
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
}

const savedSettings: Settings = {
  anthropic_key: 'sk-ant-test123',
  openai_key: null,
  google_key: 'AIza-test',
  github_token: null,
  github_username: null,
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
}

let mockSettingsStore: Settings = { ...defaultSettings }

const mockInvokeFn = vi.fn((cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (cmd === 'get_settings') return Promise.resolve({ ...mockSettingsStore })
  if (cmd === 'save_settings') {
    mockSettingsStore = { ...(args as { settings: Settings }).settings }
    return Promise.resolve(null)
  }
  return Promise.resolve(null)
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsStore = { ...defaultSettings }
  })

  it('returns empty settings initially', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual(defaultSettings)
    expect(result.current.loaded).toBe(false)
  })

  it('loads settings from backend on mount', async () => {
    mockSettingsStore = { ...savedSettings }
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.settings.anthropic_key).toBe('sk-ant-test123')
    expect(result.current.settings.google_key).toBe('AIza-test')
    expect(mockInvokeFn).toHaveBeenCalledWith('get_settings', {})
  })

  it('saves settings via backend', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    const newSettings: Settings = {
      anthropic_key: 'sk-ant-new',
      openai_key: 'sk-openai-new',
      google_key: null,
      github_token: null,
      github_username: null,
      auto_pull_interval_minutes: null,
      telemetry_consent: null,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
    }

    await act(async () => {
      await result.current.saveSettings(newSettings)
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('save_settings', { settings: newSettings })
    expect(result.current.settings).toEqual(newSettings)
  })

  it('handles load error gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockImplementationOnce(() => Promise.reject(new Error('no config')))

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    // Should fall back to empty settings
    expect(result.current.settings).toEqual(defaultSettings)
    warnSpy.mockRestore()
  })

  it('handles save error gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    mockInvokeFn.mockImplementationOnce(() => Promise.reject(new Error('write failed')))

    await act(async () => {
      await result.current.saveSettings(savedSettings)
    })

    // Settings should not have changed on error
    expect(result.current.settings).toEqual(defaultSettings)
    errorSpy.mockRestore()
  })
})
