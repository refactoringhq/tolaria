import { useMemo, useCallback } from 'react'
import { useDragRegion } from '../hooks/useDragRegion'
import type { VaultEntry, GitCommit } from '../types'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, X } from '@phosphor-icons/react'
import { parseFrontmatter } from '../utils/frontmatter'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import { DynamicRelationshipsPanel, BacklinksPanel, ReferencedByPanel, GitHistoryPanel } from './InspectorPanels'
import { wikilinkTarget } from '../utils/wikilink'
import type { ReferencedByItem } from './InspectorPanels'

export type FrontmatterValue = string | number | boolean | string[] | null

interface InspectorProps {
  collapsed: boolean
  onToggle: () => void
  entry: VaultEntry | null
  content: string | null
  entries: VaultEntry[]
  gitHistory: GitCommit[]
  onNavigate: (target: string) => void
  onViewCommitDiff?: (commitHash: string) => void
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
}

function useBacklinks(entry: VaultEntry | null, entries: VaultEntry[], referencedBy: ReferencedByItem[]): VaultEntry[] {
  return useMemo(() => {
    if (!entry) return []
    const matchTargets = new Set([
      entry.title, ...entry.aliases,
      entry.filename.replace(/\.md$/, ''),
      entry.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, ''),
    ])

    const referencedByPaths = new Set(referencedBy.map((item) => item.entry.path))

    return entries.filter((e) => {
      if (e.path === entry.path) return false
      if (referencedByPaths.has(e.path)) return false
      return e.outgoingLinks.some((target) =>
        matchTargets.has(target) || matchTargets.has(target.split('/').pop() ?? '')
      )
    })
  }, [entry, entries, referencedBy])
}

function useReferencedBy(entry: VaultEntry | null, entries: VaultEntry[]): ReferencedByItem[] {
  return useMemo(() => {
    if (!entry) return []

    const pathStem = entry.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
    const filenameStem = entry.filename.replace(/\.md$/, '')
    const matchTargets = new Set([pathStem, filenameStem, entry.title, ...entry.aliases])

    const results: ReferencedByItem[] = []

    for (const other of entries) {
      if (other.path === entry.path) continue

      for (const [key, refs] of Object.entries(other.relationships)) {
        if (key === 'Type') continue
        for (const ref of refs) {
          const target = wikilinkTarget(ref)
          if (matchTargets.has(target) || matchTargets.has(target.split('/').pop() ?? '')) {
            results.push({ entry: other, viaKey: key })
            break
          }
        }
      }
    }

    return results
  }, [entry, entries])
}

function InspectorHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { onMouseDown } = useDragRegion()
  return (
    <div className="flex items-center border-b border-border" style={{ height: 52, background: 'var(--bg-titlebar)', padding: '0 12px', gap: 8, cursor: 'default' }} onMouseDown={onMouseDown} data-tauri-drag-region>
      {collapsed ? (
        <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle}>
          <SlidersHorizontal size={16} />
        </button>
      ) : (
        <>
          <SlidersHorizontal size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>Properties</span>
          <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle}>
            <X size={16} />
          </button>
        </>
      )}
    </div>
  )
}

function EmptyInspector() {
  return (
    <>
      <div><p className="m-0 text-[13px] text-muted-foreground">No note selected</p></div>
      <div><p className="m-0 text-[13px] text-muted-foreground">No relationships</p></div>
      <div>
        <h4 className="font-mono-overline mb-2 text-muted-foreground">Referenced by</h4>
        <p className="m-0 text-[13px] text-muted-foreground">No references</p>
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
  collapsed, onToggle, entry, content, entries, gitHistory, onNavigate,
  onViewCommitDiff, onUpdateFrontmatter, onDeleteProperty, onAddProperty,
}: InspectorProps) {
  const referencedBy = useReferencedBy(entry, entries)
  const backlinks = useBacklinks(entry, entries, referencedBy)
  const frontmatter = useMemo(() => parseFrontmatter(content), [content])
  const typeEntryMap = useMemo(() => {
    const map: Record<string, VaultEntry> = {}
    for (const e of entries) { if (e.isA === 'Type') map[e.title] = e }
    return map
  }, [entries])

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
    <aside className={cn("flex flex-1 flex-col overflow-y-auto border-l border-border bg-background text-foreground transition-[width] duration-200", collapsed && "!w-10 !min-w-10")}>
      <InspectorHeader collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && (
        <div className="flex flex-col gap-4 p-3">
          {entry ? (
            <>
              <DynamicPropertiesPanel
                entry={entry} content={content} frontmatter={frontmatter}
                entries={entries}
                onUpdateProperty={onUpdateFrontmatter ? handleUpdateProperty : undefined}
                onDeleteProperty={onDeleteProperty ? handleDeleteProperty : undefined}
                onAddProperty={onAddProperty ? handleAddProperty : undefined}
                onNavigate={onNavigate}
              />
              <DynamicRelationshipsPanel
                frontmatter={frontmatter} entries={entries} typeEntryMap={typeEntryMap} onNavigate={onNavigate}
                onAddProperty={onAddProperty ? handleAddProperty : undefined}
                onUpdateProperty={onUpdateFrontmatter ? handleUpdateProperty : undefined}
                onDeleteProperty={onDeleteProperty ? handleDeleteProperty : undefined}
              />
              <ReferencedByPanel items={referencedBy} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
              <BacklinksPanel backlinks={backlinks} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
              <GitHistoryPanel commits={gitHistory} onViewCommitDiff={onViewCommitDiff} />
            </>
          ) : (
            <EmptyInspector />
          )}
        </div>
      )}
    </aside>
  )
}
