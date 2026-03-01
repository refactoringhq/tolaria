import { describe, it, expect, vi } from 'vitest'

// Mock the mock-tauri module before importing ai-chat
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

import {
  estimateTokens, buildSystemPrompt,
  nextMessageId, checkClaudeCli, streamClaudeChat,
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
