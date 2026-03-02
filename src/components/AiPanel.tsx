import { useState, useRef, useEffect, useMemo } from 'react'
import { Robot, X, PaperPlaneRight, Plus, Link } from '@phosphor-icons/react'
import { AiMessage } from './AiMessage'
import { useAiAgent, type AiAgentMessage } from '../hooks/useAiAgent'
import { collectLinkedEntries, buildContextualPrompt } from '../utils/ai-context'
import type { VaultEntry } from '../types'

export type { AiAgentMessage } from '../hooks/useAiAgent'

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
  vaultPath: string
  activeEntry?: VaultEntry | null
  entries?: VaultEntry[]
  allContent?: Record<string, string>
}

function PanelHeader({ onClose, onClear }: { onClose: () => void; onClear: () => void }) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border"
      style={{ height: 45, padding: '0 12px', gap: 8 }}
    >
      <Robot size={16} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
        AI Chat
      </span>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClear}
        title="New conversation"
      >
        <Plus size={16} />
      </button>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClose}
        title="Close AI panel"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function ContextBar({ activeEntry, linkedCount }: { activeEntry: VaultEntry; linkedCount: number }) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border text-muted-foreground"
      style={{ padding: '6px 12px', gap: 6, fontSize: 11 }}
      data-testid="context-bar"
    >
      <Link size={12} className="shrink-0" />
      <span className="truncate" style={{ fontWeight: 500 }}>{activeEntry.title}</span>
      {linkedCount > 0 && (
        <span style={{ opacity: 0.6 }}>+ {linkedCount} linked</span>
      )}
    </div>
  )
}

function EmptyState({ hasContext }: { hasContext: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center text-muted-foreground"
      style={{ paddingTop: 40 }}
    >
      <Robot size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
      <p style={{ fontSize: 13, margin: '0 0 4px' }}>
        {hasContext
          ? 'Ask about this note and its linked context'
          : 'Open a note, then ask the AI about it'
        }
      </p>
      <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
        {hasContext
          ? 'Summarize, find connections, expand ideas'
          : 'The AI will use the active note as context'
        }
      </p>
    </div>
  )
}

function MessageHistory({ messages, isActive, onOpenNote, hasContext }: {
  messages: AiAgentMessage[]; isActive: boolean; onOpenNote?: (path: string) => void; hasContext: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isActive])

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.length === 0 && !isActive && <EmptyState hasContext={hasContext} />}
      {messages.map((msg, i) => (
        <AiMessage key={msg.id ?? i} {...msg} onOpenNote={onOpenNote} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function InputBar({ input, onInputChange, onSend, onKeyDown, isActive, hasContext }: {
  input: string; onInputChange: (v: string) => void
  onSend: () => void; onKeyDown: (e: React.KeyboardEvent) => void
  isActive: boolean; hasContext: boolean
}) {
  const sendDisabled = isActive || !input.trim()
  return (
    <div
      className="flex shrink-0 flex-col border-t border-border"
      style={{ padding: '8px 12px' }}
    >
      <div className="flex items-end gap-2">
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 border border-border bg-transparent text-foreground"
          style={{
            fontSize: 13, borderRadius: 8, padding: '8px 10px',
            outline: 'none', fontFamily: 'inherit',
          }}
          placeholder={hasContext ? 'Ask about this note...' : 'Ask the AI agent...'}
          disabled={isActive}
          data-testid="agent-input"
        />
        <button
          className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
          style={{
            background: sendDisabled ? 'var(--muted)' : 'var(--primary)',
            color: sendDisabled ? 'var(--muted-foreground)' : 'white',
            borderRadius: 8, width: 32, height: 34,
            cursor: sendDisabled ? 'not-allowed' : 'pointer',
          }}
          onClick={onSend}
          disabled={sendDisabled}
          title="Send message"
          data-testid="agent-send"
        >
          <PaperPlaneRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function AiPanel({ onClose, onOpenNote, vaultPath, activeEntry, entries, allContent }: AiPanelProps) {
  const [input, setInput] = useState('')

  const linkedEntries = useMemo(() => {
    if (!activeEntry || !entries) return []
    return collectLinkedEntries(activeEntry, entries)
  }, [activeEntry, entries])

  const contextPrompt = useMemo(() => {
    if (!activeEntry || !allContent) return undefined
    return buildContextualPrompt(activeEntry, linkedEntries, allContent)
  }, [activeEntry, linkedEntries, allContent])

  const agent = useAiAgent(vaultPath, contextPrompt)
  const hasContext = !!activeEntry

  const isActive = agent.status === 'thinking' || agent.status === 'tool-executing'

  const handleSend = () => {
    if (!input.trim() || isActive) return
    agent.sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <aside
      className="flex flex-1 flex-col overflow-hidden border-l border-border bg-background text-foreground"
      data-testid="ai-panel"
    >
      <PanelHeader onClose={onClose} onClear={agent.clearConversation} />
      {activeEntry && (
        <ContextBar activeEntry={activeEntry} linkedCount={linkedEntries.length} />
      )}
      <MessageHistory
        messages={agent.messages}
        isActive={isActive}
        onOpenNote={onOpenNote}
        hasContext={hasContext}
      />
      <InputBar
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isActive={isActive}
        hasContext={hasContext}
      />
    </aside>
  )
}
