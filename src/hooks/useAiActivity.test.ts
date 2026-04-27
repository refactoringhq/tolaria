import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAiActivity } from './useAiActivity'

let lastWsInstance: MockWebSocket | null = null

class MockWebSocket {
  static OPEN = 1
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  close = vi.fn()
  readyState = MockWebSocket.OPEN
  url: string

  constructor(url: string) {
    this.url = url
    lastWsInstance = this // eslint-disable-line @typescript-eslint/no-this-alias
  }
}

beforeEach(() => {
  lastWsInstance = null
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function sendWsMessage(data: Record<string, unknown>) {
  lastWsInstance?.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
}

describe('useAiActivity', () => {
  it('initializes with null highlight', () => {
    const { result } = renderHook(() => useAiActivity())
    expect(result.current.highlightElement).toBeNull()
    expect(result.current.highlightPath).toBeNull()
  })

  it('connects to ws://localhost:9711', () => {
    renderHook(() => useAiActivity())
    expect(lastWsInstance).not.toBeNull()
    expect(lastWsInstance!.url).toBe('ws://localhost:9711')
  })

  it('sets highlight on ui_action highlight message', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'editor', path: '/vault/test.md' })
    })
    expect(result.current.highlightElement).toBe('editor')
    expect(result.current.highlightPath).toBe('/vault/test.md')
  })

  it('auto-clears highlight after 800ms', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'tab', path: '/vault/note.md' })
    })
    expect(result.current.highlightElement).toBe('tab')
    act(() => { vi.advanceTimersByTime(800) })
    expect(result.current.highlightElement).toBeNull()
    expect(result.current.highlightPath).toBeNull()
  })

  it('resets timer on repeated highlight messages', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'editor' })
    })
    act(() => { vi.advanceTimersByTime(500) })
    // Second message resets the timer
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'notelist' })
    })
    expect(result.current.highlightElement).toBe('notelist')
    act(() => { vi.advanceTimersByTime(500) })
    // Still active — only 500ms since the second message
    expect(result.current.highlightElement).toBe('notelist')
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.highlightElement).toBeNull()
  })

  it('ignores non-ui_action messages', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'other', action: 'highlight', element: 'editor' })
    })
    expect(result.current.highlightElement).toBeNull()
  })

  it('ignores malformed JSON', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      lastWsInstance?.onmessage?.(new MessageEvent('message', { data: 'not json' }))
    })
    expect(result.current.highlightElement).toBeNull()
  })

  it('closes WebSocket on unmount when already open', () => {
    const { unmount } = renderHook(() => useAiActivity())
    lastWsInstance!.readyState = MockWebSocket.OPEN
    unmount()
    expect(lastWsInstance!.close).toHaveBeenCalled()
  })

  it('does not close WebSocket on unmount when still connecting', () => {
    const { unmount } = renderHook(() => useAiActivity())
    lastWsInstance!.readyState = 0 // CONNECTING
    unmount()
    expect(lastWsInstance!.close).not.toHaveBeenCalled()
  })

  it('closes WebSocket via onopen if mounted is false by the time connection opens', () => {
    const { unmount } = renderHook(() => useAiActivity())
    lastWsInstance!.readyState = 0 // CONNECTING
    unmount()
    lastWsInstance!.readyState = MockWebSocket.OPEN
    lastWsInstance!.onopen?.()
    expect(lastWsInstance!.close).toHaveBeenCalled()
  })

  it('handles highlight with no path', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'properties' })
    })
    expect(result.current.highlightElement).toBe('properties')
    expect(result.current.highlightPath).toBeNull()
  })

  it('calls onOpenNote callback on open_note action', () => {
    const onOpenNote = vi.fn()
    renderHook(() => useAiActivity({ onOpenNote }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_note', path: 'project/foo.md' })
    })
    expect(onOpenNote).toHaveBeenCalledWith('project/foo.md')
  })

  it('calls onOpenTab callback on open_tab action', () => {
    const onOpenTab = vi.fn()
    renderHook(() => useAiActivity({ onOpenTab }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_tab', path: 'note/bar.md' })
    })
    expect(onOpenTab).toHaveBeenCalledWith('note/bar.md')
  })

  it('calls onSetFilter callback on set_filter action', () => {
    const onSetFilter = vi.fn()
    renderHook(() => useAiActivity({ onSetFilter }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'set_filter', filterType: 'Project' })
    })
    expect(onSetFilter).toHaveBeenCalledWith('Project')
  })

  it('calls onVaultChanged callback on vault_changed action', () => {
    const onVaultChanged = vi.fn()
    renderHook(() => useAiActivity({ onVaultChanged }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'vault_changed', path: 'note/new.md' })
    })
    expect(onVaultChanged).toHaveBeenCalledWith('note/new.md')
  })

  it('does not call onOpenNote when path is missing', () => {
    const onOpenNote = vi.fn()
    renderHook(() => useAiActivity({ onOpenNote }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_note' })
    })
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('reconnects on close after delay', () => {
    renderHook(() => useAiActivity())
    const firstWs = lastWsInstance
    act(() => { firstWs?.onclose?.() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(lastWsInstance).not.toBe(firstWs)
  })
})
