import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCodeMirror, type CodeMirrorCallbacks } from './useCodeMirror'

const noop = () => {}
const noopCallbacks: CodeMirrorCallbacks = {
  onDocChange: noop,
  onCursorActivity: noop,
  onSave: noop,
  onEscape: () => false,
}

describe('useCodeMirror', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('creates an EditorView in the container', () => {
    const ref = { current: container }
    const { result } = renderHook(() =>
      useCodeMirror(ref, 'hello world', false, noopCallbacks),
    )
    expect(result.current.current).not.toBeNull()
    expect(container.querySelector('.cm-editor')).toBeInTheDocument()
  })

  it('calls requestMeasure when laputa-zoom-change event fires', () => {
    const ref = { current: container }
    const { result } = renderHook(() =>
      useCodeMirror(ref, 'hello', false, noopCallbacks),
    )
    const view = result.current.current!
    const spy = vi.spyOn(view, 'requestMeasure')

    act(() => {
      window.dispatchEvent(new Event('laputa-zoom-change'))
    })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('stops listening for zoom changes after unmount', () => {
    const ref = { current: container }
    const { result, unmount } = renderHook(() =>
      useCodeMirror(ref, 'hello', false, noopCallbacks),
    )
    const view = result.current.current!
    const spy = vi.spyOn(view, 'requestMeasure')

    unmount()

    act(() => {
      window.dispatchEvent(new Event('laputa-zoom-change'))
    })

    // After unmount, the listener should be removed — requestMeasure should NOT be called.
    // (The view is also destroyed on unmount, so this verifies cleanup.)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('installs zoomCursorFix that overrides posAtCoords on the view instance', () => {
    const ref = { current: container }
    const { result } = renderHook(() =>
      useCodeMirror(ref, 'hello world', false, noopCallbacks),
    )
    const view = result.current.current!
    // The extension overrides posAtCoords on the instance (not the prototype)
    expect(Object.prototype.hasOwnProperty.call(view, 'posAtCoords')).toBe(true)
  })
})
