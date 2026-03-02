import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditorFocus } from './useEditorFocus'

function makeTiptapMock(hasHeading = true) {
  const chainResult = { setTextSelection: vi.fn().mockReturnThis(), run: vi.fn() }
  const descendantsMock = vi.fn().mockImplementation((cb: (node: { type: { name: string }; nodeSize: number }, pos: number) => boolean | void) => {
    if (hasHeading) cb({ type: { name: 'heading' }, nodeSize: 15 }, 2)
  })
  return {
    state: { doc: { descendants: descendantsMock } },
    chain: vi.fn(() => chainResult),
    _chainResult: chainResult,
    _descendantsMock: descendantsMock,
  }
}

describe('useEditorFocus', () => {
  afterEach(() => { vi.restoreAllMocks() })

  function setup(isMounted: boolean, tiptap?: ReturnType<typeof makeTiptapMock>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal mock for test
    const editor = { focus: vi.fn(), _tiptapEditor: tiptap } as any
    const mountedRef = { current: isMounted }
    renderHook(() => useEditorFocus(editor, mountedRef))
    return { editor, tiptap }
  }

  it('focuses editor via rAF when already mounted', async () => {
    const rAF = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    const { editor } = setup(true)

    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(rAF).toHaveBeenCalled()
    expect(editor.focus).toHaveBeenCalled()
  })

  it('focuses editor via setTimeout when not yet mounted', () => {
    vi.useFakeTimers()
    const { editor } = setup(false)

    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(editor.focus).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80)
    expect(editor.focus).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cleans up event listener on unmount', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal mock for test
    const editor = { focus: vi.fn() } as any
    const mountedRef = { current: true }
    const { unmount } = renderHook(() => useEditorFocus(editor, mountedRef))

    unmount()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

    expect(editor.focus).not.toHaveBeenCalled()
  })

  describe('selectTitle behavior', () => {
    it('selects H1 text when selectTitle is true and editor is mounted', () => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
      const tiptap = makeTiptapMock(true)
      const { editor } = setup(true, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))

      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).toHaveBeenCalled()
      expect(tiptap._chainResult.setTextSelection).toHaveBeenCalledWith({ from: 3, to: 16 })
      expect(tiptap._chainResult.run).toHaveBeenCalled()
    })

    it('does not select title when selectTitle is false (default)', () => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
      const tiptap = makeTiptapMock(true)
      const { editor } = setup(true, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: false } }))

      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).not.toHaveBeenCalled()
    })

    it('does not select title when selectTitle is absent from event detail', () => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
      const tiptap = makeTiptapMock(true)
      const { editor } = setup(true, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor'))

      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).not.toHaveBeenCalled()
    })

    it('skips selection when no heading found in document', () => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
      const tiptap = makeTiptapMock(false)
      const { editor } = setup(true, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))

      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).not.toHaveBeenCalled()
    })

    it('selects H1 text after timeout when editor not yet mounted', () => {
      vi.useFakeTimers()
      // Mock rAF synchronously so the deferred selectFirstHeading call inside doFocus
      // runs immediately when requestAnimationFrame is invoked, keeping the test simple.
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })
      const tiptap = makeTiptapMock(true)
      const { editor } = setup(false, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))

      expect(editor.focus).not.toHaveBeenCalled()
      vi.advanceTimersByTime(80)
      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).toHaveBeenCalled()
      expect(tiptap._chainResult.setTextSelection).toHaveBeenCalledWith({ from: 3, to: 16 })
      vi.useRealTimers()
    })

    it('selection happens in second rAF (not first), allowing content swap to complete', () => {
      // Verify the double-rAF contract: focus in rAF1, selection deferred to rAF2.
      // This ensures the new note's blocks are applied (via queueMicrotask between frames)
      // before selectFirstHeading runs.
      const callbacks: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        callbacks.push(cb)
        return callbacks.length
      })
      const tiptap = makeTiptapMock(true)
      const { editor } = setup(true, tiptap)

      window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))

      // rAF 1 is scheduled (doFocus)
      expect(callbacks.length).toBe(1)
      callbacks[0](0)

      // After rAF 1: editor focused, but selection NOT yet triggered
      expect(editor.focus).toHaveBeenCalled()
      expect(tiptap.chain).not.toHaveBeenCalled()

      // rAF 2 is now scheduled (selectFirstHeading)
      expect(callbacks.length).toBe(2)
      callbacks[1](0)

      // After rAF 2: heading is selected
      expect(tiptap.chain).toHaveBeenCalled()
      expect(tiptap._chainResult.setTextSelection).toHaveBeenCalledWith({ from: 3, to: 16 })
      expect(tiptap._chainResult.run).toHaveBeenCalled()
    })
  })
})
