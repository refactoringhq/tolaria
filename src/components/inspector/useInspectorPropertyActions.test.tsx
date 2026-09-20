import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../../types'
import { useInspectorPropertyActions } from './useInspectorPropertyActions'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    aliases: [],
    archived: false,
    belongsTo: [],
    color: null,
    createdAt: null,
    favorite: false,
    fileSize: 64,
    filename: 'untitled-note-1.md',
    icon: null,
    isA: 'Note',
    modifiedAt: 1,
    outgoingLinks: [],
    path: '/vault/untitled-note-1.md',
    relatedTo: [],
    relationships: {},
    snippet: '',
    status: null,
    tags: [],
    title: 'Renamed note',
    wordCount: 0,
    ...overrides,
  }
}

describe('useInspectorPropertyActions', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('replays a property update after the same note is auto-renamed', async () => {
    const onUpdateFrontmatter = vi.fn().mockResolvedValue(undefined)
    const entry = makeEntry()
    const { result, rerender } = renderHook(
      ({ currentEntry }) => useInspectorPropertyActions({
        entry: currentEntry,
        onUpdateFrontmatter,
      }),
      { initialProps: { currentEntry: entry } },
    )

    await act(async () => {
      await result.current.handleUpdateProperty?.('type', 'Project')
    })
    rerender({
      currentEntry: makeEntry({
        createdAt: 2,
        filename: 'renamed-note.md',
        path: '/vault/renamed-note.md',
      }),
    })
    await act(async () => vi.runAllTimersAsync())

    expect(onUpdateFrontmatter).toHaveBeenNthCalledWith(
      1,
      '/vault/untitled-note-1.md',
      'type',
      'Project',
      { requireActivePath: '/vault/untitled-note-1.md' },
    )
    expect(onUpdateFrontmatter).toHaveBeenNthCalledWith(
      2,
      '/vault/renamed-note.md',
      'type',
      'Project',
      { requireActivePath: '/vault/renamed-note.md' },
    )
  })

  it('does not replay a pending update onto a different note', async () => {
    const onUpdateFrontmatter = vi.fn().mockResolvedValue(undefined)
    const entry = makeEntry()
    const { result, rerender } = renderHook(
      ({ currentEntry }) => useInspectorPropertyActions({
        entry: currentEntry,
        onUpdateFrontmatter,
      }),
      { initialProps: { currentEntry: entry } },
    )

    await act(async () => {
      await result.current.handleUpdateProperty?.('status', 'Done')
    })
    rerender({
      currentEntry: makeEntry({
        fileSize: 512,
        path: '/vault/another-note.md',
        title: 'Another note',
        wordCount: 20,
      }),
    })
    await act(async () => vi.runAllTimersAsync())

    expect(onUpdateFrontmatter).toHaveBeenCalledOnce()
  })
})
