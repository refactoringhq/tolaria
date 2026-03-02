/**
 * Hook for the AI agent panel — manages agent state and streaming.
 * Uses Claude CLI subprocess with MCP tools via Tauri.
 *
 * States: idle -> thinking -> tool-executing -> done/error
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { AiAction } from '../components/AiMessage'
import { streamClaudeAgent, buildAgentSystemPrompt } from '../utils/ai-agent'
import { nextMessageId } from '../utils/ai-chat'

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AiAgentMessage {
  userMessage: string
  reasoning?: string
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

    const messageId = nextMessageId()
    setMessages(prev => [...prev, {
      userMessage: text.trim(), actions: [], isStreaming: true, id: messageId,
    }])
    setStatus('thinking')

    const update = (fn: (m: AiAgentMessage) => AiAgentMessage) => {
      setMessages(prev => prev.map(m => m.id === messageId ? fn(m) : m))
    }

    // When a contextual prompt is provided (from buildContextualPrompt),
    // use it directly — it already includes the system preamble.
    const systemPrompt = contextRef.current ?? buildAgentSystemPrompt()

    await streamClaudeAgent(text.trim(), systemPrompt, vaultPath, {
      onText: (text) => {
        if (abortRef.current.aborted) return
        update(m => ({ ...m, response: (m.response ?? '') + text }))
      },

      onToolStart: (toolName, toolId) => {
        if (abortRef.current.aborted) return
        setStatus('tool-executing')
        update(m => ({
          ...m,
          actions: [...m.actions, {
            tool: toolName,
            label: formatToolLabel(toolName, toolId),
            status: 'pending' as const,
          }],
        }))
      },

      onError: (error) => {
        if (abortRef.current.aborted) return
        setStatus('error')
        update(m => ({ ...m, isStreaming: false, response: (m.response ?? '') + `\nError: ${error}` }))
      },

      onDone: () => {
        if (abortRef.current.aborted) return
        setStatus('done')
        update(m => ({
          ...m,
          isStreaming: false,
          actions: m.actions.map(a => a.status === 'pending' ? { ...a, status: 'done' as const } : a),
        }))
      },
    })
  }, [status, vaultPath])

  const clearConversation = useCallback(() => {
    abortRef.current.aborted = true
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
