import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppKeyboard } from './useAppKeyboard'

function fireKey(key: string, mods: { altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    altKey: mods.altKey ?? false,
    metaKey: mods.metaKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
}

function makeActions() {
  return {
    onQuickOpen: vi.fn(),
    onCommandPalette: vi.fn(),
    onSearch: vi.fn(),
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

  it('Cmd+1 sets view mode to editor-only', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('1', { metaKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('editor-only')
  })

  it('Cmd+2 sets view mode to editor-list', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('2', { metaKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('editor-list')
  })

  it('Cmd+3 sets view mode to all', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('3', { metaKey: true })
    expect(actions.onSetViewMode).toHaveBeenCalledWith('all')
  })

  it('does not fire view mode when Cmd+Alt pressed', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('1', { metaKey: true, altKey: true })
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

  it('Cmd+K triggers command palette', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('k', { metaKey: true })
    expect(actions.onCommandPalette).toHaveBeenCalled()
  })

  it('Cmd+Shift+F triggers search', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('f', { metaKey: true, shiftKey: true })
    expect(actions.onSearch).toHaveBeenCalled()
  })

  it('Cmd+Shift+F does not trigger other shortcuts', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('f', { metaKey: true, shiftKey: true })
    expect(actions.onQuickOpen).not.toHaveBeenCalled()
    expect(actions.onCreateNote).not.toHaveBeenCalled()
  })

  function withFocusedInput(fn: () => void) {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    try { fn() } finally { document.body.removeChild(input) }
  }

  it('Cmd+Backspace does not trash note when text input is focused', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    withFocusedInput(() => {
      fireKey('Backspace', { metaKey: true })
      expect(actions.onTrashNote).not.toHaveBeenCalled()
    })
  })

  it('Cmd+Backspace trashes note when no text input is focused', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    fireKey('Backspace', { metaKey: true })
    expect(actions.onTrashNote).toHaveBeenCalledWith('/vault/test.md')
  })

  it('Cmd+K still works when text input is focused', () => {
    const actions = makeActions()
    renderHook(() => useAppKeyboard(actions))
    withFocusedInput(() => {
      fireKey('k', { metaKey: true })
      expect(actions.onCommandPalette).toHaveBeenCalled()
    })
  })
})
