import { act, fireEvent, render, screen } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiAgentMessage } from '../lib/aiAgentConversation'
import { createStreamCallbacks } from '../lib/aiAgentStreamCallbacks'
import { createMockAiStreamHook } from '../mock-tauri/mock-ai-stream'
import { streamAiAgent } from '../utils/streamAiAgent'
import { AiPanelView } from './AiPanel'
import type { AiPanelController } from './useAiPanelController'

const streamState = {
  responseAccRef: { current: '' },
  abortRef: { current: { aborted: false } },
  toolInputMapRef: { current: new Map<string, { tool: string; input?: string }>() },
  fileCallbacksRef: { current: undefined },
}

function startScriptedResponse(
  setMessages: React.Dispatch<React.SetStateAction<AiAgentMessage[]>>,
  setStatus: React.Dispatch<React.SetStateAction<'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'>>,
): void {
  streamState.responseAccRef.current = ''
  const callbacks = createStreamCallbacks({
    agent: 'codex',
    messageId: 'scripted-message',
    vaultPath: '/vault',
    setMessages,
    setStatus,
    abortRef: streamState.abortRef,
    responseAccRef: streamState.responseAccRef,
    toolInputMapRef: streamState.toolInputMapRef,
    fileCallbacksRef: streamState.fileCallbacksRef,
  })
  void streamAiAgent({ agent: 'codex', message: 'Say hello', vaultPath: '/vault', callbacks })
}

function MockStreamingPanel() {
  const [messages, setMessages] = useState<AiAgentMessage[]>([])
  const [status, setStatus] = useState<'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'>('idle')
  const sendMessage = () => {
    setMessages([{ id: 'scripted-message', userMessage: 'Say hello', actions: [], isStreaming: true }])
    startScriptedResponse(setMessages, setStatus)
  }
  const controller: AiPanelController = {
    agent: {
      messages,
      status,
      sendMessage: vi.fn(),
      stopMessage: vi.fn(),
      clearConversation: vi.fn(),
      addLocalMarker: vi.fn(),
      regenerateMessage: vi.fn(),
    },
    input: '',
    setInput: vi.fn(),
    linkedEntries: [],
    hasContext: false,
    isActive: status === 'thinking' || status === 'tool-executing',
    permissionMode: 'safe',
    handleSend: vi.fn(),
    handleStop: vi.fn(),
    handleNavigateWikilink: vi.fn(),
    handlePermissionModeChange: vi.fn(),
    handleNewChat: vi.fn(),
  }

  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => sendMessage() }, 'Send scripted prompt'),
    createElement(AiPanelView, { controller, onClose: vi.fn(), defaultAiAgent: 'codex' }),
  )
}

describe('scripted AI panel streams', () => {
  afterEach(() => {
    delete window.__mockHandlers
    delete window.__mockAiStream
    streamState.responseAccRef.current = ''
    streamState.abortRef.current = { aborted: false }
    streamState.toolInputMapRef.current.clear()
  })

  it('renders each released text chunk in the real AI panel', async () => {
    window.__mockHandlers = {}
    window.__mockAiStream = createMockAiStreamHook()
    window.__mockAiStream.setScript([
      { kind: 'text', text: 'Hello ' },
      { kind: 'text', text: 'frame by frame.' },
      { kind: 'done' },
    ])
    render(createElement(MockStreamingPanel))

    fireEvent.click(screen.getByRole('button', { name: 'Send scripted prompt' }))
    expect(await screen.findByText('Say hello')).toBeTruthy()
    expect(screen.queryByText('Hello')).toBeNull()

    act(() => { window.__mockAiStream?.next() })
    expect(await screen.findByText('Hello')).toBeTruthy()
    expect(screen.queryByText('frame by frame.')).toBeNull()

    act(() => { window.__mockAiStream?.next() })
    expect(await screen.findByText('Hello frame by frame.')).toBeTruthy()

    act(() => { window.__mockAiStream?.next() })
    expect(screen.getByText('Hello frame by frame.')).toBeTruthy()
  })
})
