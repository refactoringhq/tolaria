import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiAgentMessage } from './aiAgentConversation'

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }))

vi.mock('./telemetry', () => ({
  trackEvent: trackEventMock,
}))

import { createStreamCallbacks } from './aiAgentStreamCallbacks'

function createMessageStore(initialMessages: AiAgentMessage[]) {
  let messages = initialMessages

  return {
    getMessages: () => messages,
    setMessages: (next: AiAgentMessage[] | ((current: AiAgentMessage[]) => AiAgentMessage[])) => {
      messages = typeof next === 'function' ? next(messages) : next
    },
  }
}

describe('AI response stream batching', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('bounds state commits for 2,000 chunks and flushes the exact final response', () => {
    const messages = createMessageStore([{
      id: 'msg-1',
      userMessage: 'Question',
      actions: [],
      isStreaming: true,
    }])
    const setMessages = vi.fn(messages.setMessages)
    const responseAccRef = { current: '' }
    const scheduledFrames: FrameRequestCallback[] = []
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      scheduledFrames.push(callback)
      return scheduledFrames.length
    })
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const callbacks = createStreamCallbacks({
      agent: 'codex',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages,
      setStatus: vi.fn(),
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    for (let index = 0; index < 2_000; index += 1) callbacks.onText('x')

    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(scheduledFrames).toHaveLength(1)
    expect(setMessages).not.toHaveBeenCalled()
    scheduledFrames[0]?.(0)
    expect(setMessages).toHaveBeenCalledTimes(1)
    expect(messages.getMessages()[0]?.response).toBe('x'.repeat(2_000))

    callbacks.onDone()
    expect(messages.getMessages()[0]?.response).toBe('x'.repeat(2_000))
    expect(messages.getMessages()[0]?.isStreaming).toBe(false)
    expect(setMessages.mock.calls.length).toBeLessThanOrEqual(2)
  })
})
