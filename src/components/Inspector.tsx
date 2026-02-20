import { useMemo, useCallback } from 'react'
import type { ComponentType, SVGAttributes } from 'react'
import type { VaultEntry, GitCommit } from '../types'
import { cn } from '@/lib/utils'
import {
  SlidersHorizontal, X, Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, FileText, StackSimple,
} from '@phosphor-icons/react'
import { parseFrontmatter, type ParsedFrontmatter } from '../utils/frontmatter'
import { DynamicPropertiesPanel, RELATIONSHIP_KEYS, containsWikilinks } from './DynamicPropertiesPanel'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'

const TYPE_ICON_MAP: Record<string, ComponentType<SVGAttributes<SVGSVGElement>>> = {
  Project: Wrench,
  Experiment: Flask,
  Responsibility: Target,
  Procedure: ArrowsClockwise,
  Person: Users,
  Event: CalendarBlank,
  Topic: Tag,
  Type: StackSimple,
}

function getTypeIcon(isA: string | undefined): ComponentType<SVGAttributes<SVGSVGElement>> {
  return (isA && TYPE_ICON_MAP[isA]) || FileText
}

interface InspectorProps {
  collapsed: boolean
  onToggle: () => void
  entry: VaultEntry | null
  content: string | null
  entries: VaultEntry[]
  allContent: Record<string, string>
  gitHistory: GitCommit[]
  onNavigate: (target: string) => void
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
}

export type FrontmatterValue = string | number | boolean | string[] | null

/** Check if a string is a wikilink */
function isWikilink(value: string): boolean {
  return /^\[\[.*\]\]$/.test(value)
}

/** Extract display name from a wikilink */
function wikilinkDisplay(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  if (pipeIdx !== -1) return inner.slice(pipeIdx + 1)
  const last = inner.split('/').pop() ?? inner
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Extract the target path for navigation from a wikilink ref */
function wikilinkTarget(ref: string): string {
  const inner = ref.replace(/^\[\[|\]\]$/g, '')
  const pipeIdx = inner.indexOf('|')
  return pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner
}

function resolveRefType(ref: string, entries: VaultEntry[]): string | undefined {
  const target = wikilinkTarget(ref)
  const match = entries.find((e) => {
    const stem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
    if (stem === target) return true
    const fileStem = e.filename.replace(/\.md$/, '')
    if (fileStem === target.split('/').pop()) return true
    return false
  })
  return match?.isA
}

function RelationshipGroup({ label, refs, entries, onNavigate }: { label: string; refs: string[]; entries: VaultEntry[]; onNavigate: (target: string) => void }) {
  if (refs.length === 0) return null
  return (
    <div className="mb-2.5">
      <span className="font-mono-overline mb-1 block text-muted-foreground">{label}</span>
      <div className="flex flex-col gap-1">
        {refs.map((ref, idx) => {
          const refType = resolveRefType(ref, entries)
          const color = refType ? getTypeColor(refType) : 'var(--accent-blue)'
          const bgColor = refType ? getTypeLightColor(refType) : 'var(--accent-blue-light)'
          const TypeIcon = getTypeIcon(refType)
          return (
            <button
              key={`${ref}-${idx}`}
              className="flex items-center justify-between gap-2 border-none text-left cursor-pointer hover:opacity-80"
              style={{ background: bgColor, color, borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 500 }}
              onClick={() => onNavigate(wikilinkTarget(ref))}
            >
              <span className="flex-1 truncate">{wikilinkDisplay(ref)}</span>
              <TypeIcon width={14} height={14} className="shrink-0" style={{ color }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DynamicRelationshipsPanel({ frontmatter, entries, onNavigate }: { frontmatter: ParsedFrontmatter; entries: VaultEntry[]; onNavigate: (target: string) => void }) {
  const relationshipEntries = useMemo(() => {
    return Object.entries(frontmatter)
      .filter(([key, value]) => key !== 'Type' && (RELATIONSHIP_KEYS.has(key) || containsWikilinks(value)))
      .map(([key, value]) => {
        const refs: string[] = []
        if (typeof value === 'string' && isWikilink(value)) refs.push(value)
        else if (Array.isArray(value)) value.forEach(v => { if (typeof v === 'string' && isWikilink(v)) refs.push(v) })
        return { key, refs }
      })
      .filter(({ refs }) => refs.length > 0)
  }, [frontmatter])

  return (
    <div>
      {relationshipEntries.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No relationships</p>
      ) : (
        relationshipEntries.map(({ key, refs }) => (
          <RelationshipGroup key={key} label={key} refs={refs} entries={entries} onNavigate={onNavigate} />
        ))
      )}
      <button
        className="mt-2 w-full cursor-not-allowed border border-border bg-transparent text-center text-muted-foreground"
        style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, opacity: 0.6 }}
        disabled title="Coming soon"
      >
        + Link existing
      </button>
    </div>
  )
}

function useBacklinks(entry: VaultEntry | null, entries: VaultEntry[], allContent: Record<string, string>): VaultEntry[] {
  return useMemo(() => {
    if (!entry) return []
    const title = entry.title
    const stem = entry.filename.replace(/\.md$/, '')
    const targets = [title, ...entry.aliases]
    const pathStem = entry.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')

    return entries.filter((e) => {
      if (e.path === entry.path) return false
      const content = allContent[e.path]
      if (!content) return false
      for (const t of targets) {
        if (content.includes(`[[${t}]]`)) return true
      }
      if (content.includes(`[[${stem}]]`)) return true
      if (content.includes(`[[${pathStem}]]`)) return true
      if (content.includes(`[[${pathStem}|`)) return true
      return false
    })
  }, [entry, entries, allContent])
}

function BacklinksPanel({ backlinks, onNavigate }: { backlinks: VaultEntry[]; onNavigate: (target: string) => void }) {
  return (
    <div>
      <h4 className="font-mono-overline mb-2 text-muted-foreground">
        Backlinks {backlinks.length > 0 && <span className="ml-1" style={{ fontWeight: 400 }}>{backlinks.length}</span>}
      </h4>
      {backlinks.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No backlinks</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {backlinks.map((e) => {
            const color = e.isA ? getTypeColor(e.isA) : 'var(--accent-blue)'
            const TypeIcon = getTypeIcon(e.isA ?? undefined)
            return (
              <button
                key={e.path}
                className="flex items-center justify-between gap-2 border-none bg-transparent p-0 py-1 text-left text-[13px] cursor-pointer hover:opacity-80"
                style={{ color }}
                onClick={() => onNavigate(e.title)}
              >
                <span className="flex-1 truncate">{e.title}</span>
                {e.isA && <TypeIcon width={14} height={14} className="shrink-0" style={{ color }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 86400) return 'today'
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1mo ago'
  return `${months}mo ago`
}

function GitHistoryPanel({ commits }: { commits: GitCommit[] }) {
  return (
    <div>
      <h4 className="font-mono-overline mb-2 text-muted-foreground">History</h4>
      {commits.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No revision history</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {commits.map((c) => (
              <div key={c.hash} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="font-mono text-foreground" style={{ fontSize: 11 }}>{c.shortHash}</span>
                  <span className="text-muted-foreground" style={{ fontSize: 10 }}>{formatRelativeDate(c.date)}</span>
                </div>
                <div className="truncate text-xs text-secondary-foreground">{c.message}</div>
              </div>
            ))}
          </div>
          <button className="mt-2.5 cursor-not-allowed border-none bg-transparent p-0 py-1 text-xs text-muted-foreground" disabled>
            View all revisions
          </button>
        </>
      )}
    </div>
  )
}

function EmptyInspector() {
  return (
    <>
      <div>
        <p className="m-0 text-[13px] text-muted-foreground">No note selected</p>
      </div>
      <div>
        <p className="m-0 text-[13px] text-muted-foreground">No relationships</p>
      </div>
      <div>
        <h4 className="font-mono-overline mb-2 text-muted-foreground">Backlinks</h4>
        <p className="m-0 text-[13px] text-muted-foreground">No backlinks</p>
      </div>
      <div>
        <h4 className="font-mono-overline mb-2 text-muted-foreground">History</h4>
        <p className="m-0 text-[13px] text-muted-foreground">No revision history</p>
      </div>
    </>
  )
}

export function Inspector({
  collapsed, onToggle, entry, content, entries, allContent, gitHistory, onNavigate,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty,
}: InspectorProps) {
  const backlinks = useBacklinks(entry, entries, allContent)
  const frontmatter = useMemo(() => parseFrontmatter(content), [content])

  const handleUpdateProperty = useCallback((key: string, value: FrontmatterValue) => {
    if (entry && onUpdateFrontmatter) onUpdateFrontmatter(entry.path, key, value)
  }, [entry, onUpdateFrontmatter])

  const handleDeleteProperty = useCallback((key: string) => {
    if (entry && onDeleteProperty) onDeleteProperty(entry.path, key)
  }, [entry, onDeleteProperty])

  const handleAddProperty = useCallback((key: string, value: FrontmatterValue) => {
    if (entry && onAddProperty) onAddProperty(entry.path, key, value)
  }, [entry, onAddProperty])

  return (
    <aside className={cn(
      "flex flex-col overflow-y-auto border-l border-border bg-background text-foreground transition-[width] duration-200",
      collapsed && "!w-10 !min-w-10"
    )}>
      <div className="flex items-center border-b border-border" style={{ height: 45, padding: '0 12px', gap: 8 }} data-tauri-drag-region>
        {collapsed ? (
          <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <SlidersHorizontal size={16} />
          </button>
        ) : (
          <>
            <SlidersHorizontal size={16} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>Properties</span>
            <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-4 p-3">
          {entry ? (
            <>
              <DynamicPropertiesPanel
                entry={entry} content={content} frontmatter={frontmatter}
                onUpdateProperty={onUpdateFrontmatter ? handleUpdateProperty : undefined}
                onDeleteProperty={onDeleteProperty ? handleDeleteProperty : undefined}
                onAddProperty={onAddProperty ? handleAddProperty : undefined}
                onNavigate={onNavigate}
              />
              <DynamicRelationshipsPanel frontmatter={frontmatter} entries={entries} onNavigate={onNavigate} />
              <BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />
              <GitHistoryPanel commits={gitHistory} />
            </>
          ) : (
            <EmptyInspector />
          )}
        </div>
      )}
    </aside>
  )
}
