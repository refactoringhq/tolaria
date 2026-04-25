import { useState, useEffect, useCallback, useRef, memo, type KeyboardEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import { isTauri, mockInvoke } from '../mock-tauri'
import { useDragRegion } from '../hooks/useDragRegion'
import type { PulseCommit, PulseFile } from '../types'
import { relativeDate } from '../utils/noteListHelpers'
import {
  Plus, Minus, PencilSimple, GitCommit, ArrowSquareOut,
  FileText, CaretDown, CaretRight, Pulse,
} from '@phosphor-icons/react'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

interface PulseViewProps {
  vaultPath: string
  onOpenNote?: (relativePath: string, commitHash?: string) => void
  sidebarCollapsed?: boolean
  onExpandSidebar?: () => void
}

function groupCommitsByDay(commits: PulseCommit[]): Map<string, PulseCommit[]> {
  const groups = new Map<string, PulseCommit[]>()
  for (const commit of commits) {
    const date = new Date(commit.date * 1000)
    const key = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const existing = groups.get(key)
    if (existing) {
      existing.push(commit)
    } else {
      groups.set(key, [commit])
    }
  }
  return groups
}

function isToday(dateKey: string): boolean {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return dateKey === today
}

function isYesterday(dateKey: string): boolean {
  const yesterday = new Date(Date.now() - 86400000)
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return dateKey === yesterday
}

function formatDayLabel(dateKey: string): string {
  if (isToday(dateKey)) return 'Today'
  if (isYesterday(dateKey)) return 'Yesterday'
  return dateKey
}

const STATUS_ICON = {
  added: Plus,
  modified: PencilSimple,
  deleted: Minus,
} as const

const STATUS_COLOR = {
  added: 'var(--accent-green)',
  modified: 'var(--accent-orange)',
  deleted: 'var(--destructive)',
} as const

const PULSE_ROW_FOCUS_CLASS_NAME = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70 focus-visible:ring-inset'
const PULSE_EDGE_TO_EDGE_ROW_CLASS_NAME = '-mx-4 rounded-none px-4'

function SummaryBadges({ added, modified, deleted }: { added: number; modified: number; deleted: number }) {
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      {added > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.added }}>+{added}</span>}
      {modified > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.modified }}>~{modified}</span>}
      {deleted > 0 && <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR.deleted }}>-{deleted}</span>}
    </div>
  )
}

function handleActivationKey(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  action()
}

function FileItem({
  file,
  commitHash,
  onOpenNote,
}: {
  file: PulseFile
  commitHash: string
  onOpenNote?: (path: string, commitHash?: string) => void
}) {
  const Icon = STATUS_ICON[file.status] ?? FileText
  const color = STATUS_COLOR[file.status] ?? 'var(--muted-foreground)'
  const handleOpen = useCallback(() => {
    onOpenNote?.(file.path, commitHash)
  }, [commitHash, file.path, onOpenNote])

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center rounded text-left transition-colors hover:bg-accent focus-visible:bg-accent disabled:cursor-default disabled:hover:bg-transparent',
        PULSE_ROW_FOCUS_CLASS_NAME,
      )}
      style={{ gap: 6, padding: '3px 8px' }}
      onClick={handleOpen}
      onKeyDown={(event) => handleActivationKey(event, handleOpen)}
      title={file.path}
      disabled={!onOpenNote}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} weight="bold" />
      <span
        className={`truncate text-[12px] ${file.status === 'deleted' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
      >
        {file.title}
      </span>
    </button>
  )
}

function CommitCard({
  commit,
  onOpenNote,
}: {
  commit: PulseCommit
  onOpenNote?: (path: string, commitHash?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? CaretDown : CaretRight
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), [])

  return (
    <div className="border-b border-border px-4 py-2">
      <div
        className={cn(
          'flex cursor-pointer items-start justify-between py-2 transition-colors focus-visible:bg-accent/40',
          PULSE_ROW_FOCUS_CLASS_NAME,
          PULSE_EDGE_TO_EDGE_ROW_CLASS_NAME,
          expanded ? 'bg-accent/40' : 'hover:bg-accent/40',
        )}
        style={{ gap: 8 }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          handleActivationKey(event, toggleExpanded)
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 6, marginBottom: 2 }}>
            <GitCommit size={13} className="text-muted-foreground" style={{ flexShrink: 0 }} />
            <span className="truncate text-[13px] font-medium text-foreground">{commit.message}</span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="text-[11px] text-muted-foreground">{relativeDate(commit.date)}</span>
            {commit.githubUrl ? (
              <a
                className="flex items-center text-[11px] font-mono text-primary no-underline hover:underline"
                style={{ gap: 3 }}
                href={commit.githubUrl}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (isTauri()) {
                    import('@tauri-apps/plugin-opener').then((mod) => mod.openUrl(commit.githubUrl!))
                  } else {
                    window.open(commit.githubUrl!, '_blank')
                  }
                }}
                title="Open on GitHub"
              >
                {commit.shortHash}
                <ArrowSquareOut size={10} />
              </a>
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground">{commit.shortHash}</span>
            )}
            <SummaryBadges added={commit.added} modified={commit.modified} deleted={commit.deleted} />
          </div>
        </div>
        <button
          type="button"
          className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
          style={{ width: 20, height: 20 }}
          onClick={(event) => {
            event.stopPropagation()
            toggleExpanded()
          }}
          aria-label={expanded ? 'Collapse files' : 'Expand files'}
        >
          <Chevron size={12} />
        </button>
      </div>
      {expanded && commit.files.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 4 }}>
          {commit.files.map((file) => (
            <FileItem key={file.path} file={file} commitHash={commit.hash} onOpenNote={onOpenNote} />
          ))}
        </div>
      )}
    </div>
  )
}

function DayGroup({ label, commits, onOpenNote }: {
  label: string
  commits: PulseCommit[]
  onOpenNote?: (path: string, commitHash?: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const Chevron = collapsed ? CaretRight : CaretDown
  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), [])

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer select-none items-center border-b border-border bg-muted/50 transition-colors hover:bg-muted focus-visible:bg-muted',
          PULSE_ROW_FOCUS_CLASS_NAME,
        )}
        style={{ padding: '6px 16px', gap: 6 }}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
        onKeyDown={(event) => handleActivationKey(event, toggleCollapsed)}
      >
        <Chevron size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          ({commits.length} {commits.length === 1 ? 'commit' : 'commits'})
        </span>
      </div>
      {!collapsed && commits.map((commit) => (
        <CommitCard key={commit.hash} commit={commit} onOpenNote={onOpenNote} />
      ))}
    </div>
  )
}

function PulseHeader({
  sidebarCollapsed,
  onExpandSidebar,
}: Pick<PulseViewProps, 'sidebarCollapsed' | 'onExpandSidebar'>) {
  const { onMouseDown } = useDragRegion()

  return (
    <div
      className="flex shrink-0 items-center justify-between border-b border-border"
      style={{ height: 52, padding: '0 16px', cursor: 'default' }}
      onMouseDown={onMouseDown}
      data-testid="pulse-header"
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        {sidebarCollapsed && onExpandSidebar && (
          <button
            type="button"
            className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            style={{ width: 24, height: 24 }}
            onClick={onExpandSidebar}
            aria-label="Expand sidebar"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        )}
        <Pulse size={16} className="text-primary" />
        <span className="text-[14px] font-semibold text-foreground">History</span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground" style={{ padding: 32 }}>
      <Pulse size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
      <p className="text-[13px]">No activity yet</p>
      <p className="text-[12px]" style={{ marginTop: 4 }}>
        Commit changes to see your vault's history
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground" style={{ padding: 32 }}>
      <p className="text-[13px]">{message}</p>
      <button
        className="mt-2 cursor-pointer rounded border border-border bg-transparent px-3 py-1 text-[12px] text-foreground transition-colors hover:bg-accent"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  )
}

function PulseFeed({
  commits,
  dayGroups,
  loading,
  loadingMore,
  error,
  onOpenNote,
  onRetry,
  sentinelRef,
}: {
  commits: PulseCommit[]
  dayGroups: Map<string, PulseCommit[]>
  loading: boolean
  loadingMore: boolean
  error: string | null
  onOpenNote?: (path: string, commitHash?: string) => void
  onRetry: () => void
  sentinelRef: React.RefObject<HTMLDivElement | null>
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 32 }}>
        <span className="text-[13px] text-muted-foreground">Loading activity…</span>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (commits.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      {Array.from(dayGroups.entries()).map(([day, dayCommits]) => (
        <DayGroup
          key={day}
          label={formatDayLabel(day)}
          commits={dayCommits}
          onOpenNote={onOpenNote}
        />
      ))}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div className="flex items-center justify-center" style={{ padding: 12 }}>
          <span className="text-[12px] text-muted-foreground">Loading…</span>
        </div>
      )}
    </>
  )
}

const PAGE_SIZE = 20

export const PulseView = memo(function PulseView({ vaultPath, onOpenNote, sidebarCollapsed, onExpandSidebar }: PulseViewProps) {
  const [commits, setCommits] = useState<PulseCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [skip, setSkip] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Initial load
  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCommits([])
    setSkip(0)
    setHasMore(true)
    try {
      const result = await tauriCall<PulseCommit[]>('get_vault_pulse', { vaultPath, limit: PAGE_SIZE, skip: 0 })
      setCommits(result)
      setHasMore(result.length >= PAGE_SIZE)
      setSkip(result.length)
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Failed to load activity'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [vaultPath])

  // Append next page
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await tauriCall<PulseCommit[]>('get_vault_pulse', { vaultPath, limit: PAGE_SIZE, skip })
      setCommits((prev) => [...prev, ...result])
      setHasMore(result.length >= PAGE_SIZE)
      setSkip((s) => s + result.length)
    } catch {
      // silently fail for pagination — user can scroll up/retry
    } finally {
      setLoadingMore(false)
    }
  }, [vaultPath, skip, loadingMore, hasMore])

  useEffect(() => { loadInitial() }, [loadInitial])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const dayGroups = groupCommitsByDay(commits)

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-background">
      <PulseHeader sidebarCollapsed={sidebarCollapsed} onExpandSidebar={onExpandSidebar} />

      <div className="flex-1 overflow-y-auto">
        <PulseFeed
          commits={commits}
          dayGroups={dayGroups}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onOpenNote={onOpenNote}
          onRetry={loadInitial}
          sentinelRef={sentinelRef}
        />
      </div>
    </div>
  )
})
