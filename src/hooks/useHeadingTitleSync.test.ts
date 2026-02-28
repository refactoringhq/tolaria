import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHeadingTitleSync } from './useHeadingTitleSync'

describe('useHeadingTitleSync', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls onTitleSync after debounce when H1 differs from title', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Old Title', onTitleSync })
    )

    act(() => { result.current.onH1Changed('New Title') })
    expect(onTitleSync).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).toHaveBeenCalledWith('/note.md', 'New Title')
  })

  it('does not call onTitleSync when H1 matches current title', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Same Title', onTitleSync })
    )

    act(() => { result.current.onH1Changed('Same Title') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).not.toHaveBeenCalled()
  })

  it('does not call onTitleSync when H1 is null', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Title', onTitleSync })
    )

    act(() => { result.current.onH1Changed(null) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).not.toHaveBeenCalled()
  })

  it('debounces rapid H1 changes and uses last value', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Old', onTitleSync })
    )

    act(() => { result.current.onH1Changed('New 1') })
    act(() => { vi.advanceTimersByTime(200) })
    act(() => { result.current.onH1Changed('New 2') })
    act(() => { vi.advanceTimersByTime(200) })
    act(() => { result.current.onH1Changed('New 3') })
    act(() => { vi.advanceTimersByTime(500) })

    expect(onTitleSync).toHaveBeenCalledTimes(1)
    expect(onTitleSync).toHaveBeenCalledWith('/note.md', 'New 3')
  })

  it('does not call onTitleSync when no active tab', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: null, currentTitle: null, onTitleSync })
    )

    act(() => { result.current.onH1Changed('Title') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).not.toHaveBeenCalled()
  })

  it('resets sync state when active tab changes', () => {
    const onTitleSync = vi.fn()
    const { result, rerender } = renderHook(
      ({ path, title }) => useHeadingTitleSync({ activeTabPath: path, currentTitle: title, onTitleSync }),
      { initialProps: { path: '/a.md', title: 'A' } }
    )

    // Break sync on tab A
    act(() => { result.current.onManualRename('Custom', 'A H1') })

    // H1 change should be ignored (sync broken)
    act(() => { result.current.onH1Changed('New A') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).not.toHaveBeenCalled()

    // Switch to tab B — sync resets
    rerender({ path: '/b.md', title: 'B' })

    // H1 change should now work
    act(() => { result.current.onH1Changed('New B') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).toHaveBeenCalledWith('/b.md', 'New B')
  })

  it('breaks sync when manual rename differs from H1', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Title', onTitleSync })
    )

    act(() => { result.current.onManualRename('Custom Name', 'Title') })

    // H1 changes should be ignored
    act(() => { result.current.onH1Changed('New H1') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).not.toHaveBeenCalled()
  })

  it('does not break sync when manual rename matches H1', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Old', onTitleSync })
    )

    act(() => { result.current.onManualRename('Same as H1', 'Same as H1') })

    // Sync should still be active
    act(() => { result.current.onH1Changed('Updated') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).toHaveBeenCalledWith('/note.md', 'Updated')
  })

  it('does not break sync when H1 is null during manual rename', () => {
    const onTitleSync = vi.fn()
    const { result } = renderHook(() =>
      useHeadingTitleSync({ activeTabPath: '/note.md', currentTitle: 'Title', onTitleSync })
    )

    act(() => { result.current.onManualRename('New Name', null) })

    // Sync should still be active (no H1 to compare)
    act(() => { result.current.onH1Changed('H1 Text') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onTitleSync).toHaveBeenCalledWith('/note.md', 'H1 Text')
  })

  it('clears pending debounce timer on tab switch', () => {
    const onTitleSync = vi.fn()
    const { result, rerender } = renderHook(
      ({ path, title }) => useHeadingTitleSync({ activeTabPath: path, currentTitle: title, onTitleSync }),
      { initialProps: { path: '/a.md', title: 'A' } }
    )

    act(() => { result.current.onH1Changed('New A') })
    // Switch tab before debounce fires
    rerender({ path: '/b.md', title: 'B' })
    act(() => { vi.advanceTimersByTime(500) })

    // Should NOT fire for old tab
    expect(onTitleSync).not.toHaveBeenCalled()
  })
})
