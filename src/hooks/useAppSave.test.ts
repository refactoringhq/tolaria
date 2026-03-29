import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppSave } from './useAppSave'
import type { VaultEntry } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue(undefined),
}))

function makeEntry(path: string, title = 'Test', filename = 'test.md'): VaultEntry {
  return { path, title, filename, content: '', outgoingLinks: [], snippet: '', wordCount: 0, isA: 'Note', status: null, createdAt: null, modifiedAt: null, icon: null, tags: [] } as unknown as VaultEntry
}

describe('useAppSave', () => {
  const deps = {
    updateEntry: vi.fn(),
    setTabs: vi.fn(),
    setToastMessage: vi.fn(),
    loadModifiedFiles: vi.fn(),
    clearUnsaved: vi.fn(),
    unsavedPaths: new Set<string>(),
    tabs: [] as Array<{ entry: VaultEntry; content: string }>,
    activeTabPath: null as string | null,
    handleRenameNote: vi.fn().mockResolvedValue(undefined),
    replaceEntry: vi.fn(),
    resolvedPath: '/vault',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    deps.unsavedPaths = new Set()
    deps.tabs = []
    deps.activeTabPath = null
    deps.handleRenameNote.mockResolvedValue(undefined)
  })

  function renderSave(overrides = {}) {
    return renderHook(() => useAppSave({ ...deps, ...overrides }))
  }

  it('exposes contentChangeRef', () => {
    const { result } = renderSave()
    expect(result.current.contentChangeRef).toBeDefined()
    expect(typeof result.current.contentChangeRef.current).toBe('function')
  })

  it('exposes handleSave', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleSave).toBe('function')
  })

  it('exposes handleTitleSync', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleTitleSync).toBe('function')
  })

  it('exposes flushBeforeAction', () => {
    const { result } = renderSave()
    expect(typeof result.current.flushBeforeAction).toBe('function')
  })

  it('handleSave calls save with no fallback when no active tab', async () => {
    const { result } = renderSave()

    await act(async () => { await result.current.handleSave() })

    // Should not throw — just a no-op save
  })

  it('handleSave provides fallback for unsaved active tab', async () => {
    const entry = makeEntry('/vault/note.md', 'note', 'note.md')
    const unsavedPaths = new Set(['/vault/note.md'])
    const tabs = [{ entry, content: '# Hello' }]

    const { result } = renderSave({
      tabs,
      activeTabPath: '/vault/note.md',
      unsavedPaths,
    })

    await act(async () => { await result.current.handleSave() })

    // Should complete without error
  })

  it('handleContentChange is a function', () => {
    const { result } = renderSave()
    expect(typeof result.current.handleContentChange).toBe('function')
  })
})
