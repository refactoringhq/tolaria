import { useEffect, useRef } from 'react'
import { Robot, X, PaperPlaneRight, Plus, Link } from '@phosphor-icons/react'
import { AiMessage } from './AiMessage'
import { WikilinkChatInput } from './WikilinkChatInput'
import { extractInlineWikilinkReferences } from './inlineWikilinkText'
import { t } from '../lib/i18n'
import type { AiAgentMessage } from '../hooks/useCliAiAgent'
import type { NoteReference } from '../utils/ai-context'
import type { VaultEntry } from '../types'

interface AiPanelHeaderProps {
  agentLabel: string
  agentReady: boolean
  legacyCopy: boolean
  onClose: () => void
  onNewChat: () => void
}

interface AiPanelContextBarProps {
  activeEntry: VaultEntry
  linkedCount: number
}

interface AiPanelMessageHistoryProps {
  agentLabel: string
  agentReady: boolean
  legacyCopy: boolean
  messages: AiAgentMessage[]
  isActive: boolean
  onOpenNote?: (path: string) => void
  onNavigateWikilink?: (target: string) => void
  hasContext: boolean
}

interface AiPanelComposerProps {
  entries: VaultEntry[]
  agentLabel: string
  agentReady: boolean
  hasContext: boolean
  input: string
  inputRef: React.RefObject<HTMLDivElement | null>
  isActive: boolean
  legacyCopy: boolean
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
}

function getComposerPlaceholder(
  agentLabel: string,
  agentReady: boolean,
  legacyCopy: boolean,
  hasContext: boolean,
): string {
  if (!agentReady) {
    return t('{agentLabel} is not installed. Open AI Agents in Settings.', { agentLabel })
  }

  if (legacyCopy) {
    return hasContext ? t('Ask about this note...') : t('Ask the AI agent...')
  }

  return hasContext ? t('Ask {agentLabel} about this note...', { agentLabel }) : t('Ask {agentLabel}...', { agentLabel })
}

function AiPanelEmptyState({
  agentLabel,
  agentReady,
  hasContext,
  legacyCopy,
}: Pick<AiPanelMessageHistoryProps, 'agentLabel' | 'agentReady' | 'hasContext' | 'legacyCopy'>) {
  if (!agentReady) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center text-muted-foreground"
        style={{ paddingTop: 40 }}
      >
        <Robot size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>
          {t('{agentLabel} is not available on this machine', { agentLabel })}
        </p>
        <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
          {t('Install it or switch the default AI agent in Settings')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center text-muted-foreground"
      style={{ paddingTop: 40 }}
    >
      <Robot size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>
          {hasContext
          ? legacyCopy ? t('Ask about this note and its linked context') : t('Ask {agentLabel} about this note and its linked context', { agentLabel })
          : legacyCopy ? t('Open a note, then ask the AI about it') : t('Open a note, then ask {agentLabel} about it', { agentLabel })
        }
        </p>
        <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
          {hasContext
          ? t('Summarize, find connections, expand ideas')
          : t('The AI will use the active note as context')
        }
        </p>
    </div>
  )
}

export function AiPanelHeader({
  agentLabel,
  agentReady,
  legacyCopy,
  onClose,
  onNewChat,
}: AiPanelHeaderProps) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border"
      style={{ height: 52, padding: '0 12px', gap: 8 }}
    >
      <Robot size={16} className="shrink-0 text-muted-foreground" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
          {legacyCopy ? t('AI Chat') : t('AI Agent')}
        </span>
        {!legacyCopy && (
          <span className="truncate text-[11px] text-muted-foreground">
            {agentLabel}
            {!agentReady ? ` · ${t('not installed')}` : ''}
          </span>
        )}
      </div>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onNewChat}
        aria-label={t('New AI chat')}
        title={t('New AI chat')}
      >
        <Plus size={16} />
      </button>
      <button
        className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={onClose}
        title={t('Close AI panel')}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function AiPanelContextBar({ activeEntry, linkedCount }: AiPanelContextBarProps) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-border text-muted-foreground"
      style={{ padding: '6px 12px', gap: 6, fontSize: 11 }}
      data-testid="context-bar"
    >
      <Link size={12} className="shrink-0" />
      <span className="truncate" style={{ fontWeight: 500 }}>{activeEntry.title}</span>
      {linkedCount > 0 && (
        <span style={{ opacity: 0.6 }}>{t('+ {linkedCount} linked', { linkedCount })}</span>
      )}
    </div>
  )
}

export function AiPanelMessageHistory({
  agentLabel,
  agentReady,
  legacyCopy,
  messages,
  isActive,
  onOpenNote,
  onNavigateWikilink,
  hasContext,
}: AiPanelMessageHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isActive])

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
      {messages.length === 0 && !isActive && (
        <AiPanelEmptyState
          agentLabel={agentLabel}
          agentReady={agentReady}
          legacyCopy={legacyCopy}
          hasContext={hasContext}
        />
      )}
      {messages.map((message, index) => (
        <AiMessage
          key={message.id ?? index}
          {...message}
          onOpenNote={onOpenNote}
          onNavigateWikilink={onNavigateWikilink}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}

export function AiPanelComposer({
  entries,
  agentLabel,
  agentReady,
  hasContext,
  input,
  inputRef,
  isActive,
  legacyCopy,
  onChange,
  onSend,
}: AiPanelComposerProps) {
  const composerDisabled = isActive || !agentReady
  const canSend = !composerDisabled && input.trim().length > 0
  const placeholder = getComposerPlaceholder(agentLabel, agentReady, legacyCopy, hasContext)
  const sendButtonStyle = {
    background: canSend ? 'var(--primary)' : 'var(--muted)',
    color: canSend ? 'white' : 'var(--muted-foreground)',
    borderRadius: 8,
    width: 32,
    height: 34,
    cursor: canSend ? 'pointer' : 'not-allowed',
  } as const

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border"
      style={{ padding: '8px 12px' }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <WikilinkChatInput
            entries={entries}
            value={input}
            onChange={onChange}
            onSend={onSend}
            disabled={composerDisabled}
            placeholder={placeholder}
            inputRef={inputRef}
          />
        </div>
        <button
          className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
          style={sendButtonStyle}
          onClick={() => onSend(input, extractInlineWikilinkReferences(input, entries))}
          disabled={!canSend}
          title={t('Send message')}
          data-testid="agent-send"
        >
          <PaperPlaneRight size={16} />
        </button>
      </div>
    </div>
  )
}
