import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvokeFn = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('../utils/vault-dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/vault-dialog')>()
  return {
    ...actual,
    pickFolder: vi.fn(),
  }
})

import { NativeFolderPickerBlockedError, pickFolder } from '../utils/vault-dialog'
import { useGettingStartedClone } from './useGettingStartedClone'

describe('useGettingStartedClone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when the folder picker is cancelled', async () => {
    vi.mocked(pickFolder).mockResolvedValue(null)

    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useGettingStartedClone({ onError, onSuccess }))

    await act(async () => {
      await result.current()
    })

    expect(mockInvokeFn).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('clones into a child Getting Started folder and reports the canonical path', async () => {
    vi.mocked(pickFolder).mockResolvedValue('/Users/luca/Documents')
    mockInvokeFn.mockResolvedValue('/Users/luca/Documents/Getting Started')

    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useGettingStartedClone({ onError, onSuccess }))

    await act(async () => {
      await result.current()
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('create_getting_started_vault', {
      targetPath: '/Users/luca/Documents/Getting Started',
    })
    expect(onSuccess).toHaveBeenCalledWith('/Users/luca/Documents/Getting Started', 'Getting Started')
    expect(onError).not.toHaveBeenCalled()
  })

  it('surfaces a friendly message for download failures', async () => {
    vi.mocked(pickFolder).mockResolvedValue('/Users/luca/Documents')
    mockInvokeFn.mockRejectedValue('git clone failed: fatal: unable to access')

    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useGettingStartedClone({ onError, onSuccess }))

    await act(async () => {
      await result.current()
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('Could not download Getting Started vault. Check your connection and try again.')
  })

  it('surfaces the restart-required message when folder picking is blocked after update install', async () => {
    vi.mocked(pickFolder).mockRejectedValue(new NativeFolderPickerBlockedError())

    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useGettingStartedClone({ onError, onSuccess }))

    await act(async () => {
      await result.current()
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      'Tolaria needs a restart before macOS can open another folder picker. Restart to apply the downloaded update and try again.',
    )
  })
})
