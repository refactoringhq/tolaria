import type { MockAiStreamChunk, MockAiStreamHook } from '../types/laputaTestBridge'
import type { AgentStreamCallbacks } from './streamAiAgent'

function releaseMockChunk(chunk: MockAiStreamChunk, callbacks: AgentStreamCallbacks): boolean {
  switch (chunk.kind) {
    case 'text': callbacks.onText(chunk.text); return false
    case 'thinking': callbacks.onThinking(chunk.text); return false
    case 'tool-start': callbacks.onToolStart(chunk.toolName, chunk.toolId, chunk.input); return false
    case 'tool-done': callbacks.onToolDone(chunk.toolId, chunk.output); return false
    case 'error': callbacks.onError(chunk.message); callbacks.onDone(); return true
    case 'done': callbacks.onDone(); return true
  }
}

function subscribeToScriptedChunks(
  hook: MockAiStreamHook,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): void {
  const unsubscribe = hook.subscribe((chunk) => {
    if (releaseMockChunk(chunk, callbacks)) {
      unsubscribe()
      signal?.removeEventListener('abort', onAbort)
    }
  })
  const onAbort = (): void => {
    unsubscribe()
    callbacks.onDone()
  }
  if (signal?.aborted) onAbort()
  else signal?.addEventListener('abort', onAbort, { once: true })
}

export function streamScriptedMockAiResponse(
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): boolean {
  if (!import.meta.env.DEV || !window.__mockHandlers || !window.__mockAiStream?.hasScript()) return false
  subscribeToScriptedChunks(window.__mockAiStream, callbacks, signal)
  return true
}
