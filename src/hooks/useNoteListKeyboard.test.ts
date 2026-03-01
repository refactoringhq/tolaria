import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useNoteListKeyboard } from './useNoteListKeyboard'
import type { VaultEntry } from '../types'

function makeEntry(path: string, title: string): VaultEntry {
  return {
    path,
    title,
    filename: `${title}.md`,
    isA: 'Note',
    aliases: [],
    tags: [],
    snippet: '',
    status: null,
    favorite: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    createdAt: null,
    modifiedAt: null,
    fileSize: 100,
    color: null,
    icon: null,
    outgoingLinks: [],
    relationships: {},
  }
}

function keyEvent(key: string, opts: Partial<React.KeyboardEvent> = {}): React.KeyboardEvent {
  return { key, preventDefault: vi.fn(), metaKey: false, ctrlKey: false, altKey: false, ...opts } as unknown as React.KeyboardEvent
}

describe('useNoteListKeyboard', () => {
  const items = [makeEntry('/a.md', 'A'), makeEntry('/b.md', 'B'), makeEntry('/c.md', 'C')]
  const onOpen = vi.fn()

  it('initializes with no highlight', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    expect(result.current.highlightedPath).toBeNull()
  })

  it('ArrowDown highlights first item from no selection', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBe('/a.md')
  })

  it('ArrowDown advances highlight', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBe('/b.md')
  })

  it('ArrowDown clamps at end of list', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBe('/c.md')
  })

  it('ArrowUp highlights last item from no selection', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowUp')))
    expect(result.current.highlightedPath).toBe('/c.md')
  })

  it('ArrowUp clamps at start of list', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('ArrowUp')))
    expect(result.current.highlightedPath).toBe('/a.md')
  })

  it('Enter opens highlighted note', () => {
    const open = vi.fn()
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen: open, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    act(() => result.current.handleKeyDown(keyEvent('Enter')))
    expect(open).toHaveBeenCalledWith(items[0])
  })

  it('Enter does nothing when no item highlighted', () => {
    const open = vi.fn()
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen: open, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('Enter')))
    expect(open).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: false }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBeNull()
  })

  it('does nothing with modifier keys', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown', { metaKey: true } as Partial<React.KeyboardEvent>)))
    expect(result.current.highlightedPath).toBeNull()
  })

  it('resets highlight when items change', () => {
    const { result, rerender } = renderHook(
      ({ items: hookItems }) => useNoteListKeyboard({ items: hookItems, selectedNotePath: null, onOpen, enabled: true }),
      { initialProps: { items } },
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBe('/a.md')

    rerender({ items: [makeEntry('/d.md', 'D')] })
    expect(result.current.highlightedPath).toBeNull()
  })

  it('handleFocus sets highlight to selected note', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: '/b.md', onOpen, enabled: true }),
    )
    act(() => result.current.handleFocus())
    expect(result.current.highlightedPath).toBe('/b.md')
  })

  it('handleFocus defaults to first item when no selected note', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items, selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleFocus())
    expect(result.current.highlightedPath).toBe('/a.md')
  })

  it('does nothing on empty item list', () => {
    const { result } = renderHook(() =>
      useNoteListKeyboard({ items: [], selectedNotePath: null, onOpen, enabled: true }),
    )
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')))
    expect(result.current.highlightedPath).toBeNull()
  })
})
