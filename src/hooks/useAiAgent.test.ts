import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { detectFileOperation, parseBashFileCreation, agentMessagesToChatHistory, useAiAgent } from './useAiAgent'
import type { AgentFileCallbacks, AiAgentMessage } from './useAiAgent'
import { streamClaudeAgent } from '../utils/ai-agent'

vi.mock('../utils/ai-agent', () => ({
  streamClaudeAgent: vi.fn(),
  buildAgentSystemPrompt: vi.fn(() => 'default-system-prompt'),
}))

const mockStreamClaudeAgent = vi.mocked(streamClaudeAgent)

const VAULT = '/Users/luca/Laputa'

function makeCallbacks() {
  return {
    onFileCreated: vi.fn(),
    onFileModified: vi.fn(),
    onVaultChanged: vi.fn(),
  } satisfies AgentFileCallbacks
}

describe('detectFileOperation', () => {
  it('calls onFileCreated for Write tool with .md in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/test.md')
    expect(cb.onFileModified).not.toHaveBeenCalled()
  })

  it('calls onFileModified for Edit tool with .md in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Edit', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileModified).toHaveBeenCalledWith('note/test.md')
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores non-md files', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/image.png` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores files outside vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: '/tmp/other.md' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores unknown tool names', () => {
    const cb = makeCallbacks()
    detectFileOperation('Read', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
    expect(cb.onFileModified).not.toHaveBeenCalled()
  })

  it('calls onVaultChanged when Write input is undefined', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', undefined, VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
    expect(cb.onVaultChanged).toHaveBeenCalled()
  })

  it('calls onVaultChanged when Edit input is undefined', () => {
    const cb = makeCallbacks()
    detectFileOperation('Edit', undefined, VAULT, cb)
    expect(cb.onFileModified).not.toHaveBeenCalled()
    expect(cb.onVaultChanged).toHaveBeenCalled()
  })

  it('calls onVaultChanged when Write has malformed JSON input', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', 'not-json', VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
    expect(cb.onVaultChanged).toHaveBeenCalled()
  })

  it('does not call onVaultChanged when Write detects specific file', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/test.md')
    expect(cb.onVaultChanged).not.toHaveBeenCalled()
  })

  it('does not call onVaultChanged for Read tool', () => {
    const cb = makeCallbacks()
    detectFileOperation('Read', undefined, VAULT, cb)
    expect(cb.onVaultChanged).not.toHaveBeenCalled()
  })

  it('calls onVaultChanged when Bash input is undefined', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', undefined, VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
    expect(cb.onVaultChanged).toHaveBeenCalled()
  })

  it('handles undefined callbacks gracefully', () => {
    expect(() => detectFileOperation('Write', JSON.stringify({ file_path: `${VAULT}/note/test.md` }), VAULT, undefined)).not.toThrow()
  })

  it('detects Bash redirect creating .md file in vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "# Note" > ${VAULT}/note/new.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/new.md')
  })

  it('detects Bash append redirect creating .md file', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `cat content.txt >> ${VAULT}/daily/2026-03-07.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('daily/2026-03-07.md')
  })

  it('detects Bash tee command creating .md file', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "content" | tee ${VAULT}/note/tee-note.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/tee-note.md')
  })

  it('ignores Bash commands without file creation', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: 'ls -la' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores Bash creating non-md files', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: `echo "data" > ${VAULT}/config.json` }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('ignores Bash creating .md files outside vault', () => {
    const cb = makeCallbacks()
    detectFileOperation('Bash', JSON.stringify({ command: 'echo "text" > /tmp/other.md' }), VAULT, cb)
    expect(cb.onFileCreated).not.toHaveBeenCalled()
  })

  it('uses path field when file_path is missing', () => {
    const cb = makeCallbacks()
    detectFileOperation('Write', JSON.stringify({ path: `${VAULT}/note/alt.md` }), VAULT, cb)
    expect(cb.onFileCreated).toHaveBeenCalledWith('note/alt.md')
  })
})

describe('parseBashFileCreation', () => {
  it('returns null for undefined input', () => {
    expect(parseBashFileCreation(undefined, VAULT)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseBashFileCreation('not json', VAULT)).toBeNull()
  })

  it('returns null when no command field', () => {
    expect(parseBashFileCreation(JSON.stringify({ other: 'value' }), VAULT)).toBeNull()
  })

  it('returns null when command is not a string', () => {
    expect(parseBashFileCreation(JSON.stringify({ command: 42 }), VAULT)).toBeNull()
  })

  it('parses simple redirect', () => {
    const input = JSON.stringify({ command: `echo "# Title" > ${VAULT}/note.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('note.md')
  })

  it('parses append redirect', () => {
    const input = JSON.stringify({ command: `echo "line" >> ${VAULT}/sub/note.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('sub/note.md')
  })

  it('parses tee command', () => {
    const input = JSON.stringify({ command: `echo "data" | tee ${VAULT}/new.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('new.md')
  })

  it('parses tee -a (append) command', () => {
    const input = JSON.stringify({ command: `echo "extra" | tee -a ${VAULT}/new.md` })
    expect(parseBashFileCreation(input, VAULT)).toBe('new.md')
  })

  it('returns null for non-md redirect', () => {
    const input = JSON.stringify({ command: `echo "x" > ${VAULT}/file.txt` })
    expect(parseBashFileCreation(input, VAULT)).toBeNull()
  })
})

describe('useAiAgent', () => {
  beforeEach(() => {
    mockStreamClaudeAgent.mockReset()
    mockStreamClaudeAgent.mockImplementation(async (_msg: string, _sys: string, _vault: string, callbacks: { onDone: () => void }) => {
      callbacks.onDone()
    })
  })

  it('updates sendMessage when contextPrompt changes (no stale closure)', () => {
    // Mount with empty contextPrompt (simulates race: panel mounts before tab content loads)
    const { result, rerender } = renderHook(
      ({ vault, context }) => useAiAgent(vault, context),
      { initialProps: { vault: VAULT, context: undefined as string | undefined } },
    )

    const firstSendMessage = result.current.sendMessage

    // Simulate tab content arriving — re-render with real contextPrompt
    rerender({ vault: VAULT, context: 'You are viewing note with body: Hello world' })

    // sendMessage must be a NEW function that closes over the updated contextPrompt.
    // If it's the same reference, it may read stale context (the race condition).
    expect(result.current.sendMessage).not.toBe(firstSendMessage)
  })

  it('uses the current contextPrompt at send time, not the mount-time value', async () => {
    const { result, rerender } = renderHook(
      ({ vault, context }) => useAiAgent(vault, context),
      { initialProps: { vault: VAULT, context: undefined as string | undefined } },
    )

    rerender({ vault: VAULT, context: 'You are viewing note with body: Hello world' })

    await act(async () => {
      await result.current.sendMessage('What does this note contain?')
    })

    expect(mockStreamClaudeAgent).toHaveBeenCalledTimes(1)
    expect(mockStreamClaudeAgent.mock.calls[0][1]).toBe('You are viewing note with body: Hello world')
  })

  it('falls back to buildAgentSystemPrompt when contextPrompt is undefined', async () => {
    const { result } = renderHook(() => useAiAgent(VAULT, undefined))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStreamClaudeAgent).toHaveBeenCalledTimes(1)
    expect(mockStreamClaudeAgent.mock.calls[0][1]).toBe('default-system-prompt')
  })

  it('sends first message without conversation history', async () => {
    const { result } = renderHook(() => useAiAgent(VAULT, undefined))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStreamClaudeAgent).toHaveBeenCalledTimes(1)
    const sentMessage = mockStreamClaudeAgent.mock.calls[0][0]
    expect(sentMessage).toBe('Hello')
    expect(sentMessage).not.toContain('<conversation_history>')
  })

  it('embeds conversation history in second message', async () => {
    // Mock that simulates a response for the first message
    mockStreamClaudeAgent.mockImplementation(async (_msg, _sys, _vault, callbacks) => {
      callbacks.onText('The answer is 4')
      callbacks.onDone()
    })

    const { result } = renderHook(() => useAiAgent(VAULT, undefined))

    // First message
    await act(async () => {
      await result.current.sendMessage('What is 2+2?')
    })

    // Second message — should include history from first exchange
    await act(async () => {
      await result.current.sendMessage('What was my previous question?')
    })

    expect(mockStreamClaudeAgent).toHaveBeenCalledTimes(2)

    // First call: no history
    expect(mockStreamClaudeAgent.mock.calls[0][0]).toBe('What is 2+2?')

    // Second call: includes history
    const secondMsg = mockStreamClaudeAgent.mock.calls[1][0]
    expect(secondMsg).toContain('<conversation_history>')
    expect(secondMsg).toContain('What is 2+2?')
    expect(secondMsg).toContain('The answer is 4')
    expect(secondMsg).toContain('What was my previous question?')
  })

  it('accumulates history across multiple exchanges', async () => {
    let callCount = 0
    mockStreamClaudeAgent.mockImplementation(async (_msg, _sys, _vault, callbacks) => {
      callCount++
      callbacks.onText(`Response ${callCount}`)
      callbacks.onDone()
    })

    const { result } = renderHook(() => useAiAgent(VAULT, undefined))

    await act(async () => { await result.current.sendMessage('Q1') })
    await act(async () => { await result.current.sendMessage('Q2') })
    await act(async () => { await result.current.sendMessage('Q3') })

    expect(mockStreamClaudeAgent).toHaveBeenCalledTimes(3)

    // First: no history
    expect(mockStreamClaudeAgent.mock.calls[0][0]).toBe('Q1')

    // Second: history from first exchange
    const msg2 = mockStreamClaudeAgent.mock.calls[1][0]
    expect(msg2).toContain('Q1')
    expect(msg2).toContain('Response 1')
    expect(msg2).toContain('Q2')

    // Third: history from both exchanges
    const msg3 = mockStreamClaudeAgent.mock.calls[2][0]
    expect(msg3).toContain('Q1')
    expect(msg3).toContain('Response 1')
    expect(msg3).toContain('Q2')
    expect(msg3).toContain('Response 2')
    expect(msg3).toContain('Q3')
  })

  it('resets history after clearConversation', async () => {
    mockStreamClaudeAgent.mockImplementation(async (_msg, _sys, _vault, callbacks) => {
      callbacks.onText('reply')
      callbacks.onDone()
    })

    const { result } = renderHook(() => useAiAgent(VAULT, undefined))

    await act(async () => { await result.current.sendMessage('hello') })

    act(() => { result.current.clearConversation() })

    await act(async () => { await result.current.sendMessage('fresh start') })

    const lastCall = mockStreamClaudeAgent.mock.calls[mockStreamClaudeAgent.mock.calls.length - 1]
    expect(lastCall[0]).toBe('fresh start')
    expect(lastCall[0]).not.toContain('<conversation_history>')
  })
})

describe('agentMessagesToChatHistory', () => {
  it('returns empty array for no messages', () => {
    expect(agentMessagesToChatHistory([])).toEqual([])
  })

  it('converts agent messages to user/assistant pairs', () => {
    const msgs: AiAgentMessage[] = [
      { userMessage: 'Q1', response: 'A1', actions: [], id: 'm1' },
      { userMessage: 'Q2', response: 'A2', actions: [], id: 'm2' },
    ]
    const result = agentMessagesToChatHistory(msgs)
    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ role: 'user', content: 'Q1' })
    expect(result[1]).toMatchObject({ role: 'assistant', content: 'A1' })
    expect(result[2]).toMatchObject({ role: 'user', content: 'Q2' })
    expect(result[3]).toMatchObject({ role: 'assistant', content: 'A2' })
  })

  it('skips assistant entry when response is undefined (still streaming)', () => {
    const msgs: AiAgentMessage[] = [
      { userMessage: 'Q1', actions: [], id: 'm1', isStreaming: true },
    ]
    const result = agentMessagesToChatHistory(msgs)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ role: 'user', content: 'Q1' })
  })
})
