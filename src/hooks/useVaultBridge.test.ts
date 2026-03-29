import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVaultBridge } from './useVaultBridge'
import type { VaultEntry } from '../types'

function makeEntry(path: string, title = 'Test'): VaultEntry {
  return { path, title, filename: path.split('/').pop()!, content: '', outgoingLinks: [], snippet: '', wordCount: 0, isA: 'Note', status: null, createdAt: null, modifiedAt: null, icon: null, tags: [] } as unknown as VaultEntry
}

describe('useVaultBridge', () => {
  const onSelectNote = vi.fn()
  let reloadVault: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    reloadVault = vi.fn().mockResolvedValue([])
  })

  function renderBridge(entries: VaultEntry[] = [], activeTabPath: string | null = null) {
    const entriesByPath = new Map(entries.map(e => [e.path, e]))
    return renderHook(() =>
      useVaultBridge({
        entriesByPath,
        resolvedPath: '/vault',
        reloadVault,
        onSelectNote,
        activeTabPath,
      }),
    )
  }

  it('opens a note by path when entry exists', () => {
    const entry = makeEntry('/vault/note.md')
    const { result } = renderBridge([entry])

    act(() => { result.current.openNoteByPath('/vault/note.md') })

    expect(onSelectNote).toHaveBeenCalledWith(entry)
    expect(reloadVault).not.toHaveBeenCalled()
  })

  it('opens a note by relative path', () => {
    const entry = makeEntry('/vault/note.md')
    const { result } = renderBridge([entry])

    act(() => { result.current.openNoteByPath('note.md') })

    expect(onSelectNote).toHaveBeenCalledWith(entry)
  })

  it('reloads vault when entry not found', async () => {
    const fresh = makeEntry('/vault/new.md')
    reloadVault.mockResolvedValue([fresh])
    const { result } = renderBridge([])

    await act(async () => { result.current.openNoteByPath('/vault/new.md') })

    expect(reloadVault).toHaveBeenCalled()
    expect(onSelectNote).toHaveBeenCalledWith(fresh)
  })

  it('handlePulseOpenNote opens existing entry', () => {
    const entry = makeEntry('/vault/pulse.md')
    const { result } = renderBridge([entry])

    act(() => { result.current.handlePulseOpenNote('pulse.md') })

    expect(onSelectNote).toHaveBeenCalledWith(entry)
  })

  it('handlePulseOpenNote does nothing for missing entry', () => {
    const { result } = renderBridge([])

    act(() => { result.current.handlePulseOpenNote('missing.md') })

    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('handleAgentFileCreated reloads and opens created note', async () => {
    const fresh = makeEntry('/vault/created.md')
    reloadVault.mockResolvedValue([fresh])
    const { result } = renderBridge([])

    await act(async () => { result.current.handleAgentFileCreated('created.md') })

    expect(reloadVault).toHaveBeenCalled()
    expect(onSelectNote).toHaveBeenCalledWith(fresh)
  })

  it('handleAgentFileModified reloads when active tab matches', () => {
    const { result } = renderBridge([], '/vault/active.md')

    act(() => { result.current.handleAgentFileModified('active.md') })

    expect(reloadVault).toHaveBeenCalled()
  })

  it('handleAgentFileModified does not reload for different tab', () => {
    const { result } = renderBridge([], '/vault/other.md')

    act(() => { result.current.handleAgentFileModified('active.md') })

    expect(reloadVault).not.toHaveBeenCalled()
  })

  it('handleAgentVaultChanged always reloads', () => {
    const { result } = renderBridge([])

    act(() => { result.current.handleAgentVaultChanged() })

    expect(reloadVault).toHaveBeenCalled()
  })
})
