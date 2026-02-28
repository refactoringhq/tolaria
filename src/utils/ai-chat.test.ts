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

import {
  getApiKey, setApiKey, estimateTokens, buildSystemPrompt,
  nextMessageId, streamChat,
} from './ai-chat'
import type { VaultEntry } from '../types'

// --- getApiKey / setApiKey ---

describe('getApiKey / setApiKey', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns empty string when no key set', () => {
    expect(getApiKey()).toBe('')
  })

  it('round-trips an API key', () => {
    setApiKey('sk-test-abc')
    expect(getApiKey()).toBe('sk-test-abc')
  })
})

// --- estimateTokens ---

describe('estimateTokens', () => {
  it('estimates tokens from string length', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('accepts a number (char count)', () => {
    expect(estimateTokens(100)).toBe(25)
  })
})

// --- buildSystemPrompt ---

describe('buildSystemPrompt', () => {
  const makeEntry = (path: string, title: string): VaultEntry => ({
    path, title, filename: `${title}.md`, isA: 'Note',
    aliases: [], belongsTo: [], relatedTo: [],
    status: null, owner: null, cadence: null,
    modifiedAt: null, createdAt: null, fileSize: 100,
    snippet: '', relationships: {},
  })

  it('returns empty prompt for no notes', () => {
    const result = buildSystemPrompt([], {})
    expect(result.prompt).toBe('')
    expect(result.totalTokens).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('includes note content in the prompt', () => {
    const notes = [makeEntry('/test.md', 'Test Note')]
    const content = { '/test.md': '# Test Note\nHello world' }
    const result = buildSystemPrompt(notes, content)
    expect(result.prompt).toContain('Test Note')
    expect(result.prompt).toContain('Hello world')
    expect(result.totalTokens).toBeGreaterThan(0)
  })
})

// --- nextMessageId ---

describe('nextMessageId', () => {
  it('returns unique IDs', () => {
    const id1 = nextMessageId()
    const id2 = nextMessageId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^msg-/)
  })
})

// --- streamChat calls Anthropic API directly ---

describe('streamChat', () => {
  const onChunk = vi.fn()
  const onDone = vi.fn()
  const onError = vi.fn()

  beforeEach(() => {
    vi.restoreAllMocks()
    onChunk.mockClear()
    onDone.mockClear()
    onError.mockClear()
    localStorageMock.clear()
    localStorageMock.setItem('laputa:anthropic-api-key', 'test-key-456')
  })

  it('calls https://api.anthropic.com/v1/messages with correct headers', async () => {
    const sseData = [
      'data: {"type":"content_block_delta","delta":{"text":"Hi"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ].join('')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(sseData, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    await streamChat(
      [{ role: 'user', content: 'hello' }], 'system', 'claude-3-5-haiku-20241022',
      onChunk, onDone, onError,
    )

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')

    const headers = options?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-key-456')
    expect(headers['anthropic-version']).toBe('2023-06-01')

    const body = JSON.parse(options?.body as string)
    expect(body.stream).toBe(true)
    expect(body.model).toBe('claude-3-5-haiku-20241022')
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
    // API key must NOT be in the body
    expect(body.apiKey).toBeUndefined()
  })

  it('calls onError when API key is missing', async () => {
    localStorageMock.clear()

    await streamChat([], '', 'model', onChunk, onDone, onError)

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('No API key configured'),
    )
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('calls onError with parsed error on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid x-api-key' } }), { status: 401 }),
    )

    await streamChat(
      [{ role: 'user', content: 'hi' }], '', 'model',
      onChunk, onDone, onError,
    )

    expect(onError).toHaveBeenCalledWith('Invalid x-api-key')
  })

  it('does not send apiKey in the request body', async () => {
    const sseData = 'data: {"type":"message_stop"}\n\n'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(sseData, { status: 200 }),
    )

    await streamChat(
      [{ role: 'user', content: 'hi' }], '', 'model',
      onChunk, onDone, onError,
    )

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body).not.toHaveProperty('apiKey')
    expect(body).not.toHaveProperty('maxTokens')
    expect(body.max_tokens).toBe(4096)
  })
})
