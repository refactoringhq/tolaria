import { useMemo, useCallback, useState, useRef } from 'react'
import type { ComponentType, SVGAttributes } from 'react'
import { wikilinkTarget, wikilinkDisplay } from '../utils/wikilink'
import type { VaultEntry, GitCommit } from '../types'
import { Trash, X, Plus } from '@phosphor-icons/react'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { RELATIONSHIP_KEYS, containsWikilinks } from './DynamicPropertiesPanel'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { getTypeIcon } from './NoteItem'
import { findEntryByTarget } from '../utils/wikilinkColors'
import type { FrontmatterValue } from './Inspector'
import { NoteAutocomplete } from './NoteAutocomplete'

function isWikilink(value: string): boolean {
  return /^\[\[.*\]\]$/.test(value)
}

function resolveRef(ref: string, entries: VaultEntry[]): VaultEntry | undefined {
  const target = wikilinkTarget(ref)
  const byTitle = findEntryByTarget(entries, target)
  if (byTitle) return byTitle
  const lastSegment = target.split('/').pop()
  return entries.find((e) => {
    const stem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
    if (stem === target) return true
    return e.filename.replace(/\.md$/, '') === lastSegment
  })
}

function StatusSuffix({ isArchived, isTrashed }: { isArchived: boolean; isTrashed: boolean }) {
  if (isTrashed) return <span style={{ fontSize: 10, opacity: 0.8 }}>(trashed)</span>
  if (isArchived) return <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>(archived)</span>
  return null
}

function LinkButton({ label, typeColor, bgColor, isArchived, isTrashed, onClick, onRemove, title, TypeIcon }: {
  label: string
  typeColor: string
  bgColor?: string
  isArchived: boolean
  isTrashed: boolean
  onClick: () => void
  onRemove?: () => void
  title?: string
  TypeIcon: ComponentType<SVGAttributes<SVGSVGElement>>
}) {
  const isDimmed = isArchived || isTrashed
  const color = isDimmed ? 'var(--muted-foreground)' : typeColor
  return (
    <div className="group/link flex items-center gap-1">
      <button
        className="flex flex-1 items-center justify-between gap-2 border-none text-left cursor-pointer hover:opacity-80 min-w-0"
        style={{
          background: isDimmed ? 'var(--muted)' : (bgColor ?? 'transparent'),
          color, borderRadius: 6, padding: bgColor ? '6px 10px' : '4px 0',
          fontSize: 12, fontWeight: 500, opacity: isDimmed ? 0.7 : 1,
        }}
        onClick={onClick}
        title={title}
      >
        <span className="flex items-center gap-1 flex-1 truncate">
          {isTrashed && <Trash size={12} className="shrink-0" />}
          {label}
          <StatusSuffix isArchived={isArchived} isTrashed={isTrashed} />
        </span>
        <TypeIcon width={14} height={14} className="shrink-0" style={{ color }} />
      </button>
      {onRemove && (
        <button
          className="shrink-0 border-none bg-transparent p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/link:opacity-100"
          onClick={onRemove}
          title="Remove from relation"
          data-testid="remove-relation-ref"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function entryStatusTitle(entry: VaultEntry | undefined): string | undefined {
  if (entry?.trashed) return 'Trashed'
  if (entry?.archived) return 'Archived'
  return undefined
}

function resolveRefProps(ref: string, entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>) {
  const resolved = resolveRef(ref, entries)
  const refType = resolved?.isA ?? null
  const te = typeEntryMap[refType ?? '']
  return {
    label: wikilinkDisplay(ref),
    typeColor: getTypeColor(refType, te?.color),
    bgColor: getTypeLightColor(refType, te?.color),
    isArchived: resolved?.archived ?? false,
    isTrashed: resolved?.trashed ?? false,
    target: wikilinkTarget(ref),
    title: entryStatusTitle(resolved),
    TypeIcon: getTypeIcon(refType, te?.icon),
  }
}

function InlineAddNote({ entries, typeEntryMap, onAdd }: {
  entries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  onAdd: (noteTitle: string) => void
}) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState('')

  const handleSubmit = useCallback((title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setQuery('')
    setActive(false)
  }, [onAdd])

  if (!active) {
    return (
      <button
        className="mt-1 flex items-center gap-1 border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground"
        style={{ fontSize: 11 }}
        onClick={() => setActive(true)}
        data-testid="add-relation-ref"
      >
        <Plus size={10} />
        <span>Add</span>
      </button>
    )
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <div className="flex-1" style={{ minWidth: 0 }}>
        <NoteAutocomplete
          entries={entries}
          typeEntryMap={typeEntryMap}
          value={query}
          onChange={setQuery}
          onSelect={handleSubmit}
          onEscape={() => { setQuery(''); setActive(false) }}
          placeholder="Note title"
          autoFocus
          testId="add-relation-ref-input"
        />
      </div>
      <button
        className="shrink-0 border-none bg-transparent p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() => handleSubmit(query)}
        disabled={!query.trim()}
      >
        <Plus size={12} />
      </button>
      <button
        className="shrink-0 border-none bg-transparent p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() => { setQuery(''); setActive(false) }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

function RelationshipGroup({ label, refs, entries, typeEntryMap, onNavigate, onRemoveRef, onAddRef }: {
  label: string; refs: string[]; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
  onRemoveRef?: (ref: string) => void; onAddRef?: (noteTitle: string) => void
}) {
  if (refs.length === 0) return null
  return (
    <div className="mb-2.5">
      <span className="font-mono-overline mb-1 block text-muted-foreground">{label}</span>
      <div className="flex flex-col gap-1">
        {refs.map((ref, idx) => {
          const props = resolveRefProps(ref, entries, typeEntryMap)
          return (
            <LinkButton
              key={`${ref}-${idx}`}
              {...props}
              onClick={() => onNavigate(props.target)}
              onRemove={onRemoveRef ? () => onRemoveRef(ref) : undefined}
            />
          )
        })}
      </div>
      {onAddRef && <InlineAddNote entries={entries} typeEntryMap={typeEntryMap} onAdd={onAddRef} />}
    </div>
  )
}

function extractRelationshipRefs(frontmatter: ParsedFrontmatter): { key: string; refs: string[] }[] {
  return Object.entries(frontmatter)
    .filter(([key, value]) => key !== 'Type' && (RELATIONSHIP_KEYS.has(key) || containsWikilinks(value)))
    .map(([key, value]) => {
      const refs: string[] = []
      if (typeof value === 'string' && isWikilink(value)) refs.push(value)
      else if (Array.isArray(value)) value.forEach(v => { if (typeof v === 'string' && isWikilink(v)) refs.push(v) })
      return { key, refs }
    })
    .filter(({ refs }) => refs.length > 0)
}

function AddRelationshipForm({ entries, typeEntryMap, onAddProperty }: {
  entries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  onAddProperty: (key: string, value: FrontmatterValue) => void
}) {
  const [relKey, setRelKey] = useState('')
  const [relTarget, setRelTarget] = useState('')
  const [showForm, setShowForm] = useState(false)
  const keyInputRef = useRef<HTMLInputElement>(null)

  const submitForm = useCallback((targetOverride?: string) => {
    const key = relKey.trim()
    const target = (targetOverride ?? relTarget).trim()
    if (!key || !target) return
    onAddProperty(key, `[[${target}]]`)
    setRelKey(''); setRelTarget(''); setShowForm(false)
  }, [relKey, relTarget, onAddProperty])

  const resetForm = () => { setShowForm(false); setRelKey(''); setRelTarget('') }

  if (!showForm) {
    return (
      <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }} onClick={() => { setShowForm(true); setTimeout(() => keyInputRef.current?.focus(), 0) }}>+ Link existing</button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <input
        ref={keyInputRef}
        autoFocus
        className="w-full border border-border bg-transparent px-2 py-1 text-xs text-foreground"
        style={{ borderRadius: 4, outline: 'none' }}
        placeholder="Relationship name"
        value={relKey}
        onChange={e => setRelKey(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') resetForm() }}
      />
      <NoteAutocomplete
        entries={entries}
        typeEntryMap={typeEntryMap}
        value={relTarget}
        onChange={setRelTarget}
        onSelect={(title) => submitForm(title)}
        onEscape={resetForm}
        placeholder="Note title"
        testId="add-relationship-note-input"
      />
      <div className="flex gap-1.5">
        <button className="flex-1 border border-border bg-transparent text-xs text-foreground" style={{ borderRadius: 4, padding: '4px 0' }} onClick={() => submitForm()} disabled={!relKey.trim() || !relTarget.trim()}>Add</button>
        <button className="border border-border bg-transparent text-xs text-muted-foreground" style={{ borderRadius: 4, padding: '4px 8px' }} onClick={resetForm}>Cancel</button>
      </div>
    </div>
  )
}

function removeRefFromGroup(groups: { key: string; refs: string[] }[], key: string, refToRemove: string, onUpdate: (k: string, v: FrontmatterValue) => void, onDelete: (k: string) => void) {
  const group = groups.find(g => g.key === key)
  if (!group) return
  const remaining = group.refs.filter(r => r !== refToRemove)
  if (remaining.length === 0) onDelete(key)
  else if (remaining.length === 1) onUpdate(key, remaining[0])
  else onUpdate(key, remaining)
}

function addRefToGroup(groups: { key: string; refs: string[] }[], key: string, noteTitle: string, onUpdate: (k: string, v: FrontmatterValue) => void) {
  const existing = groups.find(g => g.key === key)?.refs ?? []
  const newRef = `[[${noteTitle}]]`
  if (existing.includes(newRef)) return
  const updated = [...existing, newRef]
  if (updated.length === 1) onUpdate(key, updated[0])
  else onUpdate(key, updated)
}

export function DynamicRelationshipsPanel({ frontmatter, entries, typeEntryMap, onNavigate, onAddProperty, onUpdateProperty, onDeleteProperty }: {
  frontmatter: ParsedFrontmatter; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
}) {
  const relationshipEntries = useMemo(() => extractRelationshipRefs(frontmatter), [frontmatter])

  const handleRemoveRef = useCallback((key: string, refToRemove: string) => {
    if (!onUpdateProperty || !onDeleteProperty) return
    removeRefFromGroup(relationshipEntries, key, refToRemove, onUpdateProperty, onDeleteProperty)
  }, [relationshipEntries, onUpdateProperty, onDeleteProperty])

  const handleAddRef = useCallback((key: string, noteTitle: string) => {
    if (!onUpdateProperty) return
    addRefToGroup(relationshipEntries, key, noteTitle, onUpdateProperty)
  }, [relationshipEntries, onUpdateProperty])

  const canEdit = !!onUpdateProperty && !!onDeleteProperty

  return (
    <div>
      {relationshipEntries.length === 0
        ? <p className="m-0 text-[13px] text-muted-foreground">No relationships</p>
        : relationshipEntries.map(({ key, refs }) => (
          <RelationshipGroup
            key={key} label={key} refs={refs} entries={entries} typeEntryMap={typeEntryMap} onNavigate={onNavigate}
            onRemoveRef={canEdit ? (ref) => handleRemoveRef(key, ref) : undefined}
            onAddRef={canEdit ? (noteTitle) => handleAddRef(key, noteTitle) : undefined}
          />
        ))
      }
      {onAddProperty
        ? <AddRelationshipForm entries={entries} typeEntryMap={typeEntryMap} onAddProperty={onAddProperty} />
        : <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, opacity: 0.5, cursor: 'not-allowed' }} disabled>+ Link existing</button>
      }
    </div>
  )
}

export function BacklinksPanel({ backlinks, typeEntryMap, onNavigate }: { backlinks: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>; onNavigate: (target: string) => void }) {
  return (
    <div>
      <h4 className="font-mono-overline mb-2 text-muted-foreground">
        Backlinks {backlinks.length > 0 && <span className="ml-1" style={{ fontWeight: 400 }}>{backlinks.length}</span>}
      </h4>
      {backlinks.length === 0
        ? <p className="m-0 text-[13px] text-muted-foreground">No backlinks</p>
        : (
          <div className="flex flex-col gap-0.5">
            {backlinks.map((e) => {
              const te = typeEntryMap[e.isA ?? '']
              return (
                <LinkButton key={e.path} label={e.title} typeColor={getTypeColor(e.isA, te?.color)} isArchived={e.archived} isTrashed={e.trashed} onClick={() => onNavigate(e.title)} title={e.trashed ? 'Trashed' : e.archived ? 'Archived' : undefined} TypeIcon={getTypeIcon(e.isA, te?.icon)} />
              )
            })}
          </div>
        )
      }
    </div>
  )
}

export interface ReferencedByItem {
  entry: VaultEntry
  viaKey: string
}

export function ReferencedByPanel({ items, typeEntryMap, onNavigate }: {
  items: ReferencedByItem[]
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, VaultEntry[]>()
    for (const item of items) {
      const existing = map.get(item.viaKey)
      if (existing) existing.push(item.entry)
      else map.set(item.viaKey, [item.entry])
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div>
      <h4 className="font-mono-overline mb-2 text-muted-foreground">
        Referenced by {items.length > 0 && <span className="ml-1" style={{ fontWeight: 400 }}>{items.length}</span>}
      </h4>
      {items.length === 0
        ? <p className="m-0 text-[13px] text-muted-foreground">No references</p>
        : (
          <div className="flex flex-col gap-2.5">
            {grouped.map(([viaKey, groupEntries]) => (
              <div key={viaKey}>
                <span className="mb-1 block font-mono text-muted-foreground" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: 0.7 }}>
                  via {viaKey}
                </span>
                <div className="flex flex-col gap-0.5">
                  {groupEntries.map((e) => {
                    const te = typeEntryMap[e.isA ?? '']
                    return (
                      <LinkButton
                        key={e.path}
                        label={e.title}
                        typeColor={getTypeColor(e.isA, te?.color)}
                        isArchived={e.archived}
                        isTrashed={e.trashed}
                        onClick={() => onNavigate(e.title)}
                        title={e.trashed ? 'Trashed' : e.archived ? 'Archived' : undefined}
                        TypeIcon={getTypeIcon(e.isA, te?.icon)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

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
