import { useState } from 'react'
import { CaretRight, CaretDown, Brain, ArrowCounterClockwise } from '@phosphor-icons/react'
import { AiActionCard, type AiActionStatus } from './AiActionCard'

export interface AiAction {
  tool: string
  label: string
  path?: string
  status: AiActionStatus
}

export interface AiMessageProps {
  userMessage: string
  reasoning?: string
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  onOpenNote?: (path: string) => void
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end" style={{ marginBottom: 8 }}>
      <div
        style={{
          background: 'var(--muted)',
          color: 'var(--foreground)',
          borderRadius: '12px 12px 2px 12px',
          maxWidth: '85%',
          padding: '8px 12px',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {content}
      </div>
    </div>
  )
}

function ReasoningBlock({ text, expanded, onToggle }: {
  text: string; expanded: boolean; onToggle: () => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        className="flex items-center gap-1.5 w-full border-none bg-transparent cursor-pointer p-0 text-muted-foreground hover:text-foreground transition-colors"
        style={{ fontSize: 12, padding: '4px 0' }}
        onClick={onToggle}
        data-testid="reasoning-toggle"
      >
        <Brain size={14} />
        <span>Reasoning</span>
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </button>
      {expanded && (
        <div
          className="text-muted-foreground"
          style={{ fontSize: 12, lineHeight: 1.5, padding: '4px 0 4px 20px' }}
          data-testid="reasoning-content"
        >
          {text}
        </div>
      )}
    </div>
  )
}

function ActionCardsList({ actions, onOpenNote }: {
  actions: AiAction[]; onOpenNote?: (path: string) => void
}) {
  return (
    <div className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
      {actions.map((action, i) => (
        <AiActionCard
          key={`${action.tool}-${i}`}
          tool={action.tool}
          label={action.label}
          path={action.path}
          status={action.status}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  )
}

function ResponseBlock({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{text}</div>
      <button
        className="flex items-center gap-1 border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        style={{ fontSize: 11, marginTop: 4 }}
        data-testid="undo-button"
      >
        <ArrowCounterClockwise size={12} />
        <span>Undo</span>
      </button>
    </div>
  )
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: 12, padding: '4px 0' }}>
      <div className="flex gap-1">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
        <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

export function AiMessage({ userMessage, reasoning, actions, response, isStreaming, onOpenNote }: AiMessageProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)

  return (
    <div data-testid="ai-message" style={{ marginBottom: 16 }}>
      <UserBubble content={userMessage} />
      {reasoning && (
        <ReasoningBlock
          text={reasoning}
          expanded={reasoningExpanded}
          onToggle={() => setReasoningExpanded(!reasoningExpanded)}
        />
      )}
      {actions.length > 0 && <ActionCardsList actions={actions} onOpenNote={onOpenNote} />}
      {response && <ResponseBlock text={response} />}
      {isStreaming && !response && <StreamingIndicator />}
    </div>
  )
}
