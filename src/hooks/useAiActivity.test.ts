import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAiActivity } from './useAiActivity'

let lastWsInstance: MockWebSocket | null = null

class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
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

  it('ignores non-highlight messages', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'other_action' })
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

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useAiActivity())
    unmount()
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
})
