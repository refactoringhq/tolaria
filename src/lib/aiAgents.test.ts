import { describe, expect, it } from 'vitest'
import {
  getNextAiAgentId,
  normalizeAiAgentsStatus,
  normalizeStoredAiAgent,
  resolveDefaultAiAgent,
} from './aiAgents'

describe('aiAgents helpers', () => {
  it('normalizes stored agent ids', () => {
    expect(normalizeStoredAiAgent('claude_code')).toBe('claude_code')
    expect(normalizeStoredAiAgent('codex')).toBe('codex')
    expect(normalizeStoredAiAgent('kiro')).toBe('kiro')
    expect(normalizeStoredAiAgent('cursor')).toBeNull()
  })

  it('falls back to Claude Code as the default agent', () => {
    expect(resolveDefaultAiAgent(undefined)).toBe('claude_code')
    expect(resolveDefaultAiAgent(null)).toBe('claude_code')
  })

  it('normalizes raw status payloads', () => {
    const statuses = normalizeAiAgentsStatus({
      claude_code: { installed: true, version: '1.0.20' },
      codex: { installed: false, version: null },
      kiro: { installed: true, version: '2.0.0' },
    })

    expect(statuses.claude_code).toEqual({ status: 'installed', version: '1.0.20' })
    expect(statuses.codex).toEqual({ status: 'missing', version: null })
    expect(statuses.kiro).toEqual({ status: 'installed', version: '2.0.0' })
  })

  it('cycles between the supported agents', () => {
    expect(getNextAiAgentId('claude_code')).toBe('codex')
    expect(getNextAiAgentId('codex')).toBe('kiro')
    expect(getNextAiAgentId('kiro')).toBe('claude_code')
  })
})
