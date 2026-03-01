/**
 * AI Chat utilities — Claude CLI integration, token estimation, context building.
 */

import type { VaultEntry } from '../types'
import { isTauri } from '../mock-tauri'

// --- Token estimation ---

/** Rough token estimate: ~4 chars per token for English text. */
export function estimateTokens(text: string | number): number {
  const len = typeof text === 'number' ? text : text.length
  return Math.ceil(len / 4)
}

const DEFAULT_CONTEXT_LIMIT = 180_000

export function getContextLimit(): number {
  return DEFAULT_CONTEXT_LIMIT
}

// --- Context building ---

/** Build system prompt from selected context notes. */
export function buildSystemPrompt(
  notes: VaultEntry[],
  allContent: Record<string, string>,
): { prompt: string; totalTokens: number; truncated: boolean } {
  if (notes.length === 0) {
    return { prompt: '', totalTokens: 0, truncated: false }
  }

  const contextBudget = Math.floor(getContextLimit() * 0.6)
  const preamble = [
    'You are a helpful AI assistant integrated into Laputa, a personal knowledge management app.',
    'The user has selected the following notes as context. Use them to answer questions accurately.',
    '',
  ].join('\n')

  const parts: string[] = [preamble]
  let totalChars = preamble.length
  let truncated = false

  for (const note of notes) {
    const content = allContent[note.path] ?? ''
    const header = `--- Note: ${note.title} (${note.isA ?? 'Note'}) ---`
    const noteText = `${header}\n${content}\n`

    if (estimateTokens(totalChars + noteText.length) > contextBudget) {
      const remaining = (contextBudget - estimateTokens(totalChars)) * 4
      if (remaining > 200) {
        parts.push(`${header}\n${content.slice(0, remaining)}\n[... truncated ...]`)
      }
      truncated = true
      break
    }

    parts.push(noteText)
    totalChars += noteText.length
  }

  const prompt = parts.join('\n')
  return { prompt, totalTokens: estimateTokens(prompt), truncated }
}

// --- Message types ---

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
}

let msgIdCounter = 0
export function nextMessageId(): string {
  return `msg-${++msgIdCounter}-${Date.now()}`
}

// --- Claude CLI status ---

export interface ClaudeCliStatus {
  installed: boolean
  version: string | null
}

export async function checkClaudeCli(): Promise<ClaudeCliStatus> {
  if (!isTauri()) {
    return { installed: false, version: null }
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ClaudeCliStatus>('check_claude_cli')
}

// --- Claude CLI streaming ---

type ClaudeStreamEvent =
  | { kind: 'Init'; session_id: string }
  | { kind: 'TextDelta'; text: string }
  | { kind: 'ToolStart'; tool_name: string; tool_id: string }
  | { kind: 'ToolDone'; tool_id: string }
  | { kind: 'Result'; text: string; session_id: string }
  | { kind: 'Error'; message: string }
  | { kind: 'Done' }

export interface ChatStreamCallbacks {
  onInit?: (sessionId: string) => void
  onText: (text: string) => void
  onError: (message: string) => void
  onDone: () => void
}

/** Handle a single stream event from the Claude CLI, updating session state. */
function handleChatStreamEvent(
  data: ClaudeStreamEvent,
  state: { sessionId: string },
  callbacks: ChatStreamCallbacks,
): void {
  switch (data.kind) {
    case 'Init':
      state.sessionId = data.session_id
      callbacks.onInit?.(data.session_id)
      break
    case 'TextDelta':
      callbacks.onText(data.text)
      break
    case 'Result':
      if (data.session_id) state.sessionId = data.session_id
      break
    case 'Error':
      callbacks.onError(data.message)
      break
    case 'Done':
      callbacks.onDone()
      break
  }
}

/**
 * Stream a chat message through the Claude CLI subprocess.
 * Returns the session ID for conversation continuity via --resume.
 */
export async function streamClaudeChat(
  message: string,
  systemPrompt: string | undefined,
  sessionId: string | undefined,
  callbacks: ChatStreamCallbacks,
): Promise<string> {
  if (!isTauri()) {
    setTimeout(() => {
      callbacks.onText('AI Chat requires the Claude CLI. Install it and run the native app.')
      callbacks.onDone()
    }, 300)
    return 'mock-session'
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const state = { sessionId: sessionId ?? '' }

  const unlisten = await listen<ClaudeStreamEvent>('claude-stream', (event) => {
    handleChatStreamEvent(event.payload, state, callbacks)
  })

  try {
    const result = await invoke<string>('stream_claude_chat', {
      request: {
        message,
        system_prompt: systemPrompt || null,
        session_id: sessionId || null,
      },
    })
    if (result) state.sessionId = result
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err))
    callbacks.onDone()
  } finally {
    unlisten()
  }

  return state.sessionId
}
