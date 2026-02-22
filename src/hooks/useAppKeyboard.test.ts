import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppKeyboard } from './useAppKeyboard'

function fireKey(key: string, mods: { altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    altKey: mods.altKey ?? false,
    metaKey: mods.metaKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
}

function makeActions() {
  return {
    onQuickOpen: vi.fn(),
    onCreateNote: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onTrashNote: vi.fn(),
    onArchiveNote: vi.fn(),
    onSetViewMode: vi.fn(),
    activeTabPathRef: { current: '/vault/test.md' } as React.MutableRefObject<string | null>,
    handleCloseTabRef: { current: vi.fn() } as React.MutableRefObject<(path: string) => void>,
  }
}

describe('useAppKeyboard', () => {
  afterEach(() => vi.restoreAllMocks())

  it('Option+1 sets view mode to editor-only', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('1', { altKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('editor-only')
  })

  it('Option+2 sets view mode to editor-list', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('2', { altKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('editor-list')
  })

  it('Option+3 sets view mode to all', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('3', { altKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('all')
  })

  it('does not fire view mode when Cmd+Alt pressed (not Alt-only)', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('1', { altKey: true, metaKey: true })
    expect(actions.onSetViewMode).not.toHaveBeenCalled()
  })

  it('Cmd+P triggers quick open', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('p', { metaKey: true })
    expect(actions.onQuickOpen).toHaveBeenCalled()
  })

  it('Cmd+N triggers create note', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('n', { metaKey: true })
    expect(actions.onCreateNote).toHaveBeenCalled()
  })

  it('Cmd+W closes the active tab', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('w', { metaKey: true })
    expect(actions.handleCloseTabRef.current).toHaveBeenCalledWith('/vault/test.md')
  })

  it('Alt+4 does not trigger any view mode', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('4', { altKey: true })
    expect(actions.onSetViewMode).not.toHaveBeenCalled()
  })
})
