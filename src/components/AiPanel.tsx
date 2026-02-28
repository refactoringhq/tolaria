import { useRef, useEffect } from 'react'
import { Robot, X, PaperPlaneRight } from '@phosphor-icons/react'
import { AiMessage, type AiAction } from './AiMessage'

export interface AiAgentMessage {
  userMessage: string
  reasoning?: string
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
}

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
}

const MOCK_MESSAGES: AiAgentMessage[] = [
  {
    userMessage: 'Crea una nota evento per la riunione con Marco domani',
    reasoning: "L'utente vuole creare un evento per una riunione con Marco. Devo creare un file in event/, impostare la data corretta (domani = 2026-03-01), e linkare Marco come partecipante.",
    actions: [
      { tool: 'vault_context', label: 'Loaded vault context', status: 'done' },
      { tool: 'create_note', label: 'Created: 2026-03-01-meeting-marco.md', path: 'event/2026-03-01-meeting-marco.md', status: 'done' },
      { tool: 'link_notes', label: 'Linked: Marco \u2192 meeting', status: 'done' },
      { tool: 'ui_open_tab', label: 'Opened tab', path: 'event/2026-03-01-meeting-marco.md', status: 'done' },
    ],
    response: 'Ho creato la nota evento e linkato Marco come partecipante. La trovi già aperta in un nuovo tab.',
  },
  {
    userMessage: 'Cerca tutte le note su TypeScript',
    actions: [
      { tool: 'search_notes', label: 'Searched: TypeScript', status: 'done' },
      { tool: 'ui_set_filter', label: 'Filtered results', status: 'done' },
    ],
    response: 'Ho trovato 12 note che menzionano TypeScript. Ho applicato il filtro nella lista note.',
  },
]

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border"
      style={{ height: 45, padding: '0 12px', gap: 8 }}
    >
      <Robot size={16} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
        AI
      </span>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClose}
        title="Close AI panel (\u2318I)"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function MessageHistory({ messages, onOpenNote }: {
  messages: AiAgentMessage[]; onOpenNote?: (path: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.map((msg, i) => (
        <AiMessage key={i} {...msg} onOpenNote={onOpenNote} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function InputBar() {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-t border-border"
      style={{ padding: '8px 12px' }}
    >
      <input
        className="flex-1 border border-border bg-transparent text-muted-foreground"
        style={{ fontSize: 13, borderRadius: 8, padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
        placeholder="Ask the AI agent..."
        disabled
      />
      <button
        className="shrink-0 flex items-center justify-center border-none"
        style={{
          background: 'var(--muted)',
          color: 'var(--muted-foreground)',
          borderRadius: 8, width: 32, height: 34,
          cursor: 'not-allowed',
        }}
        disabled
        title="Coming in Task 3"
      >
        <PaperPlaneRight size={16} />
      </button>
    </div>
  )
}

export function AiPanel({ onClose, onOpenNote }: AiPanelProps) {
  return (
    <aside
      className="flex flex-1 flex-col overflow-hidden border-l border-border bg-background text-foreground"
      data-testid="ai-panel"
    >
      <PanelHeader onClose={onClose} />
      <MessageHistory messages={MOCK_MESSAGES} onOpenNote={onOpenNote} />
      <InputBar />
    </aside>
  )
}
