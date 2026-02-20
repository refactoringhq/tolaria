import { useMemo, useState, useCallback } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { EditableValue, EditableList } from './EditableValue'
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
const SKIP_KEYS = new Set(['aliases', 'notion_id', 'workspace'])

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
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const wordCount = countWords(content)

  const propertyEntries = useMemo(() => {
    return Object.entries(frontmatter)
      .filter(([key, value]) => {
        if (SKIP_KEYS.has(key)) return false
        if (RELATIONSHIP_KEYS.has(key)) return false
        if (containsWikilinks(value)) return false
        return true
      })
  }, [frontmatter])

  const handleSaveValue = useCallback((key: string, newValue: string) => {
    setEditingKey(null)
    if (onUpdateProperty) {
      if (newValue.toLowerCase() === 'true') onUpdateProperty(key, true)
      else if (newValue.toLowerCase() === 'false') onUpdateProperty(key, false)
      else if (!isNaN(Number(newValue)) && newValue.trim() !== '') onUpdateProperty(key, Number(newValue))
      else onUpdateProperty(key, newValue)
    }
  }, [onUpdateProperty])

  const handleSaveList = useCallback((key: string, newItems: string[]) => {
    if (onUpdateProperty) {
      if (newItems.length === 0) onDeleteProperty?.(key)
      else if (newItems.length === 1) onUpdateProperty(key, newItems[0])
      else onUpdateProperty(key, newItems)
    }
  }, [onUpdateProperty, onDeleteProperty])

  const handleAddProperty = useCallback(() => {
    if (newKey.trim() && onAddProperty) {
      if (newValue.includes(',')) {
        const items = newValue.split(',').map(s => s.trim()).filter(s => s)
        onAddProperty(newKey.trim(), items.length === 1 ? items[0] : items)
      } else {
        onAddProperty(newKey.trim(), newValue.trim() || '')
      }
      setNewKey('')
      setNewValue('')
      setShowAddDialog(false)
    }
  }, [newKey, newValue, onAddProperty])

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddProperty()
    else if (e.key === 'Escape') {
      setShowAddDialog(false)
      setNewKey('')
      setNewValue('')
    }
  }

  const renderEditableValue = (key: string, value: FrontmatterValue) => {
    if (value === null || value === undefined) {
      return (
        <EditableValue
          value="" isEditing={editingKey === key}
          onStartEdit={() => setEditingKey(key)}
          onSave={(v) => handleSaveValue(key, v)}
          onCancel={() => setEditingKey(null)}
        />
      )
    }

    if (key === 'Status' || key.includes('Status')) {
      const statusStr = String(value)
      const style = STATUS_STYLES[statusStr] ?? DEFAULT_STATUS_STYLE
      if (editingKey === key) {
        return (
          <input
            className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
            type="text" defaultValue={statusStr}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveValue(key, (e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditingKey(null)
            }}
            onBlur={(e) => handleSaveValue(key, e.target.value)}
            autoFocus
          />
        )
      }
      return (
        <span
          className="inline-block cursor-pointer transition-opacity hover:opacity-80"
          style={{ backgroundColor: style.bg, color: style.color, borderRadius: 16, padding: '1px 6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase' as const }}
          onClick={() => setEditingKey(key)} title="Click to edit"
        >
          {statusStr}
        </span>
      )
    }

    if (Array.isArray(value)) {
      return <EditableList items={value.map(String)} onSave={(items) => handleSaveList(key, items)} label={key} />
    }

    if (key.includes('Created') || key.includes('Modified') || key.includes('time') || key.includes('Date')) {
      return (
        <EditableValue
          value={String(value)} isEditing={editingKey === key}
          onStartEdit={() => setEditingKey(key)}
          onSave={(v) => handleSaveValue(key, v)}
          onCancel={() => setEditingKey(null)}
        />
      )
    }

    if (typeof value === 'boolean') {
      return (
        <button
          className="rounded border border-border bg-transparent px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
          onClick={() => onUpdateProperty?.(key, !value)}
        >
          {value ? '\u2713 Yes' : '\u2717 No'}
        </button>
      )
    }

    return (
      <EditableValue
        value={String(value)} isEditing={editingKey === key}
        onStartEdit={() => setEditingKey(key)}
        onSave={(v) => handleSaveValue(key, v)}
        onCancel={() => setEditingKey(null)}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {entry.isA && (
          <div className="flex items-center justify-between">
            <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
            {onNavigate ? (
              <button
                className="border-none text-right cursor-pointer hover:opacity-80"
                style={{
                  background: getTypeLightColor(entry.isA),
                  color: getTypeColor(entry.isA),
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 500,
                }}
                onClick={() => onNavigate(`type/${entry.isA!.toLowerCase()}`)}
              >
                {entry.isA}
              </button>
            ) : (
              <span className="text-right text-[12px] text-secondary-foreground">{entry.isA}</span>
            )}
          </div>
        )}

        {propertyEntries.map(([key, value]) => (
          <div key={key} className="group/prop flex items-center justify-between">
            <span className="font-mono-overline flex shrink-0 items-center gap-1 text-muted-foreground">
              {key}
              {onDeleteProperty && (
                <button
                  className="border-none bg-transparent p-0 text-sm leading-none text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/prop:opacity-100"
                  onClick={() => onDeleteProperty(key)} title="Delete property"
                >
                  &times;
                </button>
              )}
            </span>
            {renderEditableValue(key, value)}
          </div>
        ))}

        <div className="flex items-center justify-between">
          <span className="font-mono-overline shrink-0 text-muted-foreground">Modified</span>
          <span className="text-right text-[12px] text-secondary-foreground">{formatDate(entry.modifiedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono-overline shrink-0 text-muted-foreground">Words</span>
          <span className="text-right text-[12px] text-secondary-foreground">{wordCount}</span>
        </div>
      </div>

      {showAddDialog ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
          <input
            className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
            type="text" placeholder="Property name" value={newKey}
            onChange={(e) => setNewKey(e.target.value)} onKeyDown={handleAddKeyDown} autoFocus
          />
          <input
            className="w-full rounded border border-ring bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
            type="text" placeholder="Value" value={newValue}
            onChange={(e) => setNewValue(e.target.value)} onKeyDown={handleAddKeyDown}
          />
          <div className="flex justify-end gap-2">
            <Button size="xs" onClick={handleAddProperty} disabled={!newKey.trim()}>Add</Button>
            <Button size="xs" variant="outline" onClick={() => { setShowAddDialog(false); setNewKey(''); setNewValue('') }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button
          className="mt-3 w-full cursor-pointer border border-border bg-transparent text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: 6, padding: '6px 12px', fontSize: 12 }}
          onClick={() => setShowAddDialog(true)} disabled={!onAddProperty}
        >
          + Add property
        </button>
      )}
    </div>
  )
}
