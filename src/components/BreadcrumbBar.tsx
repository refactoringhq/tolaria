import { memo } from 'react'
import type { VaultEntry, NoteStatus } from '../types'
import { cn } from '@/lib/utils'
import {
  MagnifyingGlass,
  GitBranch,
  CursorText,
  Sparkle,
  SlidersHorizontal,
  DotsThree,
  Trash,
  ArrowCounterClockwise,
  Archive,
  ArrowUUpLeft,
} from '@phosphor-icons/react'

interface BreadcrumbBarProps {
  entry: VaultEntry
  wordCount: number
  noteStatus: NoteStatus
  showDiffToggle: boolean
  diffMode: boolean
  diffLoading: boolean
  onToggleDiff: () => void
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed?: boolean
  onToggleInspector?: () => void
  onTrash?: () => void
  onRestore?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
}

const DISABLED_ICON_STYLE = { opacity: 0.4, cursor: 'not-allowed' } as const

function BreadcrumbActions({ entry, showDiffToggle, diffMode, diffLoading, onToggleDiff,
  showAIChat, onToggleAIChat, inspectorCollapsed, onToggleInspector,
  onTrash, onRestore, onArchive, onUnarchive,
}: Omit<BreadcrumbBarProps, 'wordCount' | 'noteStatus'>) {
  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        title="Search in file"
      >
        <MagnifyingGlass size={16} />
      </button>
      {showDiffToggle ? (
        <button
          className={cn(
            "flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors",
            diffMode ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onToggleDiff}
          disabled={diffLoading}
          title={diffLoading ? 'Loading diff...' : diffMode ? 'Back to editor' : 'Show diff'}
        >
          <GitBranch size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
          style={DISABLED_ICON_STYLE}
          title="No changes"
          tabIndex={-1}
        >
          <GitBranch size={16} />
        </button>
      )}
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
        style={DISABLED_ICON_STYLE}
        title="Coming soon"
        tabIndex={-1}
      >
        <CursorText size={16} />
      </button>
      <button
        className={cn(
          "flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors",
          showAIChat ? "" : "text-muted-foreground hover:text-foreground"
        )}
        style={showAIChat ? { color: 'var(--primary)' } : undefined}
        onClick={onToggleAIChat}
        title={showAIChat ? 'Close AI Chat' : 'Open AI Chat'}
      >
        <Sparkle size={16} weight={showAIChat ? 'fill' : 'regular'} />
      </button>
      {entry.archived ? (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onUnarchive}
          title="Unarchive (Cmd+E)"
        >
          <ArrowUUpLeft size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onArchive}
          title="Archive (Cmd+E)"
        >
          <Archive size={16} />
        </button>
      )}
      {entry.trashed ? (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          onClick={onRestore}
          title="Restore from trash"
        >
          <ArrowCounterClockwise size={16} />
        </button>
      ) : (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer transition-colors text-muted-foreground hover:text-destructive"
          onClick={onTrash}
          title="Move to trash (Cmd+Delete)"
        >
          <Trash size={16} />
        </button>
      )}
      {inspectorCollapsed && (
        <button
          className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={onToggleInspector}
          title="Open Properties"
        >
          <SlidersHorizontal size={16} />
        </button>
      )}
      <button
        className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
        style={DISABLED_ICON_STYLE}
        title="Coming soon"
        tabIndex={-1}
      >
        <DotsThree size={16} />
      </button>
    </div>
  )
}

export const BreadcrumbBar = memo(function BreadcrumbBar({
  entry, wordCount, noteStatus, ...actionProps
}: BreadcrumbBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        height: 45,
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 16px',
      }}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1 min-w-0 whitespace-nowrap" style={{ fontSize: 12 }}>
        <span className="shrink-0 text-muted-foreground">{entry.isA || 'Note'}</span>
        <span className="shrink-0 text-muted-foreground" style={{ margin: '0 2px' }}>&rsaquo;</span>
        <span className="truncate font-medium text-foreground" style={{ maxWidth: '40vw' }}>{entry.title}</span>
        <span className="shrink-0 text-muted-foreground" style={{ margin: '0 4px' }}>&middot;</span>
        <span className="shrink-0 text-muted-foreground">{wordCount.toLocaleString()} words</span>
        {noteStatus === 'pendingSave' && (
          <>
            <span className="text-muted-foreground" style={{ margin: '0 4px' }}>&middot;</span>
            <span className="font-semibold tab-status-pulse" style={{ color: 'var(--accent-green)' }}>Saving…</span>
          </>
        )}
        {noteStatus === 'new' && (
          <>
            <span className="text-muted-foreground" style={{ margin: '0 4px' }}>&middot;</span>
            <span className="font-semibold" style={{ color: 'var(--accent-green)' }}>N</span>
          </>
        )}
        {noteStatus === 'modified' && (
          <>
            <span className="text-muted-foreground" style={{ margin: '0 4px' }}>&middot;</span>
            <span className="font-semibold" style={{ color: 'var(--accent-yellow)' }}>M</span>
          </>
        )}
      </div>

      {/* Right: action icons */}
      <BreadcrumbActions entry={entry} {...actionProps} />
    </div>
  )
})
