import { useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { VaultEntry } from '../types'
import type { FrontmatterValue } from './Inspector'
import type { ParsedFrontmatter } from '../utils/frontmatter'
import { parseFrontmatter } from '../utils/frontmatter'
import { EditableValue, TagPillList, UrlValue } from './EditableValue'
import { isUrlValue } from '../utils/url'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon, XIcon, Check, X, Type, ToggleLeft, Circle, Link, Tag } from 'lucide-react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { countWords } from '../utils/wikilinks'
import {
  type PropertyDisplayMode,
  getEffectiveDisplayMode,
  formatDateValue,
  toISODate,
  loadDisplayModeOverrides,
  saveDisplayModeOverride,
  removeDisplayModeOverride,
  detectPropertyType,
} from '../utils/propertyTypes'
import { StatusPill, StatusDropdown } from './StatusDropdown'
import { TagsDropdown } from './TagsDropdown'
import { getTagStyle } from '../utils/tagStyles'

// Keys that are relationships (contain wikilinks)
export const RELATIONSHIP_KEYS = new Set([
  'Belongs to', 'Related to', 'Events', 'Has Data', 'Owner',
  'Advances', 'Parent', 'Children', 'Has', 'Notes',
])

// Keys to skip showing in Properties (handled by dedicated UI or internal)
const SKIP_KEYS = new Set(['aliases', 'notion_id', 'workspace', 'title', 'type', 'is_a', 'Is A'])

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function containsWikilinks(value: FrontmatterValue): boolean {
  if (typeof value === 'string') return /^\[\[.*\]\]$/.test(value)
  if (Array.isArray(value)) return value.some(v => typeof v === 'string' && /^\[\[.*\]\]$/.test(v))
  return false
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

function StatusValue({ propKey, value, isEditing, vaultStatuses, onSave, onStartEdit }: {
  propKey: string; value: FrontmatterValue; isEditing: boolean; vaultStatuses: string[]
  onSave: (key: string, value: string) => void; onStartEdit: (key: string | null) => void
}) {
  const statusStr = String(value)
  return (
    <span className="relative inline-flex min-w-0 items-center">
      <span
        className="cursor-pointer transition-opacity hover:opacity-80"
        onClick={() => onStartEdit(propKey)}
        data-testid="status-badge"
      >
        <StatusPill status={statusStr} />
      </span>
      {isEditing && (
        <StatusDropdown
          value={statusStr}
          vaultStatuses={vaultStatuses}
          onSave={(newValue) => onSave(propKey, newValue)}
          onCancel={() => onStartEdit(null)}
        />
      )}
    </span>
  )
}

function TagsValue({ propKey, value, isEditing, vaultTags, onSave, onStartEdit }: {
  propKey: string; value: string[]; isEditing: boolean; vaultTags: string[]
  onSave: (key: string, items: string[]) => void; onStartEdit: (key: string | null) => void
}) {
  const handleToggle = useCallback((tag: string) => {
    const idx = value.indexOf(tag)
    const next = idx >= 0 ? value.filter((_, i) => i !== idx) : [...value, tag]
    onSave(propKey, next)
  }, [propKey, value, onSave])

  const handleRemove = useCallback((tag: string) => {
    onSave(propKey, value.filter(t => t !== tag))
  }, [propKey, value, onSave])

  return (
    <span className="relative inline-flex min-w-0 flex-wrap items-center gap-1">
      {value.map(tag => {
        const style = getTagStyle(tag)
        return (
          <span key={tag} className="group/tag inline-flex items-center gap-0.5 rounded-full" style={{ backgroundColor: style.bg, padding: '1px 6px' }}>
            <span style={{ color: style.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{tag}</span>
            <button
              className="border-none bg-transparent p-0 leading-none opacity-0 transition-opacity group-hover/tag:opacity-100"
              style={{ color: style.color, fontSize: 10 }}
              onClick={() => handleRemove(tag)}
              title={`Remove ${tag}`}
            >&times;</button>
          </span>
        )
      })}
      <button
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-transparent text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        onClick={() => onStartEdit(propKey)}
        title="Add tag"
        data-testid="tags-add-button"
      >+</button>
      {isEditing && (
        <TagsDropdown
          selectedTags={value}
          vaultTags={vaultTags}
          onToggle={handleToggle}
          onClose={() => onStartEdit(null)}
        />
      )}
    </span>
  )
}

function BooleanToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      className="rounded border border-border bg-transparent px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
      onClick={onToggle}
      data-testid="boolean-toggle"
    >
      {value ? '\u2713 Yes' : '\u2717 No'}
    </button>
  )
}

function parseDateValue(value: string): Date | undefined {
  const iso = toISODate(value)
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

function dateToISO(day: Date): string {
  const yyyy = day.getFullYear()
  const mm = String(day.getMonth() + 1).padStart(2, '0')
  const dd = String(day.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function DateValue({ value, onSave }: {
  value: string; onSave: (newValue: string) => void
}) {
  const [open, setOpen] = useState(false)
  const formatted = formatDateValue(value)
  const selectedDate = parseDateValue(value)

  const handleSelect = (day: Date | undefined) => {
    if (day) onSave(dateToISO(day))
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSave('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded border-none bg-transparent px-1 py-0.5 text-right text-[12px] text-secondary-foreground transition-colors hover:bg-muted"
          title={value}
          data-testid="date-display"
        >
          <CalendarIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className={`min-w-0 truncate${!formatted ? ' text-muted-foreground' : ''}`}>{formatted || 'Pick a date\u2026'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" side="left" data-testid="date-picker-popover">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate}
          data-testid="date-picker-calendar"
        />
        {selectedDate && (
          <div className="border-t px-3 py-2">
            <button
              className="inline-flex items-center gap-1 border-none bg-transparent text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClear}
              data-testid="date-picker-clear"
            >
              <XIcon className="size-3" />
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const DISPLAY_MODE_OPTIONS: { value: PropertyDisplayMode; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'status', label: 'Status' },
  { value: 'url', label: 'URL' },
  { value: 'tags', label: 'Tags' },
]

function DisplayModeSelector({ propKey, currentMode, autoMode, onSelect }: {
  propKey: string; currentMode: PropertyDisplayMode; autoMode: PropertyDisplayMode
  onSelect: (key: string, mode: PropertyDisplayMode | null) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const positionMenu = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const menuW = 140
    let left = rect.right - menuW
    if (left < 8) left = 8
    node.style.top = `${rect.bottom + 4}px`
    node.style.left = `${left}px`
  }, [])

  const handleSelect = (mode: PropertyDisplayMode) => {
    if (mode === autoMode) {
      onSelect(propKey, null)
    } else {
      onSelect(propKey, mode)
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        className="flex h-4 w-4 items-center justify-center rounded border-none bg-transparent p-0 text-[10px] leading-none text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/prop:opacity-100"
        onClick={() => setOpen(!open)}
        title="Change display mode"
        data-testid="display-mode-trigger"
      >
        {'\u25BE'}
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[12000]" onClick={() => setOpen(false)} />
          <div
            ref={positionMenu}
            className="fixed z-[12001] min-w-[130px] rounded-md border border-border bg-background py-1 shadow-md"
            data-testid="display-mode-menu"
          >
            {DISPLAY_MODE_OPTIONS.map(opt => {
              const OptIcon = DISPLAY_MODE_ICONS[opt.value]
              return (
                <button
                  key={opt.value}
                  className="flex w-full items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
                  onClick={() => handleSelect(opt.value)}
                  data-testid={`display-mode-option-${opt.value}`}
                >
                  <span className="w-3 text-center text-[10px]">
                    {currentMode === opt.value ? '\u2713' : ''}
                  </span>
                  <OptIcon className="size-3.5 text-muted-foreground" />
                  {opt.label}
                  {opt.value === autoMode && (
                    <span className="ml-auto text-[10px] text-muted-foreground">auto</span>
                  )}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

const DISPLAY_MODE_ICONS: Record<PropertyDisplayMode, typeof Type> = {
  text: Type, date: CalendarIcon, boolean: ToggleLeft, status: Circle, url: Link, tags: Tag,
}

const ADD_INPUT_CLASS = "h-[26px] min-w-[60px] flex-1 rounded border border-border bg-muted px-1.5 text-[12px] text-foreground outline-none focus:border-primary"

function AddBooleanInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const boolVal = value.toLowerCase() === 'true'
  return (
    <button
      className="h-[26px] min-w-[60px] flex-1 rounded border border-border bg-muted px-1.5 text-[12px] text-secondary-foreground transition-colors hover:bg-accent"
      onClick={() => onChange(boolVal ? 'false' : 'true')}
      data-testid="add-property-boolean-toggle"
    >
      {boolVal ? '\u2713 Yes' : '\u2717 No'}
    </button>
  )
}

function AddDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selectedDate = value ? parseDateValue(value) : undefined
  const formatted = value ? formatDateValue(value) : ''
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-[26px] min-w-[60px] flex-1 cursor-pointer items-center gap-1 rounded border border-border bg-muted px-1.5 text-[12px] transition-colors hover:bg-accent"
          data-testid="add-property-date-trigger"
        >
          <CalendarIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className={`min-w-0 truncate${!formatted ? ' text-muted-foreground' : ' text-foreground'}`}>
            {formatted || 'Pick a date\u2026'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="left">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(day) => { if (day) onChange(dateToISO(day)) }}
          defaultMonth={selectedDate}
        />
      </PopoverContent>
    </Popover>
  )
}

function AddStatusInput({ value, onChange, vaultStatuses }: { value: string; onChange: (v: string) => void; vaultStatuses: string[] }) {
  const [showDropdown, setShowDropdown] = useState(false)
  return (
    <span className="relative inline-flex min-w-[60px] flex-1 items-center">
      <button
        className="inline-flex h-[26px] min-w-[60px] flex-1 cursor-pointer items-center gap-1 rounded border border-border bg-muted px-1.5 text-[12px] transition-colors hover:bg-accent"
        onClick={() => setShowDropdown(true)}
        data-testid="add-property-status-trigger"
      >
        {value ? <StatusPill status={value} /> : <span className="text-muted-foreground">Status{'\u2026'}</span>}
      </button>
      {showDropdown && (
        <StatusDropdown
          value={value}
          vaultStatuses={vaultStatuses}
          onSave={(v) => { onChange(v); setShowDropdown(false) }}
          onCancel={() => setShowDropdown(false)}
        />
      )}
    </span>
  )
}

function AddPropertyValueInput({ displayMode, value, onChange, onKeyDown, vaultStatuses }: {
  displayMode: PropertyDisplayMode; value: string; onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void; vaultStatuses: string[]
}) {
  switch (displayMode) {
    case 'boolean': return <AddBooleanInput value={value} onChange={onChange} />
    case 'date': return <AddDateInput value={value} onChange={onChange} />
    case 'status': return <AddStatusInput value={value} onChange={onChange} vaultStatuses={vaultStatuses} />
    case 'tags': return (
      <input className={ADD_INPUT_CLASS} type="text" placeholder="tag1, tag2, ..." value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
      />
    )
    default: return (
      <input className={ADD_INPUT_CLASS} type="text" placeholder="Value" value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
      />
    )
  }
}

function AddPropertyForm({ onAdd, onCancel, vaultStatuses }: {
  onAdd: (key: string, value: string, displayMode: PropertyDisplayMode) => void; onCancel: () => void
  vaultStatuses: string[]
}) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [displayMode, setDisplayMode] = useState<PropertyDisplayMode>('text')

  const handleModeChange = (mode: PropertyDisplayMode) => {
    setDisplayMode(mode)
    if (mode === 'boolean') setNewValue('false')
    else if (mode !== displayMode) setNewValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newKey.trim()) onAdd(newKey, newValue, displayMode)
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1" data-testid="add-property-form">
      <input
        className="h-[26px] w-20 shrink-0 rounded border border-border bg-muted px-1.5 text-[12px] text-foreground outline-none focus:border-primary"
        type="text" placeholder="Property name" value={newKey}
        onChange={(e) => setNewKey(e.target.value)} onKeyDown={handleKeyDown} autoFocus
      />
      <Select value={displayMode} onValueChange={(v) => handleModeChange(v as PropertyDisplayMode)}>
        <SelectTrigger
          size="sm"
          className="h-[26px] w-[72px] shrink-0 gap-1 border-border bg-muted px-1.5 py-0 shadow-none"
          style={{ fontSize: 12, borderRadius: 4 }}
          data-testid="add-property-type-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" side="left">
          {DISPLAY_MODE_OPTIONS.map(opt => {
            const OptIcon = DISPLAY_MODE_ICONS[opt.value]
            return (
              <SelectItem key={opt.value} value={opt.value}>
                <OptIcon className="size-3.5 text-muted-foreground" />
                {opt.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <AddPropertyValueInput displayMode={displayMode} value={newValue} onChange={setNewValue} onKeyDown={handleKeyDown} vaultStatuses={vaultStatuses} />
      <Button
        size="icon-xs" onClick={() => onAdd(newKey, newValue, displayMode)}
        disabled={!newKey.trim()} title="Add property"
        data-testid="add-property-confirm"
      >
        <Check className="size-3.5" />
      </Button>
      <Button size="icon-xs" variant="outline" onClick={onCancel} title="Cancel" data-testid="add-property-cancel">
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

const TYPE_NONE = '__none__'

function ReadOnlyType({ isA, customColorKey, onNavigate }: { isA?: string | null; customColorKey?: string | null; onNavigate?: (target: string) => void }) {
  if (!isA) return null
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-1.5">
      <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
      {onNavigate ? (
        <button
          className="min-w-0 truncate border-none text-right cursor-pointer hover:opacity-80"
          style={{ background: getTypeLightColor(isA, customColorKey), color: getTypeColor(isA, customColorKey), borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}
          onClick={() => onNavigate(`type/${isA.toLowerCase()}`)} title={isA}
        >{isA}</button>
      ) : (
        <span className="text-right text-[12px] text-secondary-foreground">{isA}</span>
      )}
    </div>
  )
}

function TypeSelector({ isA, customColorKey, availableTypes, typeColorKeys, onUpdateProperty, onNavigate }: {
  isA?: string | null; customColorKey?: string | null; availableTypes: string[]
  typeColorKeys: Record<string, string | null>
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
}) {
  if (!onUpdateProperty) return <ReadOnlyType isA={isA} customColorKey={customColorKey} onNavigate={onNavigate} />

  const currentValue = isA || TYPE_NONE
  const options = isA && !availableTypes.includes(isA)
    ? [...availableTypes, isA].sort((a, b) => a.localeCompare(b))
    : availableTypes

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-1.5" data-testid="type-selector">
      <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
      <Select value={currentValue} onValueChange={v => onUpdateProperty('type', v === TYPE_NONE ? null : v)}>
        <SelectTrigger
          size="sm"
          className="h-[26px] shrink-0 gap-1 border-border bg-muted px-1.5 py-0 shadow-none"
          style={{ fontSize: 12, borderRadius: 4 }}
        >
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent position="popper" side="left">
          <SelectItem value={TYPE_NONE}>None</SelectItem>
          <SelectSeparator />
          {options.map(type => (
            <SelectItem key={type} value={type}>
              <Circle className="size-3" style={{ color: getTypeColor(type, typeColorKeys[type]), fill: getTypeColor(type, typeColorKeys[type]) }} />
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function toBooleanValue(value: FrontmatterValue): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function autoDetectFromValue(value: FrontmatterValue): PropertyDisplayMode {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string' && isUrlValue(value)) return 'url'
  return 'text'
}

type SmartCellProps = {
  propKey: string; value: FrontmatterValue; displayMode: PropertyDisplayMode; isEditing: boolean
  vaultStatuses: string[]; vaultTags: string[]
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void; onUpdate?: (key: string, value: FrontmatterValue) => void
}

function ScalarValueCell({ propKey, value, displayMode, isEditing, vaultStatuses, vaultTags, onStartEdit, onSave, onSaveList, onUpdate }: SmartCellProps) {
  const editProps = { value: String(value ?? ''), isEditing, onStartEdit: () => onStartEdit(propKey), onSave: (v: string) => onSave(propKey, v), onCancel: () => onStartEdit(null) }
  const resolvedMode = displayMode === 'text' ? autoDetectFromValue(value) : displayMode
  switch (resolvedMode) {
    case 'status':
      return <StatusValue propKey={propKey} value={value ?? ''} isEditing={isEditing} vaultStatuses={vaultStatuses} onSave={onSave} onStartEdit={onStartEdit} />
    case 'tags':
      return <TagsValue propKey={propKey} value={value ? [String(value)] : []} isEditing={isEditing} vaultTags={vaultTags} onSave={onSaveList} onStartEdit={onStartEdit} />
    case 'date':
      return <DateValue value={String(value ?? '')} onSave={(v) => onSave(propKey, v)} />
    case 'boolean': {
      const boolVal = toBooleanValue(value)
      return <BooleanToggle value={boolVal} onToggle={() => onUpdate?.(propKey, !boolVal)} />
    }
    case 'url':
      return <UrlValue {...editProps} />
    default:
      return <EditableValue {...editProps} />
  }
}

function SmartPropertyValueCell(props: SmartCellProps) {
  const { propKey, value, displayMode, isEditing, vaultTags, onSaveList, onStartEdit } = props
  if (Array.isArray(value)) {
    if (displayMode === 'tags') {
      return <TagsValue propKey={propKey} value={value.map(String)} isEditing={isEditing} vaultTags={vaultTags} onSave={onSaveList} onStartEdit={onStartEdit} />
    }
    return <TagPillList items={value.map(String)} onSave={(items) => onSaveList(propKey, items)} label={propKey} />
  }
  return <ScalarValueCell {...props} />
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
  return (
    <div className="group/prop flex min-w-0 items-center justify-between gap-2 rounded px-1.5 py-0.5 transition-colors hover:bg-muted" data-testid="editable-property">
      <span className="font-mono-overline flex min-w-0 items-center gap-1 text-muted-foreground">
        <span className="truncate">{propKey}</span>
        {onDelete && (
          <button className="border-none bg-transparent p-0 text-sm leading-none text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/prop:opacity-100" onClick={() => onDelete(propKey)} title="Delete property">&times;</button>
        )}
        <DisplayModeSelector propKey={propKey} currentMode={displayMode} autoMode={autoMode} onSelect={onDisplayModeChange} />
      </span>
      <SmartPropertyValueCell propKey={propKey} value={value} displayMode={displayMode} isEditing={editingKey === propKey} vaultStatuses={vaultStatuses} vaultTags={vaultTags} onStartEdit={onStartEdit} onSave={onSave} onSaveList={onSaveList} onUpdate={onUpdate} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-1.5" data-testid="readonly-property">
      <span className="font-mono-overline shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="min-w-0 truncate text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>{value}</span>
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

function NoteInfoSection({ entry, wordCount }: { entry: VaultEntry; wordCount: number }) {
  return (
    <div className="border-t border-border pt-3">
      <h4 className="font-mono-overline mb-2 text-muted-foreground">Info</h4>
      <div className="flex flex-col gap-1.5">
        <InfoRow label="Modified" value={formatDate(entry.modifiedAt)} />
        <InfoRow label="Created" value={formatDate(entry.createdAt)} />
        <InfoRow label="Words" value={String(wordCount)} />
        <InfoRow label="Size" value={formatFileSize(entry.fileSize)} />
      </div>
    </div>
  )
}

function reconcileListUpdate(
  newItems: string[],
  onUpdate: (key: string, value: FrontmatterValue) => void,
  onDelete: ((key: string) => void) | undefined,
  key: string,
) {
  if (newItems.length === 0) onDelete?.(key)
  else if (newItems.length === 1) onUpdate(key, newItems[0])
  else onUpdate(key, newItems)
}

function deriveTypeInfo(entries: VaultEntry[] | undefined, entryIsA: string | null) {
  const typeEntries = (entries ?? []).filter(e => e.isA === 'Type')
  const typeColorKeys: Record<string, string | null> = {}
  for (const e of typeEntries) { typeColorKeys[e.title] = e.color ?? null }
  return {
    availableTypes: typeEntries.map(e => e.title).sort((a, b) => a.localeCompare(b)),
    customColorKey: entryIsA ? (typeColorKeys[entryIsA] ?? null) : null,
    typeColorKeys,
  }
}

function collectVaultStatuses(entries: VaultEntry[] | undefined): string[] {
  const seen = new Set<string>()
  for (const e of entries ?? []) {
    if (e.status) seen.add(e.status)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

function mergeArrayFieldsInto(fm: ParsedFrontmatter, tagsByKey: Map<string, Set<string>>): void {
  for (const [key, value] of Object.entries(fm)) {
    if (!Array.isArray(value)) continue
    let set = tagsByKey.get(key)
    if (!set) { set = new Set(); tagsByKey.set(key, set) }
    for (const tag of value) set.add(String(tag))
  }
}

function collectAllVaultTags(entries: VaultEntry[] | undefined, allContent: Record<string, string> | undefined): Record<string, string[]> {
  if (!entries || !allContent) return {}
  const tagsByKey = new Map<string, Set<string>>()
  for (const entry of entries) {
    const content = allContent[entry.path]
    if (!content) continue
    mergeArrayFieldsInto(parseFrontmatter(content), tagsByKey)
  }
  const result: Record<string, string[]> = {}
  for (const [key, set] of tagsByKey) result[key] = Array.from(set).sort((a, b) => a.localeCompare(b))
  return result
}

function isVisibleProperty([key, value]: [string, FrontmatterValue]): boolean {
  return !SKIP_KEYS.has(key) && !RELATIONSHIP_KEYS.has(key) && !containsWikilinks(value)
}

function parseAddedValue(rawValue: string, mode: PropertyDisplayMode): FrontmatterValue {
  if (mode === 'boolean') return rawValue.toLowerCase() === 'true'
  if (mode === 'tags') {
    const items = rawValue.split(',').map(s => s.trim()).filter(s => s)
    return items
  }
  return parseNewValue(rawValue)
}

function persistModeOverride(key: string, mode: PropertyDisplayMode | null) {
  if (mode === null) removeDisplayModeOverride(key)
  else saveDisplayModeOverride(key, mode)
}

interface PropertyPanelDeps {
  entries: VaultEntry[] | undefined
  entryIsA: string | null
  frontmatter: ParsedFrontmatter
  allContent: Record<string, string> | undefined
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
}

function usePropertyPanelState(deps: PropertyPanelDeps) {
  const { entries, entryIsA, frontmatter, allContent, onUpdateProperty, onDeleteProperty, onAddProperty } = deps
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [displayOverrides, setDisplayOverrides] = useState(() => loadDisplayModeOverrides())

  const { availableTypes, customColorKey, typeColorKeys } = useMemo(() => deriveTypeInfo(entries, entryIsA), [entries, entryIsA])
  const vaultStatuses = useMemo(() => collectVaultStatuses(entries), [entries])
  const vaultTagsByKey = useMemo(() => collectAllVaultTags(entries, allContent), [entries, allContent])
  const propertyEntries = useMemo(() => Object.entries(frontmatter).filter(isVisibleProperty), [frontmatter])

  const handleSaveValue = useCallback((key: string, newValue: string) => {
    setEditingKey(null)
    if (onUpdateProperty) onUpdateProperty(key, coerceValue(newValue))
  }, [onUpdateProperty])

  const handleSaveList = useCallback((key: string, newItems: string[]) => {
    if (!onUpdateProperty) return
    reconcileListUpdate(newItems, onUpdateProperty, onDeleteProperty, key)
  }, [onUpdateProperty, onDeleteProperty])

  const handleAdd = useCallback((rawKey: string, rawValue: string, mode: PropertyDisplayMode) => {
    if (!rawKey.trim() || !onAddProperty) return
    onAddProperty(rawKey.trim(), parseAddedValue(rawValue, mode))
    if (mode !== 'text') {
      persistModeOverride(rawKey.trim(), mode)
      setDisplayOverrides(loadDisplayModeOverrides())
    }
    setShowAddDialog(false)
  }, [onAddProperty])

  const handleDisplayModeChange = useCallback((key: string, mode: PropertyDisplayMode | null) => {
    persistModeOverride(key, mode)
    setDisplayOverrides(loadDisplayModeOverrides())
  }, [])

  return {
    editingKey, setEditingKey, showAddDialog, setShowAddDialog, displayOverrides,
    availableTypes, customColorKey, typeColorKeys, vaultStatuses, vaultTagsByKey, propertyEntries,
    handleSaveValue, handleSaveList, handleAdd, handleDisplayModeChange,
  }
}

export function DynamicPropertiesPanel({
  entry, content, frontmatter, entries, allContent,
  onUpdateProperty, onDeleteProperty, onAddProperty, onNavigate,
}: {
  entry: VaultEntry
  content: string | null
  frontmatter: ParsedFrontmatter
  entries?: VaultEntry[]
  allContent?: Record<string, string>
  onUpdateProperty?: (key: string, value: FrontmatterValue) => void
  onDeleteProperty?: (key: string) => void
  onAddProperty?: (key: string, value: FrontmatterValue) => void
  onNavigate?: (target: string) => void
}) {
  const {
    editingKey, setEditingKey, showAddDialog, setShowAddDialog, displayOverrides,
    availableTypes, customColorKey, typeColorKeys, vaultStatuses, vaultTagsByKey, propertyEntries,
    handleSaveValue, handleSaveList, handleAdd, handleDisplayModeChange,
  } = usePropertyPanelState({ entries, entryIsA: entry.isA, frontmatter, allContent, onUpdateProperty, onDeleteProperty, onAddProperty })

  const wordCount = countWords(content ?? '')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <TypeSelector isA={entry.isA} customColorKey={customColorKey} availableTypes={availableTypes} typeColorKeys={typeColorKeys} onUpdateProperty={onUpdateProperty} onNavigate={onNavigate} />
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
      </div>
      {showAddDialog
        ? <AddPropertyForm onAdd={handleAdd} onCancel={() => setShowAddDialog(false)} vaultStatuses={vaultStatuses} />
        : <AddPropertyButton onClick={() => setShowAddDialog(true)} disabled={!onAddProperty} />
      }
      <NoteInfoSection entry={entry} wordCount={wordCount} />
    </div>
  )
}
