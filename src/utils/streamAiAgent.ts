import { isTauri } from '../mock-tauri'
import { getAiAgentDefinition, type AiAgentId } from '../lib/aiAgents'
import {
  normalizeAiAgentPermissionMode,
  type AiAgentPermissionMode,
} from '../lib/aiAgentPermissionMode'
import { createScopedStreamEventName } from './aiStreamEvents'
import { cleanupTauriEventListener } from './tauriEventCleanup'

type AiAgentStreamEvent =
  | { kind: 'Init'; session_id: string }
  | { kind: 'TextDelta'; text: string }
  | { kind: 'ThinkingDelta'; text: string }
  | { kind: 'ToolStart'; tool_name: string; tool_id: string; input?: string }
  | { kind: 'ToolDone'; tool_id: string; output?: string }
  | { kind: 'Error'; message: string }
  | { kind: 'Done' }

export interface AgentStreamCallbacks {
  onText: (text: string) => void
  onThinking: (text: string) => void
  onToolStart: (toolName: string, toolId: string, input?: string) => void
  onToolDone: (toolId: string, output?: string) => void
  onError: (message: string) => void
  onDone: () => void
}

export interface StreamAiAgentRequest {
  agent: AiAgentId
  model?: string
  message: string
  systemPrompt?: string
  vaultPath: string
  vaultPaths?: string[]
  permissionMode?: AiAgentPermissionMode
  callbacks: AgentStreamCallbacks
  signal?: AbortSignal
}

const CONVERSATION_HISTORY_OPEN_MARKER = ['<', 'conversation_history', '>'].join('')
const USER_HISTORY_LINE_RE = /\[user\]: .+/g

function mockAgentResponse(agent: AiAgentId, message: string): string {
  const agentLabel = getAiAgentDefinition(agent).label
  if (message.indexOf(CONVERSATION_HISTORY_OPEN_MARKER) >= 0) {
    return mockConversationResponse(agentLabel, message)
  }
  return `[mock-${agentLabel.toLowerCase()}] You said: "${message}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
}

function mockConversationResponse(agentLabel: string, message: string): string {
  const allUserLines = message.match(USER_HISTORY_LINE_RE) ?? []
  const lastLine = allUserLines.at(-1) ?? ''
  const lastUserMsg = lastLine.replace('[user]: ', '')
  return `[mock-${agentLabel.toLowerCase()} turns=${allUserLines.length}] You asked: "${lastUserMsg}" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`
}

function handleStreamEvent(
  data: AiAgentStreamEvent,
  callbacks: AgentStreamCallbacks,
  abortNativeStream: () => void,
): void {
  switch (data.kind) {
    case 'TextDelta':
      callbacks.onText(data.text)
      return
    case 'ThinkingDelta':
      callbacks.onThinking(data.text)
      return
    case 'ToolStart':
      callbacks.onToolStart(data.tool_name, data.tool_id, data.input)
      return
    case 'ToolDone':
      callbacks.onToolDone(data.tool_id, data.output)
      return
    case 'Error':
      abortNativeStream()
      callbacks.onError(data.message)
      return
    case 'Done':
      callbacks.onDone()
      return
  }
}

function createStreamCloser(callbacks: AgentStreamCallbacks): () => void {
  let closed = false
  return () => {
    if (closed) return
    closed = true
    callbacks.onDone()
  }
}

function addAbortListener(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {}
  if (signal.aborted) {
    onAbort()
    return () => {}
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

function streamMockAiAgent(request: StreamAiAgentRequest): void {
  const { agent, message, callbacks, signal } = request
  const closeStream = createStreamCloser(callbacks)
  let removeAbortListener = (): void => {}
  const timeout = window.setTimeout(() => {
    removeAbortListener()
    callbacks.onText(mockAgentResponse(agent, message))
    closeStream()
  }, 300)
  removeAbortListener = addAbortListener(signal, () => {
    window.clearTimeout(timeout)
    closeStream()
  })
}

function nativeAgentStreamRequest(request: StreamAiAgentRequest, eventName: string) {
  return {
    agent: request.agent,
    model: request.model?.trim() || null,
    message: request.message,
    system_prompt: request.systemPrompt || null,
    vault_path: request.vaultPath,
    vault_paths: request.vaultPaths && request.vaultPaths.length > 0 ? request.vaultPaths : null,
    permission_mode: normalizeAiAgentPermissionMode(request.permissionMode),
    event_name: eventName,
  }
}

async function streamNativeAiAgent(request: StreamAiAgentRequest): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const eventName = createScopedStreamEventName('ai-agent-stream')
  const closeStream = createStreamCloser(request.callbacks)

  const abortNativeStream = (): void => {
    void invoke<boolean>('abort_ai_agent_stream', { eventName }).catch(() => {})
  }

  const unlisten = await listen<AiAgentStreamEvent>(eventName, (event) => {
    if (event.payload.kind === 'Done') {
      closeStream()
      return
    }

    handleStreamEvent(event.payload, request.callbacks, abortNativeStream)
  })
  const removeAbortListener = addAbortListener(request.signal, abortNativeStream)
  if (request.signal?.aborted) {
    cleanupTauriEventListener(unlisten)
    closeStream()
    return
  }

  try {
    await invoke<string>('stream_ai_agent', {
      request: nativeAgentStreamRequest(request, eventName),
    })
    closeStream()
  } catch (err) {
    request.callbacks.onError(err instanceof Error ? err.message : String(err))
    closeStream()
  } finally {
    removeAbortListener()
    cleanupTauriEventListener(unlisten)
  }
}

export async function streamAiAgent(request: StreamAiAgentRequest): Promise<void> {
  if (request.signal?.aborted) {
    request.callbacks.onDone()
    return
  }

  if (!isTauri()) {
    streamMockAiAgent(request)
    return
  }

  await streamNativeAiAgent(request)
}
