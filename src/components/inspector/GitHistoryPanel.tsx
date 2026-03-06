import type { GitCommit } from '../../types'

function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const days = Math.floor((now - timestamp) / 86400)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}

export function GitHistoryPanel({ commits, onViewCommitDiff }: { commits: GitCommit[]; onViewCommitDiff?: (commitHash: string) => void }) {
  return (
    <div>
      <h4 className="font-mono-overline mb-2 text-muted-foreground">History</h4>
      {commits.length === 0
        ? <p className="m-0 text-[13px] text-muted-foreground">No revision history</p>
        : (
          <div className="flex flex-col gap-2.5">
            {commits.map((c) => (
              <div key={c.hash} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                <div className="mb-0.5 flex items-center justify-between">
                  <button className="border-none bg-transparent p-0 font-mono text-primary cursor-pointer hover:underline" style={{ fontSize: 11 }} onClick={() => onViewCommitDiff?.(c.hash)} title={`View diff for ${c.shortHash}`}>{c.shortHash}</button>
                  <span className="text-muted-foreground" style={{ fontSize: 10 }}>{formatRelativeDate(c.date)}</span>
                </div>
                <div className="truncate text-xs text-secondary-foreground">{c.message}</div>
                {c.author && <div className="truncate text-muted-foreground" style={{ fontSize: 10, marginTop: 1 }}>{c.author}</div>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
