import { describe, it, expect, vi, beforeEach } from 'vitest'

// localStorage mock (jsdom doesn't provide a full implementation)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { buildAgentSystemPrompt, executeToolViaWs, runAgentLoop, type AgentStepCallback } from './ai-agent'

// --- buildAgentSystemPrompt ---

describe('buildAgentSystemPrompt', () => {
  it('returns preamble when no vault context', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('AI assistant integrated into Laputa')
    expect(prompt).not.toContain('Vault context')
  })

  it('appends vault context when provided', () => {
    const prompt = buildAgentSystemPrompt('Recent notes: foo, bar')
    expect(prompt).toContain('AI assistant integrated into Laputa')
    expect(prompt).toContain('Vault context:')
    expect(prompt).toContain('Recent notes: foo, bar')
  })
})

// --- runAgentLoop calls Anthropic API directly ---

describe('runAgentLoop', () => {
  const mockCallbacks: AgentStepCallback = {
    onThinking: vi.fn(),
    onToolStart: vi.fn(),
    onToolDone: vi.fn(),
    onText: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorageMock.clear()
    localStorageMock.setItem('laputa:anthropic-api-key', 'test-key-123')
  })

  it('calls https://api.anthropic.com/v1/messages directly', async () => {
    const mockResponse = {
      id: 'msg_123',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      stop_reason: 'end_turn',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await runAgentLoop('test message', 'claude-3-5-haiku-20241022', 'system prompt', mockCallbacks)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(options?.method).toBe('POST')

    const headers = options?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-key-123')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(options?.body as string)
    expect(body.model).toBe('claude-3-5-haiku-20241022')
    expect(body.max_tokens).toBe(4096)
    expect(body.system).toBe('system prompt')
    expect(body.messages).toEqual([{ role: 'user', content: 'test message' }])
    expect(body.tools).toBeDefined()
    // API key must NOT be in the body
    expect(body.apiKey).toBeUndefined()
  })

  it('calls onText and onDone for a text-only response', async () => {
    const mockResponse = {
      id: 'msg_123',
      role: 'assistant',
      content: [{ type: 'text', text: 'Here is your answer.' }],
      stop_reason: 'end_turn',
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await runAgentLoop('question', 'claude-3-5-haiku-20241022', 'sys', mockCallbacks)

    expect(mockCallbacks.onThinking).toHaveBeenCalled()
    expect(mockCallbacks.onText).toHaveBeenCalledWith('Here is your answer.')
    expect(mockCallbacks.onDone).toHaveBeenCalled()
    expect(mockCallbacks.onError).not.toHaveBeenCalled()
  })

  it('calls onError when API key is missing', async () => {
    localStorageMock.clear()

    await runAgentLoop('test', 'claude-3-5-haiku-20241022', 'sys', mockCallbacks)

    expect(mockCallbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining('No API key configured'),
    )
  })

  it('calls onError with API error message on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }),
    )

    await runAgentLoop('test', 'claude-3-5-haiku-20241022', 'sys', mockCallbacks)

    expect(mockCallbacks.onError).toHaveBeenCalledWith('Invalid API key')
  })

  it('does not send apiKey in the request body', async () => {
    const mockResponse = {
      id: 'msg_123',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    await runAgentLoop('test', 'claude-3-5-haiku-20241022', 'sys', mockCallbacks)

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body).not.toHaveProperty('apiKey')
    expect(body).not.toHaveProperty('maxTokens')
  })
})

// --- executeToolViaWs ---

describe('executeToolViaWs', () => {
  it('resolves with error when WebSocket is unavailable', async () => {
    // jsdom WebSocket will fail to connect
    const result = await executeToolViaWs('read_note', { path: 'test.md' })
    expect(result.isError).toBe(true)
  })
})
