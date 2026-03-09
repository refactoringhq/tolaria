/**
 * Hook for the AI agent panel — manages agent state and streaming.
 * Uses Claude CLI subprocess with full tool access + MCP tools via Tauri.
 *
 * States: idle -> thinking -> tool-executing -> done/error
 *
 * Reasoning streams live while Claude thinks, then auto-collapses.
 * Response text accumulates internally and is revealed as a complete block on done.
 *
 * Detects file operations (Write/Edit/Bash) and notifies the parent via callbacks
 * so the Laputa UI can auto-open new notes and live-refresh modified notes.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { AiAction } from '../components/AiMessage'
import type { NoteReference } from '../utils/ai-context'
import { streamClaudeAgent, buildAgentSystemPrompt } from '../utils/ai-agent'
import {
  nextMessageId, trimHistory, formatMessageWithHistory,
  type ChatMessage, MAX_HISTORY_TOKENS,
} from '../utils/ai-chat'

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AiAgentMessage {
  userMessage: string
  references?: NoteReference[]
  reasoning?: string
  reasoningDone?: boolean
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  id?: string
}

export interface AgentFileCallbacks {
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  /** Fallback: vault may have changed but we can't determine the specific file. */
  onVaultChanged?: () => void
}

/** Convert completed agent messages to ChatMessage pairs for history embedding. */
export function agentMessagesToChatHistory(msgs: AiAgentMessage[]): ChatMessage[] {
  const history: ChatMessage[] = []
  for (const msg of msgs) {
    history.push({ role: 'user', content: msg.userMessage, id: msg.id ?? '' })
    if (msg.response) {
      history.push({ role: 'assistant', content: msg.response, id: `${msg.id}-resp` })
    }
  }
  return history
}

export function useAiAgent(
  vaultPath: string,
  contextPrompt?: string,
  fileCallbacks?: AgentFileCallbacks,
) {
  const [messages, setMessages] = useState<AiAgentMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const abortRef = useRef({ aborted: false })
  const responseAccRef = useRef('')
  const fileCallbacksRef = useRef(fileCallbacks)
  // Track tool inputs for file-operation detection on ToolDone
  const toolInputMapRef = useRef<Map<string, { tool: string; input?: string }>>(new Map())
  // Refs for latest state — avoids stale closures in callbacks.
  // Synced via useEffect (runs after render, before next user interaction).
  const messagesRef = useRef<AiAgentMessage[]>([])
  const statusRef = useRef<AgentStatus>('idle')
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    fileCallbacksRef.current = fileCallbacks
  }, [fileCallbacks])

  const sendMessage = useCallback(async (text: string, references?: NoteReference[]) => {
    const currentStatus = statusRef.current
    if (!text.trim() || currentStatus === 'thinking' || currentStatus === 'tool-executing') return

    const refs = references && references.length > 0 ? references : undefined

    if (!vaultPath) {
      setMessages(prev => [...prev, {
        userMessage: text.trim(), references: refs, actions: [],
        response: 'No vault loaded. Open a vault first.',
        id: nextMessageId(),
      }])
      return
    }

    abortRef.current = { aborted: false }
    responseAccRef.current = ''
    toolInputMapRef.current = new Map()

    const messageId = nextMessageId()
    setMessages(prev => [...prev, {
      userMessage: text.trim(), references: refs, actions: [], isStreaming: true, id: messageId,
    }])
    setStatus('thinking')

    const update = (fn: (m: AiAgentMessage) => AiAgentMessage) => {
      setMessages(prev => prev.map(m => m.id === messageId ? fn(m) : m))
    }

    const markReasoningDone = () => {
      update(m => m.reasoningDone ? m : { ...m, reasoningDone: true })
    }

    const systemPrompt = contextPrompt ?? buildAgentSystemPrompt()

    // Embed conversation history from previous exchanges.
    // Uses messagesRef (not closure-captured messages) to avoid stale closures.
    const chatHistory = agentMessagesToChatHistory(messagesRef.current.filter(m => !m.isStreaming))
    const trimmedHistory = trimHistory(chatHistory, MAX_HISTORY_TOKENS)
    const formattedMessage = formatMessageWithHistory(trimmedHistory, text.trim())

    await streamClaudeAgent(formattedMessage, systemPrompt, vaultPath, {
      onThinking: (chunk) => {
        if (abortRef.current.aborted) return
        update(m => ({ ...m, reasoning: (m.reasoning ?? '') + chunk }))
      },

      onText: (chunk) => {
        if (abortRef.current.aborted) return
        markReasoningDone()
        responseAccRef.current += chunk
      },

      onToolStart: (toolName, toolId, input) => {
        if (abortRef.current.aborted) return
        markReasoningDone()
        setStatus('tool-executing')
        // Preserve accumulated input — tool_progress events arrive with
        // input=undefined AFTER the assistant message set the full input.
        const prev = toolInputMapRef.current.get(toolId)
        toolInputMapRef.current.set(toolId, { tool: toolName, input: input ?? prev?.input })
        update(m => {
          const existing = m.actions.find(a => a.toolId === toolId)
          if (existing) {
            return {
              ...m,
              actions: m.actions.map(a =>
                a.toolId === toolId ? { ...a, input: input ?? a.input } : a,
              ),
            }
          }
          return {
            ...m,
            actions: [...m.actions, {
              tool: toolName,
              toolId,
              label: formatToolLabel(toolName, input),
              status: 'pending' as const,
              input,
            }],
          }
        })
      },

      onToolDone: (toolId, output) => {
        if (abortRef.current.aborted) return
        const info = toolInputMapRef.current.get(toolId)
        if (info) {
          detectFileOperation(info.tool, info.input, vaultPath, fileCallbacksRef.current)
        }
        update(m => ({
          ...m,
          actions: m.actions.map(a =>
            a.toolId === toolId ? { ...a, status: 'done' as const, output } : a,
          ),
        }))
      },

      onError: (error) => {
        if (abortRef.current.aborted) return
        setStatus('error')
        const partial = responseAccRef.current
        update(m => ({
          ...m,
          isStreaming: false,
          reasoningDone: true,
          response: partial ? `${partial}\n\nError: ${error}` : `Error: ${error}`,
          actions: m.actions.map(a =>
            a.status === 'pending' ? { ...a, status: 'error' as const } : a,
          ),
        }))
      },

      onDone: () => {
        if (abortRef.current.aborted) return
        setStatus('done')
        const finalResponse = responseAccRef.current || undefined
        update(m => ({
          ...m,
          isStreaming: false,
          reasoningDone: true,
          response: finalResponse,
          actions: m.actions.map(a => a.status === 'pending' ? { ...a, status: 'done' as const } : a),
        }))
        // Safety net: refresh vault after agent completes in case file changes were missed
        fileCallbacksRef.current?.onVaultChanged?.()
      },
    })
  }, [vaultPath, contextPrompt])

  const clearConversation = useCallback(() => {
    abortRef.current.aborted = true
    responseAccRef.current = ''
    toolInputMapRef.current = new Map()
    setMessages([])
    setStatus('idle')
  }, [])

  return { messages, status, sendMessage, clearConversation }
}

// --- Helpers ---

/** Parse the file_path from a Write or Edit tool input JSON string. */
function parseFilePath(input: string | undefined): string | null {
  if (!input) return null
  try {
    const parsed = JSON.parse(input)
    return parsed.file_path ?? parsed.path ?? null
  } catch {
    return null
  }
}

/** Convert absolute path to vault-relative path, or null if outside vault. */
function toVaultRelative(filePath: string, vaultPath: string): string | null {
  if (!filePath.startsWith(vaultPath)) return null
  const rel = filePath.slice(vaultPath.length).replace(/^\//, '')
  return rel || null
}

/** Detect file operations from completed tool calls and notify callbacks. */
export function detectFileOperation(
  toolName: string,
  input: string | undefined,
  vaultPath: string,
  callbacks: AgentFileCallbacks | undefined,
) {
  if (!callbacks) return

  // Handle Bash commands that create/write .md files
  if (toolName === 'Bash') {
    const mdPath = parseBashFileCreation(input, vaultPath)
    if (mdPath) { callbacks.onFileCreated?.(mdPath); return }
    // Bash ran but we couldn't detect a specific .md file — still may have changed vault
    callbacks.onVaultChanged?.()
    return
  }

  if (toolName !== 'Write' && toolName !== 'Edit') return

  const filePath = parseFilePath(input)
  if (filePath && filePath.endsWith('.md')) {
    const rel = toVaultRelative(filePath, vaultPath)
    if (rel) {
      if (toolName === 'Write') callbacks.onFileCreated?.(rel)
      else callbacks.onFileModified?.(rel)
      return
    }
  }

  // Write/Edit completed but couldn't determine target file — trigger vault refresh
  callbacks.onVaultChanged?.()
}

/** Detect .md file creation from a Bash command string. */
export function parseBashFileCreation(input: string | undefined, vaultPath: string): string | null {
  if (!input) return null
  try {
    const parsed = JSON.parse(input)
    const cmd = parsed.command ?? parsed.cmd
    if (typeof cmd !== 'string') return null
    // Match redirect patterns: > file.md, >> file.md, tee file.md, cat > file.md
    const match = cmd.match(/(?:>|>>|tee\s+(?:-a\s+)?)\s*["']?([^\s"'|;]+\.md)["']?/)
    if (!match) return null
    const filePath = match[1]
    return toVaultRelative(filePath, vaultPath)
  } catch {
    return null
  }
}

/** Generate a human-readable label for a tool call. */
function formatToolLabel(toolName: string, input?: string): string {
  // Native Claude Code tools
  switch (toolName) {
    case 'Bash': {
      const cmd = extractBashCommand(input)
      return cmd ? `$ ${cmd}` : 'Running command...'
    }
    case 'Write': {
      const fp = parseFilePath(input)
      return fp ? `Writing ${basename(fp)}` : 'Writing file...'
    }
    case 'Edit': {
      const fp = parseFilePath(input)
      return fp ? `Editing ${basename(fp)}` : 'Editing file...'
    }
    case 'Read': {
      const fp = parseFilePath(input)
      return fp ? `Reading ${basename(fp)}` : 'Reading file...'
    }
    case 'Glob':
      return 'Searching files...'
    case 'Grep':
      return 'Searching content...'
    case 'TodoWrite':
      return 'Updating plan...'
    default:
      break
  }

  // Laputa MCP tools
  const mcpLabels: Record<string, string> = {
    search_notes: 'Searching notes',
    get_vault_context: 'Loading vault context',
    get_note: 'Reading note',
    open_note: 'Opening note',
  }
  if (mcpLabels[toolName]) {
    const notePath = parseNotePath(input)
    return notePath ? `${mcpLabels[toolName]}: ${basename(notePath)}` : `${mcpLabels[toolName]}...`
  }

  return `${toolName}...`
}

function extractBashCommand(input: string | undefined): string | null {
  if (!input) return null
  try {
    const parsed = JSON.parse(input)
    const cmd = parsed.command ?? parsed.cmd ?? null
    if (typeof cmd !== 'string') return null
    // Truncate long commands
    return cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd
  } catch {
    return null
  }
}

function parseNotePath(input: string | undefined): string | null {
  if (!input) return null
  try {
    const parsed = JSON.parse(input)
    return parsed.path ?? parsed.query ?? null
  } catch {
    return null
  }
}

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}
