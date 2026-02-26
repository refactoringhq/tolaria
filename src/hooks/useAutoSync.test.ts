import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoSync } from './useAutoSync'
import type { GitPullResult } from '../types'

const mockInvokeFn = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

const MOCK_COMMIT_INFO = { shortHash: 'a1b2c3d', commitUrl: 'https://github.com/owner/repo/commit/abc' }

function upToDate(): GitPullResult {
  return { status: 'up_to_date', message: 'Already up to date', updatedFiles: [], conflictFiles: [] }
}

function updated(files: string[]): GitPullResult {
  return { status: 'updated', message: `${files.length} file(s) updated`, updatedFiles: files, conflictFiles: [] }
}

function conflict(files: string[]): GitPullResult {
  return { status: 'conflict', message: `Merge conflict in ${files.length} file(s)`, updatedFiles: [], conflictFiles: files }
}

describe('useAutoSync', () => {
  const onVaultUpdated = vi.fn()
  const onConflict = vi.fn()
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(MOCK_COMMIT_INFO)
      return Promise.resolve(upToDate())
    })
  })

  function renderSync(intervalMinutes: number | null = 5) {
    return renderHook(() =>
      useAutoSync({
        vaultPath: '/Users/luca/Laputa',
        intervalMinutes,
        onVaultUpdated,
        onConflict,
        onToast,
      }),
    )
  }

  it('pulls on mount (app launch)', async () => {
    renderSync()
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('git_pull', { vaultPath: '/Users/luca/Laputa' })
    })
  })

  it('sets syncStatus to idle after up_to_date pull', async () => {
    const { result } = renderSync()
    await waitFor(() => {
      expect(result.current.syncStatus).toBe('idle')
      expect(result.current.lastSyncTime).not.toBeNull()
    })
  })

  it('calls onVaultUpdated and onToast when pull has updates', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(MOCK_COMMIT_INFO)
      return Promise.resolve(updated(['note.md', 'project/plan.md']))
    })
    const { result } = renderSync()

    await waitFor(() => {
      expect(onVaultUpdated).toHaveBeenCalled()
      expect(onToast).toHaveBeenCalledWith('Pulled 2 update(s) from remote')
      expect(result.current.syncStatus).toBe('idle')
    })
  })

  it('calls onConflict and sets conflict status when pull has conflicts', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(MOCK_COMMIT_INFO)
      return Promise.resolve(conflict(['note.md']))
    })
    const { result } = renderSync()

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledWith(['note.md'])
      expect(result.current.syncStatus).toBe('conflict')
      expect(result.current.conflictFiles).toEqual(['note.md'])
    })
  })

  it('sets error status when pull fails', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(null)
      return Promise.reject(new Error('Network error'))
    })
    const { result } = renderSync()

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error')
    })
  })

  it('pulls on window focus', async () => {
    renderSync()
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('git_pull', { vaultPath: '/Users/luca/Laputa' })
    })

    mockInvokeFn.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('git_pull', { vaultPath: '/Users/luca/Laputa' })
    })
  })

  it('triggerSync allows manual pull', async () => {
    const { result } = renderSync()
    await waitFor(() => {
      expect(result.current.syncStatus).toBe('idle')
    })

    mockInvokeFn.mockClear()
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(MOCK_COMMIT_INFO)
      return Promise.resolve(updated(['note.md']))
    })

    await act(async () => {
      result.current.triggerSync()
    })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('git_pull', { vaultPath: '/Users/luca/Laputa' })
      expect(onToast).toHaveBeenCalledWith('Pulled 1 update(s) from remote')
    })
  })

  it('handles no_remote status silently', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(null)
      return Promise.resolve({
        status: 'no_remote', message: 'No remote configured', updatedFiles: [], conflictFiles: [],
      })
    })
    const { result } = renderSync()

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('idle')
      expect(onVaultUpdated).not.toHaveBeenCalled()
      expect(onToast).not.toHaveBeenCalled()
    })
  })

  it('does not fire concurrent pulls', async () => {
    let resolveFirst: ((v: GitPullResult) => void) | null = null
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(MOCK_COMMIT_INFO)
      return new Promise<GitPullResult>((r) => { resolveFirst = r })
    })

    const { result } = renderSync()

    // First pull is in flight (git_pull called once)
    const pullCalls = () => mockInvokeFn.mock.calls.filter((c: unknown[]) => c[0] === 'git_pull').length
    expect(pullCalls()).toBe(1)

    // Trigger a manual sync while first is still running
    act(() => {
      result.current.triggerSync()
    })

    // Should NOT have fired a second git_pull call
    expect(pullCalls()).toBe(1)

    // Resolve the first
    await act(async () => {
      resolveFirst?.(upToDate())
    })
  })

  it('exposes lastCommitInfo after sync', async () => {
    const { result } = renderSync()
    await waitFor(() => {
      expect(result.current.lastCommitInfo).toEqual(MOCK_COMMIT_INFO)
    })
  })

  it('handles error status from git_pull result', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_last_commit_info') return Promise.resolve(null)
      return Promise.resolve({
        status: 'error', message: 'remote: Not Found', updatedFiles: [], conflictFiles: [],
      })
    })
    const { result } = renderSync()

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error')
    })
  })
})
