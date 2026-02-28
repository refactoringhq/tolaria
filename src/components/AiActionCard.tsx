import type { ReactNode } from 'react'
import {
  PencilSimple, MagnifyingGlass, Link, Trash, ChartBar, Eye, Sparkle,
  CircleNotch, CheckCircle, XCircle,
} from '@phosphor-icons/react'

export type AiActionStatus = 'pending' | 'done' | 'error'

export interface AiActionCardProps {
  tool: string
  label: string
  path?: string
  status: AiActionStatus
  onOpenNote?: (path: string) => void
}

type IconRenderer = (size: number) => ReactNode

const TOOL_ICON_MAP: Record<string, IconRenderer> = {
  create_note: (s) => <PencilSimple size={s} />,
  edit_note_frontmatter: (s) => <PencilSimple size={s} />,
  append_to_note: (s) => <PencilSimple size={s} />,
  search_notes: (s) => <MagnifyingGlass size={s} />,
  list_notes: (s) => <MagnifyingGlass size={s} />,
  link_notes: (s) => <Link size={s} />,
  delete_note: (s) => <Trash size={s} />,
  vault_context: (s) => <ChartBar size={s} />,
  ui_open_note: (s) => <Eye size={s} />,
  ui_open_tab: (s) => <Eye size={s} />,
  ui_highlight: (s) => <Sparkle size={s} />,
  ui_set_filter: (s) => <Sparkle size={s} />,
}

const DEFAULT_ICON: IconRenderer = (s) => <PencilSimple size={s} />

function StatusIndicator({ status }: { status: AiActionStatus }) {
  if (status === 'pending') {
    return <CircleNotch size={14} className="ai-spin text-muted-foreground" data-testid="status-pending" />
  }
  if (status === 'done') {
    return <CheckCircle size={14} weight="fill" style={{ color: 'var(--accent-green)' }} data-testid="status-done" />
  }
  return <XCircle size={14} weight="fill" style={{ color: 'var(--destructive)' }} data-testid="status-error" />
}

export function AiActionCard({ tool, label, path, status, onOpenNote }: AiActionCardProps) {
  const renderIcon = TOOL_ICON_MAP[tool] ?? DEFAULT_ICON
  const isClickable = !!path && !!onOpenNote
  const isUiTool = tool.startsWith('ui_')

  return (
    <div
      className="flex items-center gap-2 rounded"
      style={{
        padding: '6px 10px',
        fontSize: 12,
        background: isUiTool ? 'rgba(74, 158, 255, 0.06)' : 'rgba(74, 158, 255, 0.1)',
        cursor: isClickable ? 'pointer' : 'default',
      }}
      onClick={isClickable ? () => onOpenNote(path) : undefined}
      role={isClickable ? 'button' : undefined}
      data-testid="ai-action-card"
    >
      <span className="shrink-0 text-muted-foreground">{renderIcon(14)}</span>
      <span className="flex-1 truncate">{label}</span>
      <StatusIndicator status={status} />
    </div>
  )
}
