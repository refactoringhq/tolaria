import { useMemo, useCallback, useState, useRef } from 'react'
import type { VaultEntry } from '../../types'
import { Plus, X } from '@phosphor-icons/react'
import type { ParsedFrontmatter } from '../../utils/frontmatter'
import { containsWikilinks } from '../DynamicPropertiesPanel'
import type { FrontmatterValue } from '../Inspector'
import { NoteSearchList } from '../NoteSearchList'
import { useNoteSearch } from '../../hooks/useNoteSearch'
import { resolveEntry } from '../../utils/wikilink'
import { isWikilink, resolveRefProps } from './shared'
import { LinkButton } from './LinkButton'

/** Check whether any entry resolves for the given title (exact match via wikilink resolution). */
function hasExactTitleMatch(entries: VaultEntry[], title: string): boolean {
  return resolveEntry(entries, title) !== undefined
}

/** Shared keyboard navigation for search dropdowns with an optional "create" item. */
function useSearchKeyboard(
  search: ReturnType<typeof useNoteSearch>,
  totalItems: number,
  onConfirm: () => void,
  onEscape: () => void,
) {
  return useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      search.setSelectedIndex((i: number) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      search.setSelectedIndex((i: number) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
    } else if (e.key === 'Escape') {
      onEscape()
    }
  }, [search, totalItems, onConfirm, onEscape])
}

/** Wraps the create-and-open-note pattern: calls the async creator, then defers a side-effect to the next tick. */
function useCreateAndOpen(
  onCreateAndOpenNote: ((title: string) => Promise<boolean>) | undefined,
  afterCreate: (title: string) => void,
  onDone: () => void,
) {
  return useCallback(async (title: string) => {
    if (!onCreateAndOpenNote || !title) return
    const ok = await onCreateAndOpenNote(title)
    if (!ok) return
    // Defer frontmatter update to next tick to avoid radix-ui
    // infinite setState loop from overlapping render batches
    setTimeout(() => afterCreate(title), 0)
    onDone()
  }, [onCreateAndOpenNote, afterCreate, onDone])
}

/** Derives create-option state from search results and entries. */
function useCreateOption(
  entries: VaultEntry[],
  trimmedQuery: string,
  resultCount: number,
  hasCreator: boolean,
) {
  const showCreate = hasCreator && trimmedQuery.length > 0 && !hasExactTitleMatch(entries, trimmedQuery)
  return { showCreate, createIndex: resultCount, totalItems: resultCount + (showCreate ? 1 : 0) }
}

function CreateAndOpenOption({ title, selected, onClick, onHover }: {
  title: string
  selected: boolean
  onClick: () => void
  onHover: () => void
}) {
  return (
    <div
      className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${selected ? 'bg-accent' : 'hover:bg-secondary'}`}
      data-testid="create-and-open-option"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      <Plus size={14} className="shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">
        Create &amp; open <strong>{title}</strong>
      </span>
    </div>
  )
}

function SearchDropdownWithCreate({ search, onSelect, query, entries, onCreateAndOpen }: {
  search: ReturnType<typeof useNoteSearch>
  onSelect: (title: string) => void
  query: string
  entries: VaultEntry[]
  onCreateAndOpen?: (title: string) => void
}) {
  const trimmed = query.trim()
  const { showCreate, createIndex } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpen)
  const hasResults = search.results.length > 0

  if (!hasResults && !showCreate) return null

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border border-border bg-popover shadow-md">
      {hasResults && (
        <NoteSearchList
          items={search.results}
          selectedIndex={search.selectedIndex}
          getItemKey={(item) => item.entry.path}
          onItemClick={(item) => onSelect(item.entry.title)}
          onItemHover={(i) => search.setSelectedIndex(i)}
          className="max-h-[160px] overflow-y-auto"
        />
      )}
      {showCreate && onCreateAndOpen && (
        <CreateAndOpenOption
          title={trimmed}
          selected={search.selectedIndex === createIndex}
          onClick={() => onCreateAndOpen(trimmed)}
          onHover={() => search.setSelectedIndex(createIndex)}
        />
      )}
    </div>
  )
}

function InlineAddNote({ entries, onAdd, onCreateAndOpenNote }: {
  entries: VaultEntry[]
  onAdd: (noteTitle: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useNoteSearch(entries, query, 8)

  const trimmed = query.trim()
  const { showCreate, createIndex, totalItems } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpenNote)

  const dismiss = useCallback(() => { setQuery(''); setActive(false) }, [])

  const selectAndClose = useCallback((title: string) => {
    onAdd(title)
    dismiss()
  }, [onAdd, dismiss])

  const handleCreateAndOpen = useCreateAndOpen(onCreateAndOpenNote, onAdd, dismiss)

  const handleConfirm = useCallback(() => {
    if (showCreate && search.selectedIndex === createIndex) {
      handleCreateAndOpen(trimmed)
      return
    }
    const title = search.selectedEntry?.title ?? trimmed
    if (title) selectAndClose(title)
  }, [search.selectedEntry, search.selectedIndex, trimmed, selectAndClose, showCreate, createIndex, handleCreateAndOpen])

  const handleKeyDown = useSearchKeyboard(search, totalItems, handleConfirm, dismiss)

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

  const showDropdown = trimmed.length > 0 && (search.results.length > 0 || showCreate)

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
          onClick={dismiss}
        >
          <X size={12} />
        </button>
      </div>
      {showDropdown && (
        <SearchDropdownWithCreate
          search={search}
          onSelect={selectAndClose}
          query={query}
          entries={entries}
          onCreateAndOpen={onCreateAndOpenNote ? (title) => { handleCreateAndOpen(title) } : undefined}
        />
      )}
    </div>
  )
}

function RelationshipGroup({ label, refs, entries, typeEntryMap, onNavigate, onRemoveRef, onAddRef, onCreateAndOpenNote }: {
  label: string; refs: string[]; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
  onRemoveRef?: (ref: string) => void
  onAddRef?: (noteTitle: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
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
      {onAddRef && (
        <InlineAddNote
          entries={entries}
          onAdd={onAddRef}
          onCreateAndOpenNote={onCreateAndOpenNote}
        />
      )}
    </div>
  )
}

function extractRelationshipRefs(frontmatter: ParsedFrontmatter): { key: string; refs: string[] }[] {
  return Object.entries(frontmatter)
    .filter(([key, value]) => key !== 'Type' && containsWikilinks(value))
    .map(([key, value]) => {
      const refs: string[] = []
      if (typeof value === 'string' && isWikilink(value)) refs.push(value)
      else if (Array.isArray(value)) value.forEach(v => { if (typeof v === 'string' && isWikilink(v)) refs.push(v) })
      return { key, refs }
    })
    .filter(({ refs }) => refs.length > 0)
}

function NoteTargetInput({ entries, value, onChange, onSubmit, onCancel, onCreateAndOpenNote, onSubmitWithCreate }: {
  entries: VaultEntry[]
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  onCancel?: () => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onSubmitWithCreate?: (title: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const search = useNoteSearch(entries, value, 8)

  const trimmed = value.trim()
  const { showCreate, createIndex, totalItems } = useCreateOption(entries, trimmed, search.results.length, !!onCreateAndOpenNote)

  const handleConfirm = useCallback(() => {
    if (showCreate && search.selectedIndex === createIndex) {
      onSubmitWithCreate?.(trimmed)
    } else if (search.selectedEntry) {
      onChange(search.selectedEntry.title)
      setFocused(false)
    } else {
      onSubmit?.()
    }
  }, [showCreate, search.selectedIndex, search.selectedEntry, createIndex, trimmed, onChange, onSubmit, onSubmitWithCreate])

  const handleEscape = useCallback(() => { onCancel?.() }, [onCancel])

  const handleKeyDown = useSearchKeyboard(search, totalItems, handleConfirm, handleEscape)

  const showDropdown = focused && trimmed.length > 0 && (search.results.length > 0 || showCreate)

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
        <SearchDropdownWithCreate
          search={search}
          onSelect={(title) => { onChange(title); setFocused(false) }}
          query={value}
          entries={entries}
          onCreateAndOpen={onCreateAndOpenNote ? (title) => onSubmitWithCreate?.(title) : undefined}
        />
      )}
    </div>
  )
}

function AddRelationshipForm({ entries, onAddProperty, onCreateAndOpenNote }: {
  entries: VaultEntry[]
  onAddProperty: (key: string, value: FrontmatterValue) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
}) {
  const [relKey, setRelKey] = useState('')
  const [relTarget, setRelTarget] = useState('')
  const [showForm, setShowForm] = useState(false)
  const keyInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setShowForm(false); setRelKey(''); setRelTarget('')
  }, [])

  const submitForm = useCallback((targetOverride?: string) => {
    const key = relKey.trim()
    const target = (targetOverride ?? relTarget).trim()
    if (!key || !target) return
    onAddProperty(key, `[[${target}]]`)
    resetForm()
  }, [relKey, relTarget, onAddProperty, resetForm])

  const addPropertyForKey = useCallback((title: string) => {
    const key = relKey.trim()
    if (key) onAddProperty(key, `[[${title}]]`)
  }, [relKey, onAddProperty])

  const handleCreateAndSubmit = useCreateAndOpen(onCreateAndOpenNote, addPropertyForKey, resetForm)

  if (!showForm) {
    return (
      <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }} onClick={() => { setShowForm(true); setTimeout(() => keyInputRef.current?.focus(), 0) }}>+ Add relationship</button>
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
      <NoteTargetInput
        entries={entries}
        value={relTarget}
        onChange={setRelTarget}
        onSubmit={submitForm}
        onCancel={resetForm}
        onCreateAndOpenNote={onCreateAndOpenNote}
        onSubmitWithCreate={handleCreateAndSubmit}
      />
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

function DisabledLinkButton() {
  return (
    <button className="mt-2 w-full border border-border bg-transparent text-center text-muted-foreground" style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12, opacity: 0.5, cursor: 'not-allowed' }} disabled>+ Add relationship</button>
  )
}

export function DynamicRelationshipsPanel({ frontmatter, entries, typeEntryMap, onNavigate, onAddProperty, onUpdateProperty, onDeleteProperty, onCreateAndOpenNote }: {
  frontmatter: ParsedFrontmatter; entries: VaultEntry[]; typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
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
          onCreateAndOpenNote={canEdit ? onCreateAndOpenNote : undefined}
        />
      ))}
      {onAddProperty
        ? <AddRelationshipForm entries={entries} onAddProperty={onAddProperty} onCreateAndOpenNote={onCreateAndOpenNote} />
        : <DisabledLinkButton />
      }
    </div>
  )
}
