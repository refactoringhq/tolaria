/**
 * Custom hook encapsulating AI chat state and message handling.
 * Uses Claude CLI subprocess via Tauri for streaming responses.
 */
import { useState, useCallback, useRef } from 'react'
import type { VaultEntry } from '../types'
import {
  type ChatMessage, nextMessageId,
  buildSystemPrompt, streamClaudeChat,
} from '../utils/ai-chat'

export function useAIChat(
  allContent: Record<string, string>,
  contextNotes: VaultEntry[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef(false)
  const sessionIdRef = useRef<string | undefined>(undefined)

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), id: nextMessageId() }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingContent('')
    abortRef.current = false

    const { prompt: systemPrompt } = buildSystemPrompt(contextNotes, allContent)
    let accumulated = ''

    streamClaudeChat(text.trim(), systemPrompt || undefined, sessionIdRef.current, {
      onInit: (sid) => { sessionIdRef.current = sid },

      onText: (chunk) => {
        if (abortRef.current) return
        accumulated += chunk
        setStreamingContent(accumulated)
      },

      onError: (error) => {
        if (abortRef.current) return
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}`, id: nextMessageId() }])
        setStreamingContent('')
        setIsStreaming(false)
      },

      onDone: () => {
        if (abortRef.current) return
        if (accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: accumulated, id: nextMessageId() }])
        }
        setStreamingContent('')
        setIsStreaming(false)
      },
    }).then(sid => {
      if (sid) sessionIdRef.current = sid
    })
  }, [isStreaming, allContent, contextNotes])

  const clearConversation = useCallback(() => {
    abortRef.current = true
    setMessages([])
    setIsStreaming(false)
    setStreamingContent('')
    sessionIdRef.current = undefined
  }, [])

  const retryMessage = useCallback((msgIndex: number) => {
    const userMsgIndex = msgIndex - 1
    if (userMsgIndex < 0) return
    const userMsg = messages[userMsgIndex]
    if (userMsg.role !== 'user') return

    setMessages(prev => prev.slice(0, msgIndex))
    sendMessage(userMsg.content)
  }, [messages, sendMessage])

  return { messages, isStreaming, streamingContent, sendMessage, clearConversation, retryMessage }
}
