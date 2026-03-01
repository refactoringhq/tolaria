import { describe, it, expect, vi } from 'vitest'

// Mock the mock-tauri module before importing ai-agent
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

import { buildAgentSystemPrompt, streamClaudeAgent } from './ai-agent'

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

// --- streamClaudeAgent ---

describe('streamClaudeAgent', () => {
  it('calls onText and onDone in non-Tauri environment', async () => {
    const onText = vi.fn()
    const onToolStart = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    await streamClaudeAgent('test message', 'system prompt', '/tmp/vault', {
      onText,
      onToolStart,
      onError,
      onDone,
    })

    // Wait for the setTimeout mock response
    await new Promise(r => setTimeout(r, 400))

    expect(onText).toHaveBeenCalledWith(expect.stringContaining('Claude CLI'))
    expect(onDone).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onToolStart).not.toHaveBeenCalled()
  })
})
