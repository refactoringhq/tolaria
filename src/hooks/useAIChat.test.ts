import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Capture what streamClaudeChat receives
const streamClaudeChatMock = vi.fn<
  Parameters<typeof import('../utils/ai-chat').streamClaudeChat>,
  ReturnType<typeof import('../utils/ai-chat').streamClaudeChat>
>()

vi.mock('../utils/ai-chat', async () => {
  const actual = await vi.importActual<typeof import('../utils/ai-chat')>('../utils/ai-chat')
  return {
    ...actual,
    streamClaudeChat: (...args: Parameters<typeof actual.streamClaudeChat>) => {
      streamClaudeChatMock(...args)
      // Simulate async: call onDone after a tick
      const callbacks = args[3]
      setTimeout(() => {
        callbacks.onInit?.('test-session')
        callbacks.onText('mock response')
        callbacks.onDone()
      }, 10)
      return Promise.resolve('test-session')
    },
  }
})

import { useAIChat } from './useAIChat'

beforeEach(() => {
  streamClaudeChatMock.mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAIChat', () => {
  const emptyContent: Record<string, string> = {}

  it('sends first message without history', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    act(() => { result.current.sendMessage('hello') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(1)
    const message = streamClaudeChatMock.mock.calls[0][0]
    // First message: no history, so just the plain text
    expect(message).toBe('hello')
  })

  it('includes conversation history in second message', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Send first message
    act(() => { result.current.sendMessage('What is Rust?') })
    // Wait for mock response
    await act(async () => { vi.advanceTimersByTime(50) })

    // Now messages state has: [user: What is Rust?, assistant: mock response]
    expect(result.current.messages).toHaveLength(2)

    // Send second message
    act(() => { result.current.sendMessage('Tell me more') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(2)
    const secondMessage = streamClaudeChatMock.mock.calls[1][0]
    // Should contain conversation history
    expect(secondMessage).toContain('What is Rust?')
    expect(secondMessage).toContain('mock response')
    expect(secondMessage).toContain('Tell me more')
  })

  it('resets history on clearConversation', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Send a message and get response
    act(() => { result.current.sendMessage('hello') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Clear conversation
    act(() => { result.current.clearConversation() })
    expect(result.current.messages).toHaveLength(0)

    // Send new message — should have no history
    act(() => { result.current.sendMessage('fresh start') })

    const lastCall = streamClaudeChatMock.mock.calls[streamClaudeChatMock.mock.calls.length - 1]
    expect(lastCall[0]).toBe('fresh start')
  })

  it('accumulates multiple exchanges in history', async () => {
    const { result } = renderHook(() => useAIChat(emptyContent, []))

    // Exchange 1
    act(() => { result.current.sendMessage('Q1') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Exchange 2
    act(() => { result.current.sendMessage('Q2') })
    await act(async () => { vi.advanceTimersByTime(50) })

    // Exchange 3
    act(() => { result.current.sendMessage('Q3') })

    expect(streamClaudeChatMock).toHaveBeenCalledTimes(3)
    const thirdMessage = streamClaudeChatMock.mock.calls[2][0]
    // Should contain all prior exchanges
    expect(thirdMessage).toContain('Q1')
    expect(thirdMessage).toContain('Q2')
    expect(thirdMessage).toContain('Q3')
  })
})
