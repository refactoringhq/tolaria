import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConflictFlow } from './useConflictFlow'
import type { VaultEntry } from '../types'

const mockInvokeFn = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))
vi.mock('../utils/url', () => ({
  openLocalFile: vi.fn(),
}))

function makeEntry(path: string): VaultEntry {
  return { path, title: 'Test', filename: path.split('/').pop()! } as unknown as VaultEntry
}

describe('useConflictFlow', () => {
  const deps = {
    resolvedPath: '/vault',
    entries: [makeEntry('/vault/note.md')],
    conflictFiles: ['note.md'],
    pausePull: vi.fn(),
    resumePull: vi.fn(),
    triggerSync: vi.fn(),
    reloadVault: vi.fn().mockResolvedValue([]),
    initConflictFiles: vi.fn(),
    openConflictResolver: vi.fn(),
    closeConflictResolver: vi.fn(),
    onSelectNote: vi.fn(),
    activeTabPath: '/vault/note.md',
    setToastMessage: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockResolvedValue(undefined)
    deps.reloadVault.mockResolvedValue([])
  })

  function renderFlow(overrides = {}) {
    return renderHook(() => useConflictFlow({ ...deps, ...overrides }))
  }

  it('opens conflict resolver with cached files', async () => {
    const { result } = renderFlow()

    await act(async () => { await result.current.handleOpenConflictResolver() })

    expect(deps.pausePull).toHaveBeenCalled()
    expect(deps.initConflictFiles).toHaveBeenCalledWith(['note.md'])
    expect(deps.openConflictResolver).toHaveBeenCalled()
  })

  it('fetches conflicts when cache is empty', async () => {
    mockInvokeFn.mockResolvedValueOnce(['other.md'])
    const { result } = renderFlow({ conflictFiles: [] })

    await act(async () => { await result.current.handleOpenConflictResolver() })

    expect(mockInvokeFn).toHaveBeenCalledWith('get_conflict_files', { vaultPath: '/vault' })
    expect(deps.initConflictFiles).toHaveBeenCalledWith(['other.md'])
  })

  it('shows toast when no conflicts found', async () => {
    mockInvokeFn.mockResolvedValueOnce([])
    const { result } = renderFlow({ conflictFiles: [] })

    await act(async () => { await result.current.handleOpenConflictResolver() })

    expect(deps.setToastMessage).toHaveBeenCalledWith('No merge conflicts to resolve')
    expect(deps.openConflictResolver).not.toHaveBeenCalled()
  })

  it('closes conflict resolver and resumes pull', () => {
    const { result } = renderFlow()

    act(() => { result.current.handleCloseConflictResolver() })

    expect(deps.resumePull).toHaveBeenCalled()
    expect(deps.closeConflictResolver).toHaveBeenCalled()
  })

  it('resolves inline and commits when all resolved', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_conflict_files') return Promise.resolve([])
      if (cmd === 'get_note_content') return Promise.resolve('resolved content')
      return Promise.resolve(undefined)
    })

    const { result } = renderFlow()

    await act(async () => { await result.current.handleKeepMine('/vault/note.md') })

    expect(mockInvokeFn).toHaveBeenCalledWith('git_resolve_conflict', {
      vaultPath: '/vault', file: 'note.md', strategy: 'ours',
    })
    expect(mockInvokeFn).toHaveBeenCalledWith('git_commit_conflict_resolution', { vaultPath: '/vault' })
    expect(deps.setToastMessage).toHaveBeenCalledWith('All conflicts resolved — merge committed')
  })

  it('shows remaining count when not all resolved', async () => {
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_conflict_files') return Promise.resolve(['other.md'])
      if (cmd === 'get_note_content') return Promise.resolve('content')
      return Promise.resolve(undefined)
    })

    const { result } = renderFlow()

    await act(async () => { await result.current.handleKeepTheirs('/vault/note.md') })

    expect(deps.setToastMessage).toHaveBeenCalledWith('Resolved — 1 conflict remaining')
  })

  it('isConflicted is true when active tab matches a conflict file', () => {
    const { result } = renderFlow()
    expect(result.current.isConflicted).toBe(true)
  })

  it('isConflicted is false when no active tab', () => {
    const { result } = renderFlow({ activeTabPath: null })
    expect(result.current.isConflicted).toBe(false)
  })

  it('isConflicted is false when active tab has no conflict', () => {
    const { result } = renderFlow({ activeTabPath: '/vault/other.md', conflictFiles: ['note.md'] })
    expect(result.current.isConflicted).toBe(false)
  })
})
