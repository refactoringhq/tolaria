import { useMemo, useCallback } from 'react'
import { useDragRegion } from '../hooks/useDragRegion'
import type { VaultEntry, GitCommit } from '../types'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, X, Sparkle, WarningCircle, PencilSimple } from '@phosphor-icons/react'
import { Separator } from './ui/separator'
import { parseFrontmatter, detectFrontmatterState } from '../utils/frontmatter'
import { DynamicPropertiesPanel } from './DynamicPropertiesPanel'
import { DynamicRelationshipsPanel, BacklinksPanel, ReferencedByPanel, GitHistoryPanel, InstancesPanel } from './InspectorPanels'
import { wikilinkTarget } from '../utils/wikilink'
import type { ReferencedByItem, BacklinkItem } from './InspectorPanels'

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
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onInitializeProperties?: (path: string) => void
  onToggleRawEditor?: () => void
}

function targetMatchesEntry(target: string, entryPath: string, matchTargets: Set<string>): boolean {
  if (matchTargets.has(target)) return true
  const lastSegment = target.split('/').pop() ?? ''
  if (matchTargets.has(lastSegment)) return true
  // Path-suffix match: "projects/alpha" matches entry path ending with "/projects/alpha.md"
  if (target.includes('/') && entryPath.toLowerCase().endsWith('/' + target.toLowerCase() + '.md')) return true
  return false
}

function useBacklinks(
  entry: VaultEntry | null,
  entries: VaultEntry[],
  referencedBy: ReferencedByItem[],
): BacklinkItem[] {
  return useMemo(() => {
    if (!entry) return []
    const matchTargets = new Set([
      entry.title, ...entry.aliases,
      entry.filename.replace(/\.md$/, ''),
    ])

    const referencedByPaths = new Set(referencedBy.map((item) => item.entry.path))

    return entries
      .filter((e) => {
        if (e.path === entry.path) return false
        if (referencedByPaths.has(e.path)) return false
        return e.outgoingLinks.some((target) => targetMatchesEntry(target, entry.path, matchTargets))
      })
      .map((e) => ({
        entry: e,
        context: null,
      }))
  }, [entry, entries, referencedBy])
}

function refsMatchTargets(refs: string[], targets: Set<string>): boolean {
  return refs.some((ref) => {
    const target = wikilinkTarget(ref)
    return targets.has(target) || targets.has(target.split('/').pop() ?? '')
  })
}

function useReferencedBy(entry: VaultEntry | null, entries: VaultEntry[]): ReferencedByItem[] {
  return useMemo(() => {
    if (!entry) return []

    const filenameStem = entry.filename.replace(/\.md$/, '')
    const matchTargets = new Set([filenameStem, entry.title, ...entry.aliases])

    const results: ReferencedByItem[] = []

    for (const other of entries) {
      if (other.path === entry.path) continue
      for (const [key, refs] of Object.entries(other.relationships)) {
        if (key !== 'Type' && refsMatchTargets(refs, matchTargets)) {
          results.push({ entry: other, viaKey: key })
        }
      }
    }

    return results
  }, [entry, entries])
}

function InspectorHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { onMouseDown } = useDragRegion()
  return (
    <div className="flex shrink-0 items-center border-b border-border" style={{ height: 52, padding: '6px 12px', gap: 8, cursor: 'default' }} onMouseDown={onMouseDown}>
      {collapsed ? (
        <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle} title="Properties (⌘⇧I)">
          <SlidersHorizontal size={16} />
        </button>
      ) : (
        <>
          <SlidersHorizontal size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>Properties</span>
          <button className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground" onClick={onToggle} title="Close Properties (⌘⇧I)">
            <X size={16} />
          </button>
        </>
      )}
    </div>
  )
}

function EmptyInspector() {
  return (
    <div><p className="m-0 text-[13px] text-muted-foreground">No note selected</p></div>
  )
}

function InitializePropertiesPrompt({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6">
      <Sparkle size={24} className="text-muted-foreground" />
      <p className="m-0 text-center text-[13px] text-muted-foreground">This note has no properties yet</p>
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        onClick={onClick}
      >
        Initialize properties
      </button>
    </div>
  )
}

function InvalidFrontmatterNotice({ onFix }: { onFix: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-6">
      <WarningCircle size={24} className="text-destructive" />
      <p className="m-0 text-center text-[13px] text-muted-foreground">Invalid properties</p>
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        onClick={onFix}
      >
        <PencilSimple size={14} />
        Fix in editor
      </button>
    </div>
  )
}

export function Inspector({
  collapsed, onToggle, entry, content, entries, gitHistory, onNavigate,
  onViewCommitDiff, onUpdateFrontmatter, onDeleteProperty, onAddProperty, onCreateAndOpenNote,
  onInitializeProperties, onToggleRawEditor,
}: InspectorProps) {
  const referencedBy = useReferencedBy(entry, entries)
  const backlinks = useBacklinks(entry, entries, referencedBy)
  const frontmatter = useMemo(() => parseFrontmatter(content), [content])
  const fmState = useMemo(() => detectFrontmatterState(content), [content])
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
    <aside className={cn("flex flex-1 flex-col overflow-hidden border-l border-border bg-background text-foreground transition-[width] duration-200", collapsed && "!w-10 !min-w-10")}>
      <InspectorHeader collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {entry ? (
            <>
              {fmState === 'valid' ? (
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
                    onCreateAndOpenNote={onCreateAndOpenNote}
                  />
                  <InstancesPanel entry={entry} entries={entries} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
                  <ReferencedByPanel items={referencedBy} typeEntryMap={typeEntryMap} onNavigate={onNavigate} />
                </>
              ) : fmState === 'invalid' ? (
                onToggleRawEditor && <InvalidFrontmatterNotice onFix={onToggleRawEditor} />
              ) : (
                onInitializeProperties && <InitializePropertiesPrompt onClick={() => onInitializeProperties(entry.path)} />
              )}
              {backlinks.length > 0 && <Separator />}
              <BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />
              {gitHistory.length > 0 && <Separator />}
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
