import { useMemo, useCallback, useEffect, useState } from 'react'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { usePropertyPanelState } from '../hooks/usePropertyPanelState'
import { getEffectiveDisplayMode, detectPropertyType } from '../utils/propertyTypes'
import { SmartPropertyValueCell, DisplayModeSelector } from './PropertyValueCells'
import { TypeSelector } from './TypeSelector'
import { AddPropertyForm } from './AddPropertyForm'
import type { PropertyDisplayMode } from '../utils/propertyTypes'
import { FOCUS_NOTE_ICON_PROPERTY_EVENT } from './noteIconPropertyEvents'

function toSentenceCase(key: string): string {
  const spaced = key.replace(/[_-]/g, ' ')
  if (!spaced) return spaced
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function containsWikilinks(value: FrontmatterValue): boolean {
  if (typeof value === 'string') return /^\[\[.*\]\]$/.test(value)
  if (Array.isArray(value)) return value.some(v => typeof v === 'string' && /^\[\[.*\]\]$/.test(v))
  return false
}

function PropertyRow({ propKey, value, editingKey, displayMode, autoMode, vaultStatuses, vaultTags, onStartEdit, onSave, onSaveList, onUpdate, onDelete, onDisplayModeChange }: {
  propKey: string; value: FrontmatterValue; editingKey: string | null
  displayMode: PropertyDisplayMode; autoMode: PropertyDisplayMode
  vaultStatuses: string[]; vaultTags: string[]
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void
  onUpdate?: (key: string, value: FrontmatterValue) => void; onDelete?: (key: string) => void
  onDisplayModeChange: (key: string, mode: PropertyDisplayMode | null) => void
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingKey !== propKey) {
      e.preventDefault()
      onStartEdit(propKey)
    }
  }

  return (
    <div className="group/prop grid min-h-7 min-w-0 grid-cols-2 items-center gap-2 rounded px-1.5 outline-none transition-colors hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-primary" tabIndex={0} onKeyDown={handleKeyDown} data-testid="editable-property">
      <span className="flex min-w-0 items-center gap-1 text-[12px] text-muted-foreground">
        <span className="truncate">{toSentenceCase(propKey)}</span>
        {onDelete && (
          <button className="border-none bg-transparent p-0 text-sm leading-none text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/prop:opacity-100" onClick={() => onDelete(propKey)} title="Delete property">&times;</button>
        )}
        <DisplayModeSelector propKey={propKey} currentMode={displayMode} autoMode={autoMode} onSelect={onDisplayModeChange} />
      </span>
      <div className="min-w-0">
        <SmartPropertyValueCell propKey={propKey} value={value} displayMode={displayMode} isEditing={editingKey === propKey} vaultStatuses={vaultStatuses} vaultTags={vaultTags} onStartEdit={onStartEdit} onSave={onSave} onSaveList={onSaveList} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

function AddPropertyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="mt-1 flex w-full cursor-pointer items-center gap-1 border-none bg-transparent px-1.5 text-[12px] text-muted-foreground opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
      onClick={onClick} disabled={disabled}
    >
      <span className="text-[12px] leading-none">+</span>
      Add property
    </button>
  )
}

const SUGGESTED_PROPERTIES = [
  { key: 'Status', label: 'Status' },
  { key: 'Date', label: 'Date' },
  { key: 'URL', label: 'URL' },
  { key: 'icon', label: 'Icon' },
] as const

const SUGGESTED_PROPERTY_MODES: Record<string, PropertyDisplayMode> = {
  Status: 'status',
  Date: 'date',
  URL: 'url',
  icon: 'text',
}

function getSuggestedDisplayMode(key: string): PropertyDisplayMode {
  return SUGGESTED_PROPERTY_MODES[key] ?? 'text'
}

function SuggestedPropertySlot({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      className="grid min-h-7 min-w-0 grid-cols-2 items-center gap-2 rounded border-none bg-transparent px-1.5 text-left outline-none transition-colors hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-primary cursor-pointer"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd() } }}
      data-testid="suggested-property"
    >
      <span className="min-w-0 truncate text-[12px] text-muted-foreground/50">{label}</span>
      <span className="min-w-0 truncate text-[12px] text-muted-foreground/30">{'\u2014'}</span>
    </button>
  )
}

export function DynamicPropertiesPanel({
  entry, frontmatter, entries,
  onUpdateProperty, onDeleteProperty, onAddProperty, onNavigate,
}: {
  entry: VaultEntry
  content?: string | null
  frontmatter: ParsedFrontmatter
  entries?: VaultEntry[]
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
}) {
  const {
    editingKey, setEditingKey, showAddDialog, setShowAddDialog, displayOverrides,
    availableTypes, customColorKey, typeColorKeys, typeIconKeys, vaultStatuses, vaultTagsByKey, propertyEntries,
    handleSaveValue, handleSaveList, handleAdd, handleDisplayModeChange,
  } = usePropertyPanelState({ entries, entryIsA: entry.isA, frontmatter, onUpdateProperty, onDeleteProperty, onAddProperty })
  const [pendingSuggestedKey, setPendingSuggestedKey] = useState<string | null>(null)

  const existingKeys = useMemo(() => {
    const keys = new Set(propertyEntries.map(([k]) => k.toLowerCase()))
    // Also check full frontmatter for relationship keys that are filtered out of propertyEntries
    for (const k of Object.keys(frontmatter)) keys.add(k.toLowerCase())
    return keys
  }, [propertyEntries, frontmatter])

  const missingSuggested = onAddProperty
    ? SUGGESTED_PROPERTIES.filter(
      p => !existingKeys.has(p.key.toLowerCase()) && p.key !== pendingSuggestedKey,
    )
    : []

  const handleSuggestedAdd = useCallback((key: string) => {
    if (!onAddProperty) return
    setPendingSuggestedKey(key)
    setEditingKey(key)
  }, [onAddProperty, setEditingKey])

  const handlePendingSuggestedEdit = useCallback((key: string | null) => {
    setEditingKey(key)
    if (key === null) setPendingSuggestedKey(null)
  }, [setEditingKey])

  const handleSaveSuggestedValue = useCallback((key: string, newValue: string) => {
    setEditingKey(null)
    setPendingSuggestedKey(null)
    if (!onAddProperty) {
      return
    }
    const trimmed = newValue.trim()
    if (!trimmed) {
      return
    }
    onAddProperty(key, trimmed)
  }, [onAddProperty, setEditingKey])

  useEffect(() => {
    const handleFocusNoteIcon = () => {
      const existingIconKey = propertyEntries.find(([key]) => key.toLowerCase() === 'icon')?.[0]

      if (!existingIconKey) {
        if (!onAddProperty) return
        onAddProperty('icon', '')
      }

      setEditingKey(existingIconKey ?? 'icon')
    }

    window.addEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handleFocusNoteIcon)
    return () => window.removeEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handleFocusNoteIcon)
  }, [onAddProperty, propertyEntries, setEditingKey])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <TypeSelector isA={entry.isA} customColorKey={customColorKey} availableTypes={availableTypes} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} onUpdateProperty={onUpdateProperty} onNavigate={onNavigate} />
        {propertyEntries.map(([key, value]) => (
          <PropertyRow
            key={key} propKey={key} value={value}
            editingKey={editingKey} displayMode={getEffectiveDisplayMode(key, value, displayOverrides)} autoMode={detectPropertyType(key, value)}
            vaultStatuses={vaultStatuses}
            vaultTags={vaultTagsByKey[key] ?? []}
            onStartEdit={setEditingKey} onSave={handleSaveValue}
            onSaveList={handleSaveList} onUpdate={onUpdateProperty}
            onDelete={onDeleteProperty}
            onDisplayModeChange={handleDisplayModeChange}
          />
        ))}
        {pendingSuggestedKey && editingKey === pendingSuggestedKey && (
          <PropertyRow
            key={`pending:${pendingSuggestedKey}`}
            propKey={pendingSuggestedKey}
            value=""
            editingKey={editingKey}
            displayMode={getSuggestedDisplayMode(pendingSuggestedKey)}
            autoMode={getSuggestedDisplayMode(pendingSuggestedKey)}
            vaultStatuses={vaultStatuses}
            vaultTags={vaultTagsByKey[pendingSuggestedKey] ?? []}
            onStartEdit={handlePendingSuggestedEdit}
            onSave={handleSaveSuggestedValue}
            onSaveList={handleSaveList}
            onUpdate={undefined}
            onDelete={undefined}
            onDisplayModeChange={handleDisplayModeChange}
          />
        )}
        {missingSuggested.map(({ key, label }) => (
          <SuggestedPropertySlot key={key} label={label} onAdd={() => handleSuggestedAdd(key)} />
        ))}
      </div>
      {showAddDialog
        ? <AddPropertyForm onAdd={handleAdd} onCancel={() => setShowAddDialog(false)} vaultStatuses={vaultStatuses} />
        : <AddPropertyButton onClick={() => setShowAddDialog(true)} disabled={!onAddProperty} />
      }
    </div>
  )
}
