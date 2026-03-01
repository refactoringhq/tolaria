/**
 * AI Agent utilities — Claude CLI agent mode with MCP vault tools.
 *
 * The Claude CLI handles the tool-use loop internally via MCP.
 * The frontend receives streaming events for text, tool calls, and completion.
 */

import { isTauri } from '../mock-tauri'

// --- Agent system prompt ---

const AGENT_SYSTEM_PREAMBLE = `You are an AI assistant integrated into Laputa, a personal knowledge management app.
You can perform actions on the user's vault using the provided tools.
Be concise and helpful. When creating notes, use appropriate entity types and folder conventions.
When you've completed a task, briefly summarize what you did.`

export function buildAgentSystemPrompt(vaultContext?: string): string {
  if (!vaultContext) return AGENT_SYSTEM_PREAMBLE
  return `${AGENT_SYSTEM_PREAMBLE}\n\nVault context:\n${vaultContext}`
}

// --- Claude CLI agent streaming ---

type ClaudeAgentStreamEvent =
  | { kind: 'Init'; session_id: string }
  | { kind: 'TextDelta'; text: string }
  | { kind: 'ToolStart'; tool_name: string; tool_id: string }
  | { kind: 'ToolDone'; tool_id: string }
  | { kind: 'Result'; text: string; session_id: string }
  | { kind: 'Error'; message: string }
  | { kind: 'Done' }

export interface AgentStreamCallbacks {
  onText: (text: string) => void
  onToolStart: (toolName: string, toolId: string) => void
  onError: (message: string) => void
  onDone: () => void
}

/**
 * Stream an agent task through the Claude CLI subprocess with MCP tools.
 * The CLI handles the tool-use loop; we receive events for UI updates.
 */
export async function streamClaudeAgent(
  message: string,
  systemPrompt: string | undefined,
  vaultPath: string,
  callbacks: AgentStreamCallbacks,
): Promise<void> {
  if (!isTauri()) {
    setTimeout(() => {
      callbacks.onText('AI Agent requires the Claude CLI. Install it and run the native app.')
      callbacks.onDone()
    }, 300)
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const unlisten = await listen<ClaudeAgentStreamEvent>('claude-agent-stream', (event) => {
    const data = event.payload
    switch (data.kind) {
      case 'TextDelta':
        callbacks.onText(data.text)
        break
      case 'ToolStart':
        callbacks.onToolStart(data.tool_name, data.tool_id)
        break
      case 'Error':
        callbacks.onError(data.message)
        break
      case 'Done':
        callbacks.onDone()
        break
    }
  })

  try {
    await invoke<string>('stream_claude_agent', {
      request: {
        message,
        system_prompt: systemPrompt || null,
        vault_path: vaultPath,
      },
    })
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err))
    callbacks.onDone()
  } finally {
    unlisten()
  }
}
