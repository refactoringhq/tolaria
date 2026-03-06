import { useMemo, useCallback, useState, useRef } from 'react'
import type { VaultEntry } from '../../types'
import { X } from '@phosphor-icons/react'
import type { ParsedFrontmatter } from '../../utils/frontmatter'
import { RELATIONSHIP_KEYS, containsWikilinks } from '../DynamicPropertiesPanel'
import type { FrontmatterValue } from '../Inspector'
import { NoteSearchList } from '../NoteSearchList'
import { useNoteSearch } from '../../hooks/useNoteSearch'
import { isWikilink, resolveRefProps } from './shared'
import { LinkButton } from './LinkButton'

function SearchDropdown({ search, onSelect }: {
  search: ReturnType<typeof useNoteSearch>
  onSelect: (title: string) => void
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border border-border bg-popover shadow-md">
      <NoteSearchList
        items={search.results}
        selectedIndex={search.selectedIndex}
        getItemKey={(item) => item.entry.path}
        onItemClick={(item) => onSelect(item.entry.title)}
        onItemHover={(i) => search.setSelectedIndex(i)}
        className="max-h-[160px] overflow-y-auto"
      />
    </div>
  )
}

function InlineAddNote({ entries, onAdd }: {
  entries: VaultEntry[]
  onAdd: (noteTitle: string) => void
}) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useNoteSearch(entries, query, 8)

  const selectAndClose = useCallback((title: string) => {
    onAdd(title)
    setQuery('')
    setActive(false)
  }, [onAdd])

  const handleConfirm = useCallback(() => {
    const title = search.selectedEntry?.title ?? query.trim()
    if (title) selectAndClose(title)
  }, [search.selectedEntry, query, selectAndClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    search.handleKeyDown(e)
    if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
    else if (e.key === 'Escape') { setQuery(''); setActive(false) }
  }, [search, handleConfirm])

  if (!active) {
    return (
      <button
        className="mt-1 w-full border border-dashed border-border bg-transparent text-left text-muted-foreground cursor-pointer hover:border-foreground hover:text-foreground"
        style={{ borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
        onClick={() => setActive(true)}
        data-testid="add-relation-ref"
      >
        Add
      </button>
    )
  }

  return (
    <div className="relative mt-1">
      <div className="group/add relative flex items-center">
        <input
          ref={inputRef}
          autoFocus
          className="w-full border border-border bg-transparent text-foreground"
          style={{ borderRadius: 6, outline: 'none', minWidth: 0, padding: '6px 10px', fontSize: 12 }}
          placeholder="Note title"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="add-relation-ref-input"
        />
        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 border-none bg-transparent p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/add:opacity-100"
          onClick={() => { setQuery(''); setActive(false) }}
        >
          <X size={12} />
        </button>
      </div>
      {query.trim() && search.results.length > 0 && (
        <SearchDropdown search={search} onSelect={selectAndClose} />
      )}
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
      {onAddRef && <InlineAddNote entries={entries} onAdd={onAddRef} />}
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

function NoteTargetInput({ entries, value, onChange, onSubmit, onCancel }: {
  entries: VaultEntry[]
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  onCancel?: () => void
}) {
  const [focused, setFocused] = useState(false)
  const search = useNoteSearch(entries, value, 8)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    search.handleKeyDown(e)
    if (e.key === 'Enter') {
      e.preventDefault()
      if (search.selectedEntry) { onChange(search.selectedEntry.title); setFocused(false) }
      else onSubmit?.()
    } else if (e.key === 'Escape') { onCancel?.() }
  }, [search, onChange, onSubmit, onCancel])

  const showDropdown = focused && value.trim() && search.results.length > 0

  return (
    <div className="relative">
      <input
        className="w-full border border-border bg-transparent px-2 py-1 text-xs text-foreground"
        style={{ borderRadius: 4, outline: 'none' }}
        placeholder="Note title"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <SearchDropdown search={search} onSelect={(title) => { onChange(title); setFocused(false) }} />
      )}
    </div>
  )
}

function AddRelationshipForm({ entries, onAddProperty }: {
  entries: VaultEntry[]
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

  const resetForm = useCallback(() => {
    setShowForm(false); setRelKey(''); setRelTarget('')
  }, [])

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
        onKeyDown={e => { if (e.key === 'Enter') submitForm(); else if (e.key === 'Escape') resetForm() }}
      />
      <NoteTargetInput entries={entries} value={relTarget} onChange={setRelTarget} onSubmit={submitForm} onCancel={resetForm} />
      <div className="flex gap-1.5">
        <button className="flex-1 border border-border bg-transparent text-xs text-foreground" style={{ borderRadius: 4, padding: '4px 0' }} onClick={() => submitForm()} disabled={!relKey.trim() || !relTarget.trim()}>Add</button>
        <button className="border border-border bg-transparent text-xs text-muted-foreground" style={{ borderRadius: 4, padding: '4px 8px' }} onClick={resetForm}>Cancel</button>
      </div>
    </div>
  )
}

function updateRefsForRemoval(refs: string[], refToRemove: string): FrontmatterValue | null {
  const remaining = refs.filter(r => r !== refToRemove)
  if (remaining.length === 0) return null
  return remaining.length === 1 ? remaining[0] : remaining
}

function updateRefsForAddition(refs: string[], noteTitle: string): FrontmatterValue | false {
  const newRef = `[[${noteTitle}]]`
  if (refs.includes(newRef)) return false
  const updated = [...refs, newRef]
  return updated.length === 1 ? updated[0] : updated
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
    const group = relationshipEntries.find(g => g.key === key)
    if (!group) return
    const result = updateRefsForRemoval(group.refs, refToRemove)
    if (result === null) onDeleteProperty(key)
    else onUpdateProperty(key, result)
  }, [relationshipEntries, onUpdateProperty, onDeleteProperty])

  const handleAddRef = useCallback((key: string, noteTitle: string) => {
    if (!onUpdateProperty) return
    const existing = relationshipEntries.find(g => g.key === key)?.refs ?? []
    const result = updateRefsForAddition(existing, noteTitle)
    if (result !== false) onUpdateProperty(key, result)
  }, [relationshipEntries, onUpdateProperty])

  const canEdit = !!onUpdateProperty && !!onDeleteProperty

  return (
    <div>
      {relationshipEntries.map(({ key, refs }) => (
        <RelationshipGroup
          key={key} label={key} refs={refs} entries={entries} typeEntryMap={typeEntryMap} onNavigate={onNavigate}
          onRemoveRef={canEdit ? (ref) => handleRemoveRef(key, ref) : undefined}
          onAddRef={canEdit ? (noteTitle) => handleAddRef(key, noteTitle) : undefined}
        />
      ))}
      {onAddProperty
        ? <AddRelationshipForm entries={entries} onAddProperty={onAddProperty} />
        : <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, opacity: 0.5, cursor: 'not-allowed' }} disabled>+ Link existing</button>
      }
    </div>
  )
}
