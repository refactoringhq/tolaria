import { describe, it, expect, vi } from 'vitest'

// Mock the mock-tauri module before importing ai-chat
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

import {
  estimateTokens, buildSystemPrompt,
  nextMessageId, checkClaudeCli, streamClaudeChat,
  trimHistory, formatMessageWithHistory,
  type ChatMessage, MAX_HISTORY_TOKENS,
} from './ai-chat'
import type { VaultEntry } from '../types'

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

  it('instructs AI to use wikilink syntax', () => {
    const notes = [makeEntry('/test.md', 'Test Note')]
    const content = { '/test.md': 'content' }
    const result = buildSystemPrompt(notes, content)
    expect(result.prompt).toContain('[[')
    expect(result.prompt).toMatch(/wikilink/i)
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

// --- checkClaudeCli ---

describe('checkClaudeCli', () => {
  it('returns not installed in non-Tauri environment', async () => {
    const status = await checkClaudeCli()
    expect(status.installed).toBe(false)
    expect(status.version).toBeNull()
  })
})

// --- trimHistory ---

describe('trimHistory', () => {
  const msg = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    role, content, id: `msg-${content}`,
  })

  it('returns empty array for empty history', () => {
    expect(trimHistory([], 1000)).toEqual([])
  })

  it('returns all messages when under token limit', () => {
    const history = [msg('user', 'hi'), msg('assistant', 'hello')]
    expect(trimHistory(history, 1000)).toEqual(history)
  })

  it('drops oldest messages when over token limit', () => {
    const history = [
      msg('user', 'a'.repeat(400)),      // 100 tokens
      msg('assistant', 'b'.repeat(400)),  // 100 tokens
      msg('user', 'c'.repeat(400)),       // 100 tokens
    ]
    const result = trimHistory(history, 200)
    // Should keep the two most recent messages (200 tokens)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('b'.repeat(400))
    expect(result[1].content).toBe('c'.repeat(400))
  })

  it('keeps at least one message if it fits', () => {
    const history = [
      msg('user', 'a'.repeat(2000)),  // 500 tokens
      msg('assistant', 'b'.repeat(80)), // 20 tokens
    ]
    const result = trimHistory(history, 30)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('b'.repeat(80))
  })

  it('returns empty when single message exceeds limit', () => {
    const history = [msg('user', 'a'.repeat(4000))] // 1000 tokens
    expect(trimHistory(history, 10)).toEqual([])
  })
})

// --- formatMessageWithHistory ---

describe('formatMessageWithHistory', () => {
  const msg = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    role, content, id: `msg-${content}`,
  })

  it('returns bare message when no history', () => {
    expect(formatMessageWithHistory([], 'hello')).toBe('hello')
  })

  it('includes conversation history before the new message', () => {
    const history = [msg('user', 'What is Rust?'), msg('assistant', 'A systems language.')]
    const result = formatMessageWithHistory(history, 'How does it compare to Go?')
    expect(result).toContain('What is Rust?')
    expect(result).toContain('A systems language.')
    expect(result).toContain('How does it compare to Go?')
  })

  it('labels user and assistant messages correctly', () => {
    const history = [msg('user', 'Q1'), msg('assistant', 'A1')]
    const result = formatMessageWithHistory(history, 'Q2')
    expect(result).toContain('[user]: Q1')
    expect(result).toContain('[assistant]: A1')
    expect(result).toContain('[user]: Q2')
  })

  it('preserves message order', () => {
    const history = [
      msg('user', 'first'),
      msg('assistant', 'second'),
      msg('user', 'third'),
      msg('assistant', 'fourth'),
    ]
    const result = formatMessageWithHistory(history, 'fifth')
    const firstIdx = result.indexOf('first')
    const secondIdx = result.indexOf('second')
    const thirdIdx = result.indexOf('third')
    const fourthIdx = result.indexOf('fourth')
    const fifthIdx = result.indexOf('fifth')
    expect(firstIdx).toBeLessThan(secondIdx)
    expect(secondIdx).toBeLessThan(thirdIdx)
    expect(thirdIdx).toBeLessThan(fourthIdx)
    expect(fourthIdx).toBeLessThan(fifthIdx)
  })
})

// --- MAX_HISTORY_TOKENS ---

describe('MAX_HISTORY_TOKENS', () => {
  it('is a reasonable token limit', () => {
    expect(MAX_HISTORY_TOKENS).toBeGreaterThan(10_000)
    expect(MAX_HISTORY_TOKENS).toBeLessThan(200_000)
  })
})

// --- streamClaudeChat ---

describe('streamClaudeChat', () => {
  it('returns mock session in non-Tauri environment', async () => {
    const onText = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    const sessionId = await streamClaudeChat('hello', undefined, undefined, {
      onText,
      onError,
      onDone,
    })

    // Wait for the setTimeout mock response
    await new Promise(r => setTimeout(r, 400))

    expect(sessionId).toBe('mock-session')
    expect(onText).toHaveBeenCalledWith(expect.stringContaining('Claude CLI'))
    expect(onDone).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
