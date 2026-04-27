import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AgentFileCallbacks, AgentStatus } from '../hooks/useAiAgent'
import { detectFileOperation } from '../hooks/useAiAgent'
import type { AiAgentMessage } from './aiAgentConversation'
import {
  markReasoningDone,
  updateMessage,
  updateToolAction,
  type ToolInvocation,
} from './aiAgentMessageState'

export interface StreamMutationContext {
  messageId: string
  vaultPath: string
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>
  setStatus: Dispatch<SetStateAction<AgentStatus>>
  abortRef: MutableRefObject<{ aborted: boolean }>
  responseAccRef: MutableRefObject<string>
  toolInputMapRef: MutableRefObject<Map<string, ToolInvocation>>
  fileCallbacksRef: MutableRefObject<AgentFileCallbacks | undefined>
}

const EMPTY_CLAUDE_RESPONSE = 'Claude Code finished without returning a reply.'

function finalResponseText(response: string, hasToolActions: boolean): string {
  if (response.trim()) return response
  if (hasToolActions) return ''
  return EMPTY_CLAUDE_RESPONSE
}

export function createStreamCallbacks(context: StreamMutationContext) {
  const {
    messageId,
    vaultPath,
    setMessages,
    setStatus,
    abortRef,
    responseAccRef,
    toolInputMapRef,
    fileCallbacksRef,
  } = context

  return {
    onThinking: (chunk: string) => {
      if (abortRef.current.aborted) return
      updateMessage(setMessages, messageId, (message) => ({
        ...message,
        reasoning: (message.reasoning ?? '') + chunk,
      }))
    },

    onText: (chunk: string) => {
      if (abortRef.current.aborted) return
      markReasoningDone(setMessages, messageId)
      responseAccRef.current += chunk
    },

    onToolStart: (toolName: string, toolId: string, input?: string) => {
      if (abortRef.current.aborted) return

      markReasoningDone(setMessages, messageId)
      setStatus('tool-executing')

      const previous = toolInputMapRef.current.get(toolId)
      toolInputMapRef.current.set(toolId, { tool: toolName, input: input ?? previous?.input })

      updateMessage(setMessages, messageId, (message) => updateToolAction(message, toolName, toolId, input))
    },

    onToolDone: (toolId: string, output?: string) => {
      if (abortRef.current.aborted) return

      const info = toolInputMapRef.current.get(toolId)
      if (info) {
        detectFileOperation(info.tool, info.input, vaultPath, fileCallbacksRef.current)
      }

      updateMessage(setMessages, messageId, (message) => ({
        ...message,
        actions: message.actions.map((action) => (
          action.toolId === toolId ? { ...action, status: 'done' as const, output } : action
        )),
      }))
    },

    onError: (error: string) => {
      if (abortRef.current.aborted) return

      setStatus('error')
      const partial = responseAccRef.current
      updateMessage(setMessages, messageId, (message) => ({
        ...message,
        isStreaming: false,
        reasoningDone: true,
        response: partial ? `${partial}\n\nError: ${error}` : `Error: ${error}`,
        actions: message.actions.map((action) => (
          action.status === 'pending' ? { ...action, status: 'error' as const } : action
        )),
      }))
    },

    onDone: () => {
      if (abortRef.current.aborted) return

      setStatus('done')
      updateMessage(setMessages, messageId, (message) => {
        // onError already finalized the message — don't overwrite with fallback text
        if (!message.isStreaming) return message
        return {
          ...message,
          isStreaming: false,
          reasoningDone: true,
          response: finalResponseText(responseAccRef.current, message.actions.length > 0),
          actions: message.actions.map((action) => (
            action.status === 'pending' ? { ...action, status: 'done' as const } : action
          )),
        }
      })
      fileCallbacksRef.current?.onVaultChanged?.()
    },
  }
}
