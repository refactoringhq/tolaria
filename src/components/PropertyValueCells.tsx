import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { FrontmatterValue } from './Inspector'
import { EditableValue, TagPillList, UrlValue } from './EditableValue'
import { isUrlValue } from '../utils/url'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { XIcon } from 'lucide-react'
import { isValidCssColor } from '../utils/colorUtils'
import {
  type PropertyDisplayMode,
  formatDateValue,
  toISODate,
  DISPLAY_MODE_OPTIONS,
  DISPLAY_MODE_ICONS,
} from '../utils/propertyTypes'
import { StatusDropdown } from './StatusDropdown'
import { getStatusStyle } from '../utils/statusStyles'
import { TagsDropdown } from './TagsDropdown'
import { getTagStyle } from '../utils/tagStyles'
import { ColorEditableValue } from './ColorInput'

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

function StatusValue({ propKey, value, isEditing, vaultStatuses, onSave, onStartEdit }: {
  propKey: string; value: FrontmatterValue; isEditing: boolean; vaultStatuses: string[]
  onSave: (key: string, value: string) => void; onStartEdit: (key: string | null) => void
}) {
  const statusStr = String(value)
  const style = getStatusStyle(statusStr)
  return (
    <span className="relative inline-flex min-w-0 items-center">
      <span
        className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-opacity hover:opacity-80"
        style={{ backgroundColor: style.bg, color: style.color }}
        onClick={() => onStartEdit(propKey)}
        data-testid="status-badge"
      >
        <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
        {statusStr}
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
          <span
            key={tag}
            className="group/tag relative inline-flex h-6 items-center overflow-hidden rounded-md"
            style={{ backgroundColor: style.bg, padding: '0 8px', maxWidth: 120 }}
          >
            <span
              className="transition-[max-width] duration-150 group-hover/tag:[mask-image:linear-gradient(to_right,black_60%,transparent_100%)]"
              style={{
                color: style.color,
                fontSize: 12,
                fontWeight: 500,
                overflow: 'hidden',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {tag}
            </span>
            <button
              className="ml-0.5 max-w-0 overflow-hidden border-none bg-transparent p-0 leading-none opacity-0 transition-all duration-150 group-hover/tag:max-w-[14px] group-hover/tag:opacity-100"
              style={{ color: style.color, fontSize: 11, flexShrink: 0 }}
              onClick={() => handleRemove(tag)}
              title={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        )
      })}
      <button
        className="inline-flex h-6 shrink-0 items-center justify-center rounded-md border-none bg-muted text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        style={{ padding: '0 8px' }}
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
    <label className="inline-flex h-6 cursor-pointer items-center gap-1.5" data-testid="boolean-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={onToggle}
        className="size-3.5 cursor-pointer accent-primary"
      />
      <span className="text-[12px] text-secondary-foreground">{value ? 'Yes' : 'No'}</span>
    </label>
  )
}

function DateValue({ value, onSave, autoOpen = false, onCancel }: {
  value: string
  onSave: (newValue: string) => void
  autoOpen?: boolean
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(autoOpen)
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
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !value) onCancel?.()
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={`inline-flex h-6 min-w-0 cursor-pointer items-center gap-1 border-none px-2 text-right text-[12px] font-medium transition-colors hover:opacity-80${formatted ? ' rounded-md bg-muted text-accent-foreground' : ' bg-transparent text-muted-foreground'}`}
          title={value}
          data-testid="date-display"
        >
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

export function DisplayModeSelector({ propKey, currentMode, autoMode, onSelect }: {
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

function toBooleanValue(value: FrontmatterValue): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function autoDetectFromValue(propKey: string, value: FrontmatterValue): PropertyDisplayMode {
  if (propKey.toLowerCase() === 'icon') return 'text'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string' && isUrlValue(value)) return 'url'
  if (typeof value === 'string' && isValidCssColor(value) && value.startsWith('#')) return 'color'
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
  const resolvedMode = displayMode === 'text' ? autoDetectFromValue(propKey, value) : displayMode
  switch (resolvedMode) {
    case 'status':
      return <StatusValue propKey={propKey} value={value ?? ''} isEditing={isEditing} vaultStatuses={vaultStatuses} onSave={onSave} onStartEdit={onStartEdit} />
    case 'tags':
      return <TagsValue propKey={propKey} value={value ? [String(value)] : []} isEditing={isEditing} vaultTags={vaultTags} onSave={onSaveList} onStartEdit={onStartEdit} />
    case 'date':
      return (
        <DateValue
          key={`${propKey}:${isEditing ? 'editing' : 'view'}`}
          value={String(value ?? '')}
          onSave={(v) => onSave(propKey, v)}
          autoOpen={isEditing}
          onCancel={() => onStartEdit(null)}
        />
      )
    case 'boolean': {
      const boolVal = toBooleanValue(value)
      return <BooleanToggle value={boolVal} onToggle={() => onUpdate?.(propKey, !boolVal)} />
    }
    case 'url':
      return <UrlValue {...editProps} />
    case 'color':
      return <ColorEditableValue {...editProps} />
    default:
      return <EditableValue {...editProps} />
  }
}

export function SmartPropertyValueCell(props: SmartCellProps) {
  const { propKey, value, displayMode, isEditing, vaultTags, onSaveList, onStartEdit } = props
  if (Array.isArray(value)) {
    if (displayMode === 'tags') {
      return <TagsValue propKey={propKey} value={value.map(String)} isEditing={isEditing} vaultTags={vaultTags} onSave={onSaveList} onStartEdit={onStartEdit} />
    }
    return <TagPillList items={value.map(String)} onSave={(items) => onSaveList(propKey, items)} label={propKey} />
  }
  return <ScalarValueCell {...props} />
}
