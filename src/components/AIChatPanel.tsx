import { useState, useRef, useEffect, useMemo } from 'react'
import type { VaultEntry } from '../types'
import {
  X, Plus, PaperPlaneRight, Copy, ArrowClockwise,
  TextIndent, Sparkle, MagnifyingGlass, Minus,
} from '@phosphor-icons/react'
import {
  type ChatMessage,
  buildSystemPrompt,
} from '../utils/ai-chat'
import { useAIChat } from '../hooks/useAIChat'
import { MarkdownContent } from './MarkdownContent'

// --- Sub-components ---

interface AIChatPanelProps {
  entry: VaultEntry | null
  allContent: Record<string, string>
  entries?: VaultEntry[]
  onClose: () => void
  onNavigateWikilink?: (target: string) => void
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2" style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 0' }}>
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
        <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

function ContextPill({ note, onRemove }: { note: VaultEntry; onRemove: () => void }) {
  return (
    <span
      className="flex items-center gap-1"
      style={{
        background: 'var(--accent-green-light)',
        borderRadius: 99, fontSize: 11,
        padding: '2px 6px 2px 8px', color: 'var(--foreground)', maxWidth: 160,
      }}
    >
      <span className="truncate">{note.title}</span>
      <button
        className="flex items-center justify-center shrink-0 border-none bg-transparent p-0 cursor-pointer text-muted-foreground hover:text-foreground"
        onClick={onRemove} title={`Remove ${note.title}`}
      >
        <Minus size={10} weight="bold" />
      </button>
    </span>
  )
}

function ContextSearchDropdown({
  entries, contextPaths, onAdd, onClose,
}: {
  entries: VaultEntry[]; contextPaths: Set<string>
  onAdd: (entry: VaultEntry) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return entries
      .filter(e => !contextPaths.has(e.path))
      .filter(e => !q || e.title.toLowerCase().includes(q) || (e.isA ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [entries, contextPaths, query])

  return (
    <div className="absolute left-0 right-0 bg-background border border-border rounded shadow-lg z-10"
      style={{ top: '100%', maxHeight: 240, overflow: 'hidden' }}>
      <div className="flex items-center gap-1 border-b border-border" style={{ padding: '4px 8px' }}>
        <MagnifyingGlass size={12} className="text-muted-foreground shrink-0" />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()} placeholder="Search notes..."
          className="flex-1 border-none bg-transparent text-foreground outline-none"
          style={{ fontSize: 12, padding: '2px 0' }} />
      </div>
      <div style={{ overflow: 'auto', maxHeight: 200 }}>
        {filtered.map(entry => (
          <button key={entry.path}
            className="flex items-center gap-2 w-full text-left border-none bg-transparent cursor-pointer hover:bg-accent text-foreground"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={() => { onAdd(entry); onClose() }}>
            <span className="text-muted-foreground" style={{ fontSize: 10, minWidth: 60 }}>{entry.isA ?? 'Note'}</span>
            <span className="truncate">{entry.title}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-muted-foreground text-center" style={{ padding: 12, fontSize: 12 }}>No matching notes</div>
        )}
      </div>
    </div>
  )
}

function AssistantMessage({ msg, onRetry, onNavigateWikilink }: { msg: ChatMessage; onRetry: () => void; onNavigateWikilink?: (target: string) => void }) {
  return (
    <div>
      <MarkdownContent content={msg.content} onWikilinkClick={onNavigateWikilink} />
      <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
        <button className="border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:underline"
          style={{ fontSize: 11 }} onClick={() => navigator.clipboard.writeText(msg.content)}>
          <Copy size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />Copy
        </button>
        <button className="border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:underline"
          style={{ fontSize: 11 }} onClick={onRetry}>
          <ArrowClockwise size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />Retry
        </button>
        <button className="border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:underline"
          style={{ fontSize: 11 }}>
          <TextIndent size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />Insert
        </button>
      </div>
    </div>
  )
}

function StreamingContent({ content, onNavigateWikilink }: { content: string; onNavigateWikilink?: (target: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <MarkdownContent content={content} onWikilinkClick={onNavigateWikilink} />
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div style={{
        background: 'var(--primary)', color: 'white',
        borderRadius: '12px 12px 2px 12px', maxWidth: '85%',
        padding: '8px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
      }}>{content}</div>
    </div>
  )
}

function formatTokens(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`
}

const QUICK_ACTIONS = [
  { label: 'Summarize', message: 'Summarize this note' },
  { label: 'Expand', message: 'Expand this note with more detail' },
  { label: 'Fix grammar', message: 'Fix grammar and improve readability' },
]

// --- Context management hook ---

function useContextNotes(entry: VaultEntry | null) {
  const [contextNotes, setContextNotes] = useState<VaultEntry[]>([])

  useEffect(() => {
    if (entry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync context when active note changes
      setContextNotes(prev => prev.some(n => n.path === entry.path) ? prev : [entry, ...prev])
    }
  }, [entry?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = (note: VaultEntry) => {
    setContextNotes(prev => prev.some(n => n.path === note.path) ? prev : [...prev, note])
  }
  const removeNote = (path: string) => {
    setContextNotes(prev => prev.filter(n => n.path !== path))
  }
  const paths = useMemo(() => new Set(contextNotes.map(n => n.path)), [contextNotes])

  return { contextNotes, addNote, removeNote, paths }
}

// --- Main component ---

export function AIChatPanel({ entry, allContent, entries = [], onClose, onNavigateWikilink }: AIChatPanelProps) {
  const [input, setInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const ctx = useContextNotes(entry)
  const chat = useAIChat(allContent, ctx.contextNotes)

  const contextInfo = useMemo(
    () => buildSystemPrompt(ctx.contextNotes, allContent),
    [ctx.contextNotes, allContent],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages, chat.isStreaming, chat.streamingContent])

  const handleSend = () => { chat.sendMessage(input); setInput('') }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <aside className="flex flex-1 flex-col overflow-hidden border-l border-border bg-background text-foreground">
      <PanelHeader onClear={chat.clearConversation} onClose={onClose} />

      <ContextBar
        notes={ctx.contextNotes} entries={entries} contextPaths={ctx.paths}
        tokenCount={contextInfo.totalTokens} truncated={contextInfo.truncated}
        showSearch={showSearch} onToggleSearch={() => setShowSearch(!showSearch)}
        onAdd={ctx.addNote} onRemove={ctx.removeNote} onCloseSearch={() => setShowSearch(false)}
      />

      <MessageList
        messages={chat.messages} isStreaming={chat.isStreaming}
        streamingContent={chat.streamingContent} onRetry={chat.retryMessage}
        messagesEndRef={messagesEndRef} onNavigateWikilink={onNavigateWikilink}
      />

      <QuickActionsBar actions={QUICK_ACTIONS} disabled={chat.isStreaming}
        onAction={msg => { chat.sendMessage(msg); setInput('') }} />

      <InputArea input={input} onInputChange={setInput}
        onKeyDown={handleKeyDown} onSend={handleSend} disabled={chat.isStreaming || !input.trim()} />

      <style>{`
        .typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--muted-foreground);
          animation: typing-bounce 1.2s infinite ease-in-out;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </aside>
  )
}

// --- Extracted layout sections ---

function PanelHeader({ onClear, onClose }: { onClear: () => void; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center border-b border-border" style={{ height: 45, padding: '0 12px', gap: 8 }}>
      <Sparkle size={16} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>AI Chat</span>
      <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClear} title="New conversation"><Plus size={16} /></button>
      <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClose} title="Close AI Chat"><X size={16} /></button>
    </div>
  )
}

function ContextBar({
  notes, entries, contextPaths, tokenCount, truncated,
  showSearch, onToggleSearch, onAdd, onRemove, onCloseSearch,
}: {
  notes: VaultEntry[]; entries: VaultEntry[]; contextPaths: Set<string>
  tokenCount: number; truncated: boolean
  showSearch: boolean; onToggleSearch: () => void
  onAdd: (note: VaultEntry) => void; onRemove: (path: string) => void; onCloseSearch: () => void
}) {
  return (
    <div className="relative flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border" style={{ padding: '6px 12px' }}>
      {notes.map(note => (
        <ContextPill key={note.path} note={note} onRemove={() => onRemove(note.path)} />
      ))}
      <button
        className="flex items-center gap-0.5 border border-dashed border-border bg-transparent text-muted-foreground cursor-pointer hover:text-foreground rounded-full"
        style={{ fontSize: 11, padding: '2px 8px' }} onClick={onToggleSearch} title="Add note to context">
        <Plus size={10} weight="bold" /><span>Add</span>
      </button>
      {notes.length > 0 && (
        <span className="text-muted-foreground ml-auto" style={{ fontSize: 10 }}>
          ~{formatTokens(tokenCount)} tokens{truncated && ' (truncated)'}
        </span>
      )}
      {showSearch && (
        <ContextSearchDropdown entries={entries} contextPaths={contextPaths} onAdd={onAdd} onClose={onCloseSearch} />
      )}
    </div>
  )
}

function MessageList({
  messages, isStreaming, streamingContent, onRetry, messagesEndRef, onNavigateWikilink,
}: {
  messages: ChatMessage[]; isStreaming: boolean; streamingContent: string
  onRetry: (idx: number) => void; messagesEndRef: React.RefObject<HTMLDivElement | null>
  onNavigateWikilink?: (target: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground" style={{ paddingTop: 40 }}>
          <Sparkle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ fontSize: 13, margin: '0 0 4px' }}>Ask anything about your notes</p>
          <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>Powered by Claude CLI</p>
        </div>
      )}
      {messages.map((msg, idx) => (
        <div key={msg.id} style={{ marginBottom: 12 }}>
          {msg.role === 'user'
            ? <UserBubble content={msg.content} />
            : <AssistantMessage msg={msg} onRetry={() => onRetry(idx)} onNavigateWikilink={onNavigateWikilink} />}
        </div>
      ))}
      {isStreaming && streamingContent && <StreamingContent content={streamingContent} onNavigateWikilink={onNavigateWikilink} />}
      {isStreaming && !streamingContent && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  )
}

function QuickActionsBar({
  actions, disabled, onAction,
}: {
  actions: { label: string; message: string }[]; disabled: boolean; onAction: (msg: string) => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border" style={{ padding: '8px 12px' }}>
      {actions.map(a => (
        <button key={a.label}
          className="cursor-pointer bg-transparent text-foreground hover:bg-accent transition-colors"
          style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 99, padding: '3px 10px' }}
          onClick={() => onAction(a.message)} disabled={disabled}>
          {a.label}
        </button>
      ))}
    </div>
  )
}

function InputArea({
  input, onInputChange, onKeyDown, onSend, disabled,
}: {
  input: string; onInputChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void; onSend: () => void; disabled: boolean
}) {
  return (
    <div className="flex shrink-0 flex-col border-t border-border" style={{ padding: '8px 12px' }}>
      <div className="flex items-end gap-2">
        <textarea value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Ask about your notes..." rows={1}
          className="flex-1 resize-none border border-border bg-transparent text-foreground"
          style={{ fontSize: 13, borderRadius: 8, padding: '8px 10px', outline: 'none', lineHeight: 1.4, maxHeight: 100, fontFamily: 'inherit' }} />
        <button className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
          style={{ background: 'var(--primary)', color: 'white', borderRadius: 8, width: 32, height: 34 }}
          onClick={onSend} disabled={disabled} title="Send message">
          <PaperPlaneRight size={16} />
        </button>
      </div>
    </div>
  )
}
