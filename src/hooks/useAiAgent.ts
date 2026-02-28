/**
 * Hook for the AI agent panel — manages agent state, tool execution, and undo.
 *
 * States: idle → thinking → tool-executing → response
 */
import { useState, useCallback, useRef } from 'react'
import type { AiAction } from '../components/AiMessage'
import {
  runAgentLoop, buildAgentSystemPrompt, executeToolViaWs,
  getAgentModel, type AgentStepCallback,
} from '../utils/ai-agent'
import { getApiKey, nextMessageId } from '../utils/ai-chat'

export type AgentStatus = 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'

export interface AiAgentMessage {
  userMessage: string
  reasoning?: string
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  id?: string
}

export function useAiAgent() {
  const [messages, setMessages] = useState<AiAgentMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const abortRef = useRef({ aborted: false })
  const undoSnapshotRef = useRef<Map<string, string>>(new Map())
  const [canUndo, setCanUndo] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || status === 'thinking' || status === 'tool-executing') return

    if (!getApiKey()) {
      setMessages(prev => [...prev, {
        userMessage: text.trim(), actions: [],
        response: 'No API key configured. Open Settings (\u2318,) to add your Anthropic key.',
        id: nextMessageId(),
      }])
      return
    }

    abortRef.current = { aborted: false }
    undoSnapshotRef.current = new Map()
    setCanUndo(false)
    const snapshotMap = undoSnapshotRef.current

    const messageId = nextMessageId()
    setMessages(prev => [...prev, {
      userMessage: text.trim(), actions: [], isStreaming: true, id: messageId,
    }])
    setStatus('thinking')

    const update = (fn: (m: AiAgentMessage) => AiAgentMessage) => {
      setMessages(prev => prev.map(m => m.id === messageId ? fn(m) : m))
    }

    const callbacks: AgentStepCallback = {
      onThinking: () => setStatus('thinking'),

      onToolStart: async (toolName, toolId, args) => {
        setStatus('tool-executing')
        update(m => ({
          ...m,
          actions: [...m.actions, {
            tool: toolName,
            label: formatToolLabel(toolName, toolId),
            status: 'pending' as const,
          }],
        }))

        // Snapshot existing file before write operations
        const path = extractPathFromArgs(toolName, args)
        if (path && isWriteTool(toolName) && !snapshotMap.has(path)) {
          const { result, isError } = await executeToolViaWs('read_note', { path })
          if (!isError && result && typeof (result as Record<string, unknown>).content === 'string') {
            snapshotMap.set(path, (result as Record<string, unknown>).content as string)
          }
        }
      },

      onToolDone: (toolId, result, isError) => {
        update(m => ({
          ...m,
          actions: m.actions.map(a =>
            a.label.includes(toolId.slice(-6))
              ? { ...a, status: isError ? 'error' as const : 'done' as const, label: formatToolResult(a.tool, result) }
              : a,
          ),
        }))
      },

      onText: (text) => update(m => ({ ...m, response: (m.response ?? '') + text })),

      onError: (error) => {
        setStatus('error')
        update(m => ({ ...m, isStreaming: false, response: `Error: ${error}` }))
      },

      onDone: () => {
        setStatus('done')
        update(m => ({ ...m, isStreaming: false }))
      },
    }

    await runAgentLoop(text.trim(), getAgentModel(), buildAgentSystemPrompt(), callbacks, abortRef.current)

    if (snapshotMap.size > 0) setCanUndo(true)
  }, [status])

  const clearConversation = useCallback(() => {
    abortRef.current.aborted = true
    setMessages([])
    setStatus('idle')
    setCanUndo(false)
    undoSnapshotRef.current = new Map()
  }, [])

  const undoLastRun = useCallback(async () => {
    const snapshot = undoSnapshotRef.current
    if (snapshot.size === 0) return
    // Undo: delete newly created notes, or log that files were modified
    // Full content restore requires a write_note tool on the WS bridge
    for (const [path, content] of snapshot) {
      if (content === '') {
        // File didn't exist before — it was created by the agent, so delete it
        await executeToolViaWs('delete_note', { path }).catch(() => {})
      }
      // For modified files, content restore isn't available via WS bridge
    }
    undoSnapshotRef.current = new Map()
    setCanUndo(false)
  }, [])

  return { messages, status, sendMessage, clearConversation, canUndo, undoLastRun }
}

// --- Helpers ---

const WRITE_TOOLS = new Set(['create_note', 'append_to_note', 'edit_note_frontmatter', 'delete_note', 'link_notes'])

function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
}

function extractPathFromArgs(_toolName: string, args: Record<string, unknown>): string | null {
  if (args.path && typeof args.path === 'string') return args.path
  if (args.source_path && typeof args.source_path === 'string') return args.source_path
  return null
}

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

function formatToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return humanToolName(toolName)
  const r = result as Record<string, unknown>
  if (r.error) return `${humanToolName(toolName)}: Error`
  if (r.content && typeof r.content === 'string') return `Read: ${(r.content as string).slice(0, 40)}...`
  if (r.ok) return `${humanToolName(toolName)}: Done`
  if (Array.isArray(result)) return `Found ${result.length} results`
  return humanToolName(toolName)
}

function humanToolName(toolName: string): string {
  const names: Record<string, string> = {
    read_note: 'Read note',
    create_note: 'Created note',
    search_notes: 'Searched notes',
    append_to_note: 'Appended to note',
    edit_note_frontmatter: 'Edited frontmatter',
    delete_note: 'Deleted note',
    link_notes: 'Linked notes',
    list_notes: 'Listed notes',
    vault_context: 'Loaded vault context',
    ui_open_note: 'Opened note',
    ui_open_tab: 'Opened tab',
    ui_highlight: 'Highlighted',
    ui_set_filter: 'Set filter',
  }
  return names[toolName] ?? toolName
}
