/**
 * Custom hook encapsulating AI chat state and message handling.
 * Uses Claude CLI subprocess via Tauri for streaming responses.
 *
 * Conversation continuity embeds prior exchanges in each prompt
 * (each CLI invocation is a fresh subprocess with no memory).
 * History is trimmed to MAX_HISTORY_TOKENS, dropping oldest first.
 *
 * Uses a ref (messagesRef) to read the latest messages in callbacks,
 * avoiding stale closure issues with React's useCallback memoization.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { VaultEntry } from '../types'
import {
  type ChatMessage, type ChatStreamCallbacks, nextMessageId,
  buildSystemPrompt, streamClaudeChat,
  trimHistory, formatMessageWithHistory, MAX_HISTORY_TOKENS,
} from '../utils/ai-chat'

interface ChatStreamRefs {
  abortRef: React.RefObject<boolean>
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setStreamingContent: React.Dispatch<React.SetStateAction<string>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
}

/** Create stream callbacks that accumulate text and update React state. */
function makeStreamCallbacks(
  refs: ChatStreamRefs,
): { callbacks: ChatStreamCallbacks; getAccumulated: () => string } {
  let accumulated = ''
  const callbacks: ChatStreamCallbacks = {
    onText: (chunk) => {
      if (refs.abortRef.current) return
      accumulated += chunk
      refs.setStreamingContent(accumulated)
    },
    onError: (error) => {
      if (refs.abortRef.current) return
      refs.setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}`, id: nextMessageId() }])
      refs.setStreamingContent('')
      refs.setIsStreaming(false)
    },
    onDone: () => {
      if (refs.abortRef.current) return
      if (accumulated) {
        refs.setMessages(prev => [...prev, { role: 'assistant', content: accumulated, id: nextMessageId() }])
      }
      refs.setStreamingContent('')
      refs.setIsStreaming(false)
    },
  }
  return { callbacks, getAccumulated: () => accumulated }
}

export function useAIChat(
  contextNotes: VaultEntry[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef(false)
  const isStreamingRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])

  // Keep refs in sync with state — runs after render, before next user interaction.
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])

  /** Internal: send text, reading history from the messages ref. */
  const doSend = useCallback((text: string, historyOverride?: ChatMessage[]) => {
    if (!text.trim() || isStreamingRef.current) return

    const history = historyOverride ?? messagesRef.current

    setMessages(prev => [...prev, { role: 'user', content: text.trim(), id: nextMessageId() }])
    setIsStreaming(true)
    setStreamingContent('')
    abortRef.current = false

    // Always include system prompt (each request is a fresh subprocess).
    const systemPrompt = buildSystemPrompt(contextNotes).prompt || undefined

    // Embed conversation history in the prompt for continuity.
    const trimmedHistory = trimHistory(history, MAX_HISTORY_TOKENS)
    const formattedMessage = formatMessageWithHistory(trimmedHistory, text.trim())

    const { callbacks } = makeStreamCallbacks({
      abortRef, setMessages, setStreamingContent, setIsStreaming,
    })

    streamClaudeChat(formattedMessage, systemPrompt, undefined, callbacks)
      .catch(() => { /* errors forwarded via onError */ })
  }, [contextNotes])

  const sendMessage = useCallback((text: string) => {
    doSend(text)
  }, [doSend])

  const clearConversation = useCallback(() => {
    abortRef.current = true
    setMessages([])
    setIsStreaming(false)
    setStreamingContent('')
  }, [])

  const retryMessage = useCallback((msgIndex: number) => {
    const currentMessages = messagesRef.current
    const userMsgIndex = msgIndex - 1
    if (userMsgIndex < 0) return
    const userMsg = currentMessages[userMsgIndex]
    if (userMsg.role !== 'user') return

    const historyForRetry = currentMessages.slice(0, userMsgIndex)
    setMessages(prev => prev.slice(0, userMsgIndex))
    doSend(userMsg.content, historyForRetry)
  }, [doSend])

  return { messages, isStreaming, streamingContent, sendMessage, clearConversation, retryMessage }
}
