import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Robot, X, PaperPlaneRight, Plus, Link } from '@phosphor-icons/react'
import { AiMessage } from './AiMessage'
import { WikilinkChatInput } from './WikilinkChatInput'
import { useAiAgent, type AiAgentMessage, type AgentFileCallbacks } from '../hooks/useAiAgent'
import { collectLinkedEntries, buildContextSnapshot, type NoteReference, type NoteListItem } from '../utils/ai-context'
import { findEntryByTarget } from '../utils/wikilinkColors'
import type { VaultEntry } from '../types'

export type { AiAgentMessage } from '../hooks/useAiAgent'

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  vaultPath: string
  activeEntry?: VaultEntry | null
  entries?: VaultEntry[]
  allContent?: Record<string, string>
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
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

function MessageHistory({ messages, isActive, onOpenNote, onNavigateWikilink, hasContext }: {
  messages: AiAgentMessage[]; isActive: boolean; onOpenNote?: (path: string) => void; onNavigateWikilink?: (target: string) => void; hasContext: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isActive])

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.length === 0 && !isActive && <EmptyState hasContext={hasContext} />}
      {messages.map((msg, i) => (
        <AiMessage key={msg.id ?? i} {...msg} onOpenNote={onOpenNote} onNavigateWikilink={onNavigateWikilink} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

export function AiPanel({ onClose, onOpenNote, onFileCreated, onFileModified, vaultPath, activeEntry, entries, allContent, openTabs, noteList, noteListFilter }: AiPanelProps) {
  const [input, setInput] = useState('')
  const [pendingRefs, setPendingRefs] = useState<NoteReference[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const linkedEntries = useMemo(() => {
    if (!activeEntry || !entries) return []
    return collectLinkedEntries(activeEntry, entries)
  }, [activeEntry, entries])

  const contextPrompt = useMemo(() => {
    if (!activeEntry || !allContent || !entries) return undefined
    return buildContextSnapshot({
      activeEntry,
      allContent,
      openTabs,
      noteList,
      noteListFilter,
      entries,
      references: pendingRefs.length > 0 ? pendingRefs : undefined,
    })
  }, [activeEntry, allContent, openTabs, noteList, noteListFilter, entries, pendingRefs])

  const fileCallbacks = useMemo<AgentFileCallbacks>(() => ({
    onFileCreated,
    onFileModified,
  }), [onFileCreated, onFileModified])

  const agent = useAiAgent(vaultPath, contextPrompt, fileCallbacks)
  const hasContext = !!activeEntry
  const isActive = agent.status === 'thinking' || agent.status === 'tool-executing'

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isActive) {
      panelRef.current?.focus()
    } else {
      inputRef.current?.focus()
    }
  }, [isActive])

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelRef.current?.contains(document.activeElement)) {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  const handleNavigateWikilink = useCallback((target: string) => {
    if (!entries) return
    const entry = findEntryByTarget(entries, target)
    if (entry) onOpenNote?.(entry.path)
  }, [entries, onOpenNote])

  const handleSend = useCallback((text: string, references: NoteReference[]) => {
    if (!text.trim() || isActive) return
    setPendingRefs(references)
    agent.sendMessage(text, references)
    setInput('')
  }, [isActive, agent])

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="flex flex-1 flex-col overflow-hidden bg-background text-foreground"
      style={{
        outline: 'none',
        borderLeft: isActive
          ? '2px solid var(--accent-blue, #3b82f6)'
          : '1px solid var(--border)',
        animation: isActive ? 'ai-border-pulse 2s ease-in-out infinite' : undefined,
        transition: 'border-color 0.3s ease',
      }}
      data-testid="ai-panel"
      data-ai-active={isActive || undefined}
    >
      <PanelHeader onClose={onClose} onClear={agent.clearConversation} />
      {activeEntry && (
        <ContextBar activeEntry={activeEntry} linkedCount={linkedEntries.length} />
      )}
      <MessageHistory
        messages={agent.messages}
        isActive={isActive}
        onOpenNote={onOpenNote}
        onNavigateWikilink={handleNavigateWikilink}
        hasContext={hasContext}
      />
      <div
        className="flex shrink-0 flex-col border-t border-border"
        style={{ padding: '8px 12px' }}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <WikilinkChatInput
              entries={entries ?? []}
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isActive}
              placeholder={hasContext ? 'Ask about this note...' : 'Ask the AI agent...'}
              inputRef={inputRef}
            />
          </div>
          <button
            className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
            style={{
              background: (isActive || !input.trim()) ? 'var(--muted)' : 'var(--primary)',
              color: (isActive || !input.trim()) ? 'var(--muted-foreground)' : 'white',
              borderRadius: 8, width: 32, height: 34,
              cursor: (isActive || !input.trim()) ? 'not-allowed' : 'pointer',
            }}
            onClick={() => handleSend(input, pendingRefs)}
            disabled={isActive || !input.trim()}
            title="Send message"
            data-testid="agent-send"
          >
            <PaperPlaneRight size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
