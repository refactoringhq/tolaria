/**
 * AI Chat utilities — Anthropic API client, token estimation, context building.
 */

import type { VaultEntry } from '../types'

// --- localStorage key for API key ---
const API_KEY_STORAGE_KEY = 'laputa:anthropic-api-key'

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key)
}

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

// --- API types ---

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
}

let msgIdCounter = 0
export function nextMessageId(): string {
  return `msg-${++msgIdCounter}-${Date.now()}`
}

// --- SSE parsing ---

function parseSseEvent(line: string, onChunk: (text: string) => void): boolean {
  if (!line.startsWith('data: ')) return false
  const data = line.slice(6)
  if (data === '[DONE]') return true

  try {
    const event = JSON.parse(data)
    if (event.type === 'content_block_delta' && event.delta?.text) {
      onChunk(event.delta.text)
    }
    if (event.type === 'message_stop') return true
  } catch {
    // skip malformed events
  }
  return false
}

async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (parseSseEvent(line, onChunk)) return
    }
  }
}

async function parseApiError(response: Response): Promise<string> {
  const errText = await response.text()
  try {
    const errJson = JSON.parse(errText)
    return errJson.error?.message || errJson.error || `API error (${response.status})`
  } catch {
    return `API error (${response.status})`
  }
}

// --- Streaming API call ---

export async function streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  model: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const apiKey = getApiKey()
  if (!apiKey) {
    onError('No API key configured. Click the key icon to set your Anthropic API key.')
    return
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      onError(await parseApiError(response))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError('No response body')
      return
    }

    await readSseStream(reader, onChunk)
    onDone()
  } catch (err: unknown) {
    onError(err instanceof Error ? err.message : 'Network error')
  }
}

// --- Model options ---
export const MODEL_OPTIONS = [
  { value: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Opus 4' },
] as const
