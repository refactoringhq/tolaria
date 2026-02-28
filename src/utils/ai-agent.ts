/**
 * AI Agent utilities — Anthropic tool-use loop, tool definitions, WS bridge execution.
 *
 * The agent loop: call Claude with tools → if tool_use, execute via WS → feed result → repeat.
 */

import { getApiKey } from './ai-chat'

// --- Tool definitions (mirrors mcp-server/index.js TOOLS) ---

export const AGENT_TOOLS = [
  {
    name: 'read_note',
    description: 'Read the full content of a note',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path to the note' } },
      required: ['path'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in the vault with a title and optional frontmatter',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path for the new note' },
        title: { type: 'string', description: 'Title of the note' },
        is_a: { type: 'string', description: 'Entity type (Project, Note, etc.)' },
      },
      required: ['path', 'title'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search notes in the vault by title or content',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Append text to the end of an existing note',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
        text: { type: 'string', description: 'Text to append' },
      },
      required: ['path', 'text'],
    },
  },
  {
    name: 'edit_note_frontmatter',
    description: "Merge a patch object into a note's YAML frontmatter",
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
        patch: { type: 'object', description: 'Key-value pairs to merge into frontmatter' },
      },
      required: ['path', 'patch'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note file from the vault',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path to delete' } },
      required: ['path'],
    },
  },
  {
    name: 'link_notes',
    description: "Add a title to an array property in a note's frontmatter",
    input_schema: {
      type: 'object' as const,
      properties: {
        source_path: { type: 'string', description: 'Relative path to the source note' },
        property: { type: 'string', description: 'Frontmatter property name' },
        target_title: { type: 'string', description: 'Title to add to the array' },
      },
      required: ['source_path', 'property', 'target_title'],
    },
  },
  {
    name: 'list_notes',
    description: 'List all notes, optionally filtered by type',
    input_schema: {
      type: 'object' as const,
      properties: {
        type_filter: { type: 'string', description: 'Filter by type' },
        sort: { type: 'string', enum: ['title', 'mtime'], description: 'Sort order' },
      },
    },
  },
  {
    name: 'vault_context',
    description: 'Get vault context: entity types and 20 recent notes',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'ui_open_note',
    description: 'Open a note in the Laputa UI editor',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path to the note' } },
      required: ['path'],
    },
  },
  {
    name: 'ui_open_tab',
    description: 'Open a note in a new tab',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path to the note' } },
      required: ['path'],
    },
  },
  {
    name: 'ui_highlight',
    description: 'Highlight a UI element in the Laputa interface',
    input_schema: {
      type: 'object' as const,
      properties: {
        element: { type: 'string', enum: ['editor', 'tab', 'properties', 'notelist'] },
        path: { type: 'string', description: 'Relative path (optional)' },
      },
      required: ['element'],
    },
  },
  {
    name: 'ui_set_filter',
    description: 'Set the sidebar filter to show notes of a specific type',
    input_schema: {
      type: 'object' as const,
      properties: { type: { type: 'string', description: 'Type to filter by' } },
      required: ['type'],
    },
  },
] as const

// --- Types ---

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface TextBlock {
  type: 'text'
  text: string
}

type ContentBlock = TextBlock | ToolUseBlock

interface AnthropicMessage {
  id: string
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
}

export interface ToolResult {
  toolUseId: string
  toolName: string
  result: unknown
  isError: boolean
}

export interface AgentStepCallback {
  onThinking: () => void
  onToolStart: (toolName: string, toolId: string, args: Record<string, unknown>) => void
  onToolDone: (toolId: string, result: unknown, isError: boolean) => void
  onText: (text: string) => void
  onError: (error: string) => void
  onDone: () => void
}

// --- WebSocket tool execution ---

const WS_TOOL_URL = 'ws://localhost:9710'
const TOOL_TIMEOUT_MS = 30_000

export async function executeToolViaWs(
  toolName: string, args: Record<string, unknown>,
): Promise<{ result: unknown; isError: boolean }> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null
    let resolved = false

    const cleanup = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close()
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ result: { error: 'Tool execution timed out' }, isError: true })
      }
    }, TOOL_TIMEOUT_MS)

    try {
      ws = new WebSocket(WS_TOOL_URL)
      const reqId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      ws.onopen = () => {
        ws!.send(JSON.stringify({ id: reqId, tool: toolName, args }))
      }

      ws.onmessage = (event) => {
        if (resolved) return
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.id === reqId) {
            resolved = true
            clearTimeout(timeout)
            cleanup()
            if (msg.error) {
              resolve({ result: { error: msg.error }, isError: true })
            } else {
              resolve({ result: msg.result, isError: false })
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve({ result: { error: 'WebSocket bridge not available. Start Laputa to use AI tools.' }, isError: true })
        }
      }
    } catch {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve({ result: { error: 'Failed to connect to WebSocket bridge' }, isError: true })
      }
    }
  })
}

// --- Agent loop ---

const MAX_TOOL_LOOPS = 10
const AGENT_SYSTEM_PREAMBLE = `You are an AI assistant integrated into Laputa, a personal knowledge management app.
You can perform actions on the user's vault using the provided tools.
Be concise and helpful. When creating notes, use appropriate entity types and folder conventions.
When you've completed a task, briefly summarize what you did.`

export function buildAgentSystemPrompt(vaultContext?: string): string {
  if (!vaultContext) return AGENT_SYSTEM_PREAMBLE
  return `${AGENT_SYSTEM_PREAMBLE}\n\nVault context:\n${vaultContext}`
}

async function callAnthropicAgent(
  messages: unknown[], system: string, model: string, tools: unknown[],
): Promise<AnthropicMessage> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('No API key configured. Open Settings (⌘,) to add your Anthropic key.')

  const response = await fetch('/api/ai/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model, messages, system, maxTokens: 4096, tools }),
  })

  if (!response.ok) {
    const errText = await response.text()
    let errMsg: string
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson.error?.message || errJson.error || `API error (${response.status})`
    } catch {
      errMsg = `API error (${response.status})`
    }
    throw new Error(errMsg)
  }

  return response.json() as Promise<AnthropicMessage>
}

export async function runAgentLoop(
  userMessage: string,
  model: string,
  systemPrompt: string,
  callbacks: AgentStepCallback,
  abortSignal?: { aborted: boolean },
): Promise<void> {
  const messages: unknown[] = [{ role: 'user', content: userMessage }]

  callbacks.onThinking()

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    if (abortSignal?.aborted) return

    let response: AnthropicMessage
    try {
      response = await callAnthropicAgent(messages, systemPrompt, model, AGENT_TOOLS as unknown as unknown[])
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : 'Unknown error')
      return
    }

    if (abortSignal?.aborted) return

    // Process content blocks
    const textParts: string[] = []
    const toolUseBlocks: ToolUseBlock[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block)
      }
    }

    // If no tool_use, we're done
    if (toolUseBlocks.length === 0) {
      const fullText = textParts.join('\n')
      callbacks.onText(fullText)
      callbacks.onDone()
      return
    }

    // Execute each tool call
    messages.push({ role: 'assistant', content: response.content })
    const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = []

    for (const toolBlock of toolUseBlocks) {
      if (abortSignal?.aborted) return

      callbacks.onToolStart(toolBlock.name, toolBlock.id, toolBlock.input)

      const { result, isError } = await executeToolViaWs(toolBlock.name, toolBlock.input)

      callbacks.onToolDone(toolBlock.id, result, isError)

      const resultText = typeof result === 'string' ? result : JSON.stringify(result)
      toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: resultText })
    }

    // Feed tool results back to Claude
    messages.push({ role: 'user', content: toolResults })

    // Any text from the same response gets noted but loop continues
    if (textParts.length > 0) {
      callbacks.onText(textParts.join('\n'))
    }
  }

  // Max loops reached
  callbacks.onText('Reached maximum tool execution steps.')
  callbacks.onDone()
}

// --- Model options for agent ---
export const AGENT_MODEL_OPTIONS = [
  { value: 'claude-3-5-haiku-20241022', label: 'Haiku (fast)' },
  { value: 'claude-sonnet-4-20250514', label: 'Sonnet (smart)' },
] as const

const AGENT_MODEL_KEY = 'laputa:ai-agent-model'

export function getAgentModel(): string {
  return localStorage.getItem(AGENT_MODEL_KEY) ?? AGENT_MODEL_OPTIONS[0].value
}

export function setAgentModel(model: string): void {
  localStorage.setItem(AGENT_MODEL_KEY, model)
}
