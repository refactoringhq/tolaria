import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Stop, Sparkle } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import type { VaultEntry } from '../../types'
import type { AiAgentId } from '../../lib/aiAgents'
import { useCliAiAgent, type AgentStatus, type AiAgentMessage } from '../../hooks/useCliAiAgent'
import { buildKanbanAgentContext } from '../../utils/kanbanAgentContext'
import { Button } from '@/components/ui/button'

interface KanbanAgentPanelProps {
  entry: VaultEntry
  noteContent: string | null
  allEntries: VaultEntry[]
  vaultPath: string
  agent: AiAgentId
  agentReady: boolean
  agentLabel: string
  /** Optional callback to move the card to a new status. Used by the "Move to Review" CTA after a successful run. */
  onUpdateStatus?: (notePath: string, newStatus: string) => Promise<unknown> | void
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking…',
  'tool-executing': 'Working…',
  done: 'Done',
  error: 'Error',
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: 'var(--muted-foreground)',
  thinking: 'var(--accent-blue)',
  'tool-executing': 'var(--accent-orange)',
  done: 'var(--accent-green)',
  error: 'var(--destructive)',
}

async function fetchNoteContent(path: string): Promise<string> {
  return invoke<string>('get_note_content', { path })
}

function userPreview(message: AiAgentMessage): string {
  return message.userMessage.length > 200
    ? message.userMessage.slice(0, 200).trimEnd() + '…'
    : message.userMessage
}

export function KanbanAgentPanel({
  entry,
  noteContent,
  allEntries,
  vaultPath,
  agent,
  agentReady,
  agentLabel,
  onUpdateStatus,
}: KanbanAgentPanelProps) {
  const [contextPrompt, setContextPrompt] = useState<string | undefined>(undefined)
  const [contextError, setContextError] = useState<string | null>(null)
  const [isBuildingContext, setIsBuildingContext] = useState(false)
  const [reviewSuggestionDismissed, setReviewSuggestionDismissed] = useState(false)
  const cardPathRef = useRef(entry.path)

  useEffect(() => { cardPathRef.current = entry.path }, [entry.path])
  useEffect(() => { setReviewSuggestionDismissed(false) }, [entry.path])

  const { messages, status, sendMessage, clearConversation } = useCliAiAgent(
    vaultPath,
    contextPrompt,
    undefined,
    { agent, agentReady },
  )

  const handleRun = useCallback(async () => {
    if (!noteContent) return
    setContextError(null)
    setIsBuildingContext(true)
    try {
      const prompt = await buildKanbanAgentContext({
        entry,
        noteContent,
        allEntries,
        getContent: fetchNoteContent,
      })
      // Keep the system prompt override for follow-up messages in the same conversation,
      // but ALSO inline the context in the first user message so the agent sees it on the
      // initial round (useState updates don't propagate before the awaited sendMessage call).
      setContextPrompt(prompt)
      console.log('[kanban-agent] running on card', { path: entry.path, agent, contextLength: prompt.length })
      const inlineMessage = `${prompt}\n\n---\n\nComplete the task described above. Make the necessary changes to the vault and summarise what you did.`
      await sendMessage(inlineMessage)
    } catch (err) {
      console.error('[kanban-agent] failed to start run', err)
      setContextError(`Failed to start agent: ${err}`)
    } finally {
      setIsBuildingContext(false)
    }
  }, [agent, allEntries, entry, noteContent, sendMessage])

  const handleStop = useCallback(() => {
    console.log('[kanban-agent] clear conversation', { path: entry.path })
    clearConversation()
  }, [clearConversation, entry.path])

  const isRunning = status === 'thinking' || status === 'tool-executing' || isBuildingContext
  const canRun = !isRunning && agentReady && !!noteContent
  const showReviewSuggestion =
    status === 'done'
    && !isRunning
    && !!onUpdateStatus
    && !reviewSuggestionDismissed
    && (entry.status ?? 'backlog') !== 'review'
    && (entry.status ?? 'backlog') !== 'done'

  const handleMoveToReview = useCallback(async () => {
    if (!onUpdateStatus) return
    console.log('[kanban-agent] move to review after run', { path: entry.path })
    setReviewSuggestionDismissed(true)
    try {
      await onUpdateStatus(entry.path, 'review')
    } catch (err) {
      console.error('[kanban-agent] move to review failed', err)
    }
  }, [entry.path, onUpdateStatus])

  const renderedMessages = messages

  return (
    <div className="flex h-full flex-col gap-2 border-t bg-muted/10 p-3" data-testid="kanban-agent-panel">
      <header className="flex shrink-0 items-center gap-2">
        <Sparkle size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-foreground">{agentLabel}</span>
        <span
          className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: STATUS_COLOR[status], background: 'var(--muted)' }}
          data-testid="kanban-agent-status"
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[status] }} />
          {isBuildingContext ? 'Preparing context…' : STATUS_LABEL[status]}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isRunning ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={handleStop}
              className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-testid="kanban-agent-stop"
            >
              <Stop size={12} weight="fill" />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              size="xs"
              onClick={handleRun}
              disabled={!canRun}
              className="h-7 gap-1 text-xs"
              data-testid="kanban-agent-run"
            >
              <Play size={12} weight="fill" />
              Run on this task
            </Button>
          )}
        </div>
      </header>
      {contextError ? (
        <p className="text-xs text-destructive" data-testid="kanban-agent-error">{contextError}</p>
      ) : null}
      {showReviewSuggestion ? (
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 px-2 py-1.5 text-xs"
          data-testid="kanban-agent-review-suggestion"
        >
          <span className="text-foreground">Run finished. Move card to Review?</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setReviewSuggestionDismissed(true)}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              data-testid="kanban-agent-review-dismiss"
            >
              Dismiss
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleMoveToReview}
              className="h-6 text-[11px]"
              data-testid="kanban-agent-review-confirm"
            >
              Move to Review
            </Button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
        {renderedMessages.length === 0 ? (
          <p className="text-muted-foreground" data-testid="kanban-agent-empty">
            {agentReady
              ? 'Click "Run on this task" to start the agent. The note content and any wikilinked notes will be sent as context.'
              : `${agentLabel} is not ready. Check its installation in Settings before running.`}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {renderedMessages.map((message, index) => (
              <li key={message.id ?? `msg-${index}`} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">User</span>
                <pre className="max-w-full whitespace-pre-wrap break-words rounded-md bg-muted/30 px-2 py-1 font-sans text-foreground">
                  {userPreview(message)}
                </pre>
                {message.reasoning ? (
                  <details className="ml-2">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
                      Reasoning {message.reasoningDone ? '(done)' : '…'}
                    </summary>
                    <pre className="mt-1 max-w-full whitespace-pre-wrap break-words rounded-md bg-muted/20 px-2 py-1 font-sans italic text-muted-foreground">
                      {message.reasoning}
                    </pre>
                  </details>
                ) : null}
                {message.response ? (
                  <>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {agentLabel}
                      {message.isStreaming ? ' (streaming…)' : ''}
                    </span>
                    <pre className="max-w-full whitespace-pre-wrap break-words rounded-md bg-background px-2 py-1 font-sans text-foreground">
                      {message.response}
                    </pre>
                  </>
                ) : message.isStreaming ? (
                  <span className="text-[10px] italic text-muted-foreground">{agentLabel} is thinking…</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
