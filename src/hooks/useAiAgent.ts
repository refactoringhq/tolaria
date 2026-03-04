/**
 * Hook for the AI agent panel — manages agent state and streaming.
 * Uses Claude CLI subprocess with MCP tools via Tauri.
 *
 * States: idle -> thinking -> tool-executing -> done/error
 *
 * Reasoning streams live while Claude thinks, then auto-collapses.
 * Response text accumulates internally and is revealed as a complete block on done.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { AiAction } from '../components/AiMessage'
import { streamClaudeAgent, buildAgentSystemPrompt } from '../utils/ai-agent'
import { nextMessageId } from '../utils/ai-chat'

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AiAgentMessage {
  userMessage: string
  reasoning?: string
  reasoningDone?: boolean
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  id?: string
}

export function useAiAgent(vaultPath: string, contextPrompt?: string) {
  const [messages, setMessages] = useState<AiAgentMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const abortRef = useRef({ aborted: false })
  const contextRef = useRef(contextPrompt)
  const responseAccRef = useRef('')
  useEffect(() => {
    contextRef.current = contextPrompt
  }, [contextPrompt])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || status === 'thinking' || status === 'tool-executing') return

    if (!vaultPath) {
      setMessages(prev => [...prev, {
        userMessage: text.trim(), actions: [],
        response: 'No vault loaded. Open a vault first.',
        id: nextMessageId(),
      }])
      return
    }

    abortRef.current = { aborted: false }
    responseAccRef.current = ''

    const messageId = nextMessageId()
    setMessages(prev => [...prev, {
      userMessage: text.trim(), actions: [], isStreaming: true, id: messageId,
    }])
    setStatus('thinking')

    const update = (fn: (m: AiAgentMessage) => AiAgentMessage) => {
      setMessages(prev => prev.map(m => m.id === messageId ? fn(m) : m))
    }

    const markReasoningDone = () => {
      update(m => m.reasoningDone ? m : { ...m, reasoningDone: true })
    }

    const systemPrompt = contextRef.current ?? buildAgentSystemPrompt()

    await streamClaudeAgent(text.trim(), systemPrompt, vaultPath, {
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
              label: formatToolLabel(toolName, toolId),
              status: 'pending' as const,
              input,
            }],
          }
        })
      },

      onToolDone: (toolId, output) => {
        if (abortRef.current.aborted) return
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
      },
    })
  }, [status, vaultPath])

  const clearConversation = useCallback(() => {
    abortRef.current.aborted = true
    responseAccRef.current = ''
    setMessages([])
    setStatus('idle')
  }, [])

  return { messages, status, sendMessage, clearConversation }
}

// --- Helpers ---

function formatToolLabel(toolName: string, toolId: string): string {
  const suffix = toolId.slice(-6)
  const labels: Record<string, string> = {
    read_note: 'Reading note',
    create_note: 'Creating note',
    search_notes: 'Searching notes',
    append_to_note: 'Appending to note',
    edit_note_frontmatter: 'Editing frontmatter',
    delete_note: 'Deleting note',
    link_notes: 'Linking notes',
    list_notes: 'Listing notes',
    vault_context: 'Loading vault context',
    ui_open_note: 'Opening note',
    ui_open_tab: 'Opening tab',
    ui_highlight: 'Highlighting',
    ui_set_filter: 'Setting filter',
  }
  return `${labels[toolName] ?? toolName}... (${suffix})`
}
