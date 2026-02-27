import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditorFocus } from './useEditorFocus'

describe('useEditorFocus', () => {
  afterEach(() => { vi.restoreAllMocks() })

  function setup(isMounted: boolean) {
    const editor = { focus: vi.fn() }
    const mountedRef = { current: isMounted }
    renderHook(() => useEditorFocus(editor, mountedRef))
    return editor
  }

  it('focuses editor via rAF when already mounted', async () => {
    const rAF = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    const editor = setup(true)

    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(rAF).toHaveBeenCalled()
    expect(editor.focus).toHaveBeenCalled()
  })

  it('focuses editor via setTimeout when not yet mounted', () => {
    vi.useFakeTimers()
    const editor = setup(false)

    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(editor.focus).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80)
    expect(editor.focus).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cleans up event listener on unmount', () => {
    const editor = { focus: vi.fn() }
    const mountedRef = { current: true }
    const { unmount } = renderHook(() => useEditorFocus(editor, mountedRef))

    unmount()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(editor.focus).not.toHaveBeenCalled()
  })
})
