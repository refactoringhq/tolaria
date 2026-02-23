import { useMemo, useState, useCallback } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { EditableValue, TagPillList } from './EditableValue'
import { Button } from '@/components/ui/button'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Active: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Done: { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)' },
  Paused: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Archived: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Dropped: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Open: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Closed: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  'Not started': { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Draft: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Mixed: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
}

const DEFAULT_STATUS_STYLE = { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' }

// Keys that are relationships (contain wikilinks)
export const RELATIONSHIP_KEYS = new Set([
  'Belongs to', 'Related to', 'Events', 'Has Data', 'Owner',
  'Advances', 'Parent', 'Children', 'Has', 'Notes',
])

// Keys to skip showing in Properties
const SKIP_KEYS = new Set(['aliases', 'notion_id', 'workspace', 'is_a', 'Is A'])

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function containsWikilinks(value: FrontmatterValue): boolean {
  if (typeof value === 'string') return /^\[\[.*\]\]$/.test(value)
  if (Array.isArray(value)) return value.some(v => typeof v === 'string' && /^\[\[.*\]\]$/.test(v))
  return false
}

function countWords(content: string | null): number {
  if (!content) return 0
  const stripped = content.replace(/^---[\s\S]*?---\n?/, '')
  const words = stripped.trim().split(/\s+/).filter((w) => w.length > 0)
  return words.length
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '\u2014'
  const d = new Date(timestamp * 1000)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function coerceValue(raw: string): FrontmatterValue {
  if (raw.toLowerCase() === 'true') return true
  if (raw.toLowerCase() === 'false') return false
  if (!isNaN(Number(raw)) && raw.trim() !== '') return Number(raw)
  return raw
}

function parseNewValue(rawValue: string): FrontmatterValue {
  if (!rawValue.includes(',')) return rawValue.trim() || ''
  const items = rawValue.split(',').map(s => s.trim()).filter(s => s)
  return items.length === 1 ? items[0] : items
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function isStatusKey(key: string): boolean {
  return key === 'Status' || key.includes('Status')
}

function isDateKey(key: string): boolean {
  return key.includes('Created') || key.includes('Modified') || key.includes('time') || key.includes('Date')
}

function StatusValue({ propKey, value, isEditing, onSave, onStartEdit }: {
  propKey: string; value: FrontmatterValue; isEditing: boolean
  onSave: (key: string, value: string) => void; onStartEdit: (key: string | null) => void
}) {
  const statusStr = String(value)
  const style = STATUS_STYLES[statusStr] ?? DEFAULT_STATUS_STYLE
  if (isEditing) {
    return (
      <input
        className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
        type="text" defaultValue={statusStr}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(propKey, (e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onStartEdit(null)
        }}
        onBlur={(e) => onSave(propKey, e.target.value)}
        autoFocus
      />
    )
  }
  return (
    <span
      className="inline-block min-w-0 cursor-pointer truncate transition-opacity hover:opacity-80"
      style={{ backgroundColor: style.bg, color: style.color, borderRadius: 16, padding: '1px 6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase' as const }}
      onClick={() => onStartEdit(propKey)} title={statusStr}
    >
      {statusStr}
    </span>
  )
}

function BooleanToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      className="rounded border border-border bg-transparent px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
      onClick={onToggle}
    >
      {value ? '\u2713 Yes' : '\u2717 No'}
    </button>
  )
}

function AddPropertyForm({ onAdd, onCancel }: { onAdd: (key: string, value: string) => void; onCancel: () => void }) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newKey.trim()) onAdd(newKey, newValue)
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
      <input
        className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
        type="text" placeholder="Property name" value={newKey}
        onChange={(e) => setNewKey(e.target.value)} onKeyDown={handleKeyDown} autoFocus
      />
      <input
        className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
        type="text" placeholder="Value" value={newValue}
        onChange={(e) => setNewValue(e.target.value)} onKeyDown={handleKeyDown}
      />
      <div className="flex justify-end gap-2">
        <Button size="xs" onClick={() => onAdd(newKey, newValue)} disabled={!newKey.trim()}>Add</Button>
        <Button size="xs" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function TypeRow({ isA, onNavigate }: { isA?: string | null; onNavigate?: (target: string) => void }) {
  if (!isA) return null
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
      {onNavigate ? (
        <button
          className="min-w-0 truncate border-none text-right cursor-pointer hover:opacity-80"
          style={{ background: getTypeLightColor(isA), color: getTypeColor(isA), borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}
          onClick={() => onNavigate(`type/${isA.toLowerCase()}`)} title={isA}
        >{isA}</button>
      ) : (
        <span className="text-right text-[12px] text-secondary-foreground">{isA}</span>
      )}
    </div>
  )
}

function PropertyRow({ propKey, value, editingKey, onStartEdit, onSave, onSaveList, onUpdate, onDelete }: {
  propKey: string; value: FrontmatterValue; editingKey: string | null
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void
  onUpdate?: (key: string, value: FrontmatterValue) => void; onDelete?: (key: string) => void
}) {
  return (
    <div className="group/prop flex items-center justify-between rounded px-1.5 py-0.5 transition-colors hover:bg-muted" data-testid="editable-property">
      <span className="font-mono-overline flex shrink-0 items-center gap-1 text-muted-foreground">
        {propKey}
        {onDelete && (
          <button className="border-none bg-transparent p-0 text-sm leading-none text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/prop:opacity-100" onClick={() => onDelete(propKey)} title="Delete property">&times;</button>
        )}
      </span>
      <PropertyValueCell propKey={propKey} value={value} isEditing={editingKey === propKey} onStartEdit={onStartEdit} onSave={onSave} onSaveList={onSaveList} onUpdate={onUpdate} />
    </div>
  )
}

function PropertyValueCell({ propKey, value, isEditing, onStartEdit, onSave, onSaveList, onUpdate }: {
  propKey: string; value: FrontmatterValue; isEditing: boolean
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void; onUpdate?: (key: string, value: FrontmatterValue) => void
}) {
  const editProps = { value: String(value ?? ''), isEditing, onStartEdit: () => onStartEdit(propKey), onSave: (v: string) => onSave(propKey, v), onCancel: () => onStartEdit(null) }
  if (value === null || value === undefined) return <EditableValue {...editProps} />
  if (isStatusKey(propKey)) return <StatusValue propKey={propKey} value={value} isEditing={isEditing} onSave={onSave} onStartEdit={onStartEdit} />
  if (Array.isArray(value)) return <TagPillList items={value.map(String)} onSave={(items) => onSaveList(propKey, items)} label={propKey} />
  if (isDateKey(propKey)) return <EditableValue {...editProps} />
  if (typeof value === 'boolean') return <BooleanToggle value={value} onToggle={() => onUpdate?.(propKey, !value)} />
  return <EditableValue {...editProps} />
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-1.5" data-testid="readonly-property">
      <span className="font-mono-overline shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>{value}</span>
    </div>
  )
}

function AddPropertyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="mt-3 w-full cursor-pointer border border-border bg-transparent text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12 }}
      onClick={onClick} disabled={disabled}
    >+ Add property</button>
  )
}

export function DynamicPropertiesPanel({
  entry,
  content,
  frontmatter,
  onUpdateProperty,
  onDeleteProperty,
  onAddProperty,
  onNavigate,
}: {
  entry: VaultEntry
  content: string | null
  frontmatter: ParsedFrontmatter
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const wordCount = countWords(content)

  const propertyEntries = useMemo(() => {
    return Object.entries(frontmatter)
      .filter(([key, value]) => !SKIP_KEYS.has(key) && !RELATIONSHIP_KEYS.has(key) && !containsWikilinks(value))
  }, [frontmatter])

  const handleSaveValue = useCallback((key: string, newValue: string) => {
    setEditingKey(null)
    if (onUpdateProperty) onUpdateProperty(key, coerceValue(newValue))
  }, [onUpdateProperty])

  const handleSaveList = useCallback((key: string, newItems: string[]) => {
    if (!onUpdateProperty) return
    if (newItems.length === 0) onDeleteProperty?.(key)
    else if (newItems.length === 1) onUpdateProperty(key, newItems[0])
    else onUpdateProperty(key, newItems)
  }, [onUpdateProperty, onDeleteProperty])

  const handleAdd = useCallback((rawKey: string, rawValue: string) => {
    if (!rawKey.trim() || !onAddProperty) return
    onAddProperty(rawKey.trim(), parseNewValue(rawValue))
    setShowAddDialog(false)
  }, [onAddProperty])

  return (
    <div className="flex flex-col gap-3">
      {/* Editable properties section */}
      <div className="flex flex-col gap-2">
        <TypeRow isA={entry.isA} onNavigate={onNavigate} />
        {propertyEntries.map(([key, value]) => (
          <PropertyRow key={key} propKey={key} value={value} editingKey={editingKey} onStartEdit={setEditingKey} onSave={handleSaveValue} onSaveList={handleSaveList} onUpdate={onUpdateProperty} onDelete={onDeleteProperty} />
        ))}
      </div>
      {showAddDialog
        ? <AddPropertyForm onAdd={handleAdd} onCancel={() => setShowAddDialog(false)} />
        : <AddPropertyButton onClick={() => setShowAddDialog(true)} disabled={!onAddProperty} />
      }
      {/* Read-only Info section */}
      <div className="border-t border-border pt-3">
        <h4 className="font-mono-overline mb-2 text-muted-foreground">Info</h4>
        <div className="flex flex-col gap-1.5">
          <InfoRow label="Modified" value={formatDate(entry.modifiedAt)} />
          <InfoRow label="Created" value={formatDate(entry.createdAt)} />
          <InfoRow label="Words" value={String(wordCount)} />
          <InfoRow label="Size" value={formatFileSize(entry.fileSize)} />
        </div>
      </div>
    </div>
  )
}
