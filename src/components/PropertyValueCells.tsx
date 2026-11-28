import { ArrowUpRight } from '@phosphor-icons/react'
import { useState, useCallback, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type PropertyDisplayMode,
  DISPLAY_MODE_OPTIONS,
  DISPLAY_MODE_ICONS,
} from '../utils/propertyTypes'
import { StatusDropdown } from './StatusDropdown'
import type { FrontmatterValue } from './Inspector'
import { EditableValue, TagPillList, UrlValue } from './EditableValue'
import { getStatusStyle } from '../utils/statusStyles'
import { TagsDropdown } from './TagsDropdown'
import { getTagStyle } from '../utils/tagStyles'
import { ColorEditableValue } from './ColorInput'
import { IconEditableValue } from './IconEditableValue'
import { PROPERTY_CHIP_STYLE } from './propertyChipStyles'
import { canonicalSystemMetadataKey } from '../utils/systemMetadata'
import { relationshipKindForKey } from '../utils/relationshipKeys'
import { DateValue } from './DatePropertyValue'
import { autoDetectFromValue, createScalarEditProps, type ScalarEditProps, type ScalarRendererProps, type SmartCellProps } from './propertyValueCellModel'
import { getAnchoredDropdownStyle, useAnchoredDropdownPosition } from './anchoredDropdown'

const DISPLAY_MODE_MENU_WIDTH = 140

function showsRelationshipPropertyIcon(propKey: string): boolean {
  return relationshipKindForKey(propKey) !== 'custom'
}

function StatusValue({ propKey, value, isEditing, vaultStatuses, onSave, onStartEdit }: {
  propKey: string; value: FrontmatterValue; isEditing: boolean; vaultStatuses: string[]
  onSave: (key: string, value: string) => void; onStartEdit: (key: string | null) => void
}) {
  const statusStr = String(value)
  const style = getStatusStyle(statusStr)
  const chipStyle = { ...PROPERTY_CHIP_STYLE, backgroundColor: style.bg, '--status-chip-text': style.color }
  return (
    <span className="relative inline-flex min-w-0 items-center">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1.5 border-0 transition-opacity hover:opacity-80"
        style={chipStyle}
        onClick={() => onStartEdit(propKey)}
        data-testid="status-badge"
        data-property-chip-tone="status"
      >
        <span aria-hidden="true" className="status-chip-dot inline-block size-[7px] shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
        {statusStr}
      </button>
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
            className="group/tag relative inline-flex items-center overflow-hidden"
            data-property-chip-tone="tag"
            style={{ ...PROPERTY_CHIP_STYLE, backgroundColor: style.bg, maxWidth: 120 }}
          >
            <span
              className="transition-[max-width] duration-150 group-hover/tag:[mask-image:linear-gradient(to_right,black_60%,transparent_100%)]"
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {tag}
            </span>
            <button type="button"
              className="ml-0.5 max-w-0 overflow-hidden border-none bg-transparent p-0 leading-none opacity-0 transition-all duration-150 group-hover/tag:max-w-[14px] group-hover/tag:opacity-100"
              style={{ fontSize: 11, flexShrink: 0 }}
              onClick={() => handleRemove(tag)}
              title={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        )
      })}
      <button type="button"
        className="inline-flex shrink-0 items-center justify-center border-none bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        style={PROPERTY_CHIP_STYLE}
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

function useNumberValueEdit({ value, onSave, onCancel }: ScalarEditProps) {
  const [editValue, setEditValue] = useState(value)

  function cancel() {
    setEditValue(value)
    onCancel()
  }

  function commit() {
    const trimmed = editValue.trim()
    if (Number.isFinite(Number(trimmed))) {
      onSave(trimmed)
    } else {
      cancel()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') cancel()
  }

  return { editValue, setEditValue, commit, handleKeyDown }
}

function NumberValueInput({ editValue, setEditValue, commit, handleKeyDown }: ReturnType<typeof useNumberValueEdit>) {
  return (
    <Input
      className="h-7 w-full border-ring bg-muted px-2 py-1 text-left font-mono text-[12px] tabular-nums"
      type="text"
      inputMode="decimal"
      value={editValue}
      onChange={(event) => setEditValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      autoFocus
      data-testid="number-input"
    />
  )
}

function NumberValue(props: ScalarEditProps) {
  const edit = useNumberValueEdit(props)
  if (props.isEditing) return <NumberValueInput {...edit} />

  const { value, onStartEdit } = props
  return (
    <button
      type="button"
      className="inline-flex h-6 w-full min-w-0 items-center justify-start overflow-hidden rounded-md border-none bg-muted px-2 text-left font-mono text-[12px] tabular-nums text-foreground transition-colors hover:bg-muted"
      onClick={onStartEdit}
      title={value || 'Click to edit'}
      data-testid="number-display"
    >
      <span className="min-w-0 truncate">{value || '\u2014'}</span>
    </button>
  )
}

export function DisplayModeSelector({ propKey, currentMode, autoMode, onSelect }: {
  propKey: string; currentMode: PropertyDisplayMode; autoMode: PropertyDisplayMode
  onSelect: (key: string, mode: PropertyDisplayMode | null) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const CurrentIcon = Reflect.get(DISPLAY_MODE_ICONS, currentMode) as typeof DISPLAY_MODE_ICONS.text
  const showRelationshipIcon = showsRelationshipPropertyIcon(propKey)

  const handleSelect = (mode: PropertyDisplayMode) => {
    onSelect(propKey, mode === autoMode ? null : mode)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        onClick={() => setOpen(!open)}
        title={`Change ${propKey} type`}
        aria-label={`Change ${propKey} type`}
        data-testid="display-mode-trigger"
      >
        {showRelationshipIcon ? (
          <ArrowUpRight className="size-3.5" data-testid="display-mode-icon-relationship" />
        ) : (
          <CurrentIcon className="size-3.5" data-testid={`display-mode-icon-${currentMode}`} />
        )}
      </button>
      {open && (
        <DisplayModeMenu
          autoMode={autoMode}
          currentMode={currentMode}
          onClose={() => setOpen(false)}
          onSelect={handleSelect}
          triggerRef={triggerRef}
        />
      )}
    </div>
  )
}

function DisplayModeMenu({
  autoMode,
  currentMode,
  onClose,
  onSelect,
  triggerRef,
}: {
  autoMode: PropertyDisplayMode
  currentMode: PropertyDisplayMode
  onClose: () => void
  onSelect: (mode: PropertyDisplayMode) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useAnchoredDropdownPosition({
    anchorRef: triggerRef,
    dropdownRef: menuRef,
    width: DISPLAY_MODE_MENU_WIDTH,
  })

  return createPortal(
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="Close display mode menu"
        className="fixed inset-0 z-[12000]"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className="fixed z-[12001] min-w-[130px] rounded-md border border-border bg-background py-1 shadow-md"
        style={getAnchoredDropdownStyle(null, DISPLAY_MODE_MENU_WIDTH)}
        data-testid="display-mode-menu"
      >
        {DISPLAY_MODE_OPTIONS.map((opt) => (
          <DisplayModeOption
            key={opt.value}
            autoMode={autoMode}
            currentMode={currentMode}
            option={opt}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>,
    document.body,
  )
}

function DisplayModeOption({
  autoMode,
  currentMode,
  onSelect,
  option,
}: {
  autoMode: PropertyDisplayMode
  currentMode: PropertyDisplayMode
  onSelect: (mode: PropertyDisplayMode) => void
  option: typeof DISPLAY_MODE_OPTIONS[number]
}) {
  const OptIcon = DISPLAY_MODE_ICONS[option.value]
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
      onClick={() => onSelect(option.value)}
      data-testid={`display-mode-option-${option.value}`}
    >
      <span className="w-3 text-center text-[10px]">
        {currentMode === option.value ? '\u2713' : ''}
      </span>
      <OptIcon className="size-3.5 text-muted-foreground" />
      {option.label}
      {option.value === autoMode && (
        <span className="ml-auto text-[10px] text-muted-foreground">auto</span>
      )}
    </button>
  )
}

function toBooleanValue(value: FrontmatterValue): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function StatusScalarValue(props: SmartCellProps) {
  return <StatusValue {...props} value={props.value ?? ''} />
}

function TagsScalarValue(props: SmartCellProps) {
  return <TagsValue {...props} value={props.value ? [String(props.value)] : []} onSave={props.onSaveList} />
}

function DateScalarValue({ propKey, value, locale, isEditing, onSave, onStartEdit }: SmartCellProps) {
  return (
    <DateValue
      key={`${propKey}:${isEditing ? 'editing' : 'view'}`}
      value={String(value ?? '')}
      locale={locale}
      onSave={(nextValue) => onSave(propKey, nextValue)}
      autoOpen={isEditing}
      onCancel={() => onStartEdit(null)}
    />
  )
}

function BooleanScalarValue({ value, onUpdate, propKey }: SmartCellProps) {
  const checked = toBooleanValue(value)
  return <BooleanToggle value={checked} onToggle={() => onUpdate?.(propKey, !checked)} />
}

function renderScalarDisplayMode(props: ScalarRendererProps, mode: PropertyDisplayMode) {
  switch (mode) {
    case 'status': return <StatusScalarValue {...props} />
    case 'tags': return <TagsScalarValue {...props} />
    case 'date': return <DateScalarValue {...props} />
    case 'number': return <NumberValue {...props.editProps} />
    case 'boolean': return <BooleanScalarValue {...props} />
    case 'url': return <UrlValue {...props.editProps} />
    case 'color': return <ColorEditableValue {...props.editProps} />
    default: return <EditableValue {...props.editProps} />
  }
}

function ScalarValueCell(props: SmartCellProps) {
  const { propKey, value, displayMode } = props
  const editProps = createScalarEditProps(props)

  if (canonicalSystemMetadataKey(propKey) === '_icon') {
    return <IconEditableValue {...editProps} />
  }

  const resolvedMode = displayMode === 'text' ? autoDetectFromValue(propKey, value) : displayMode
  return renderScalarDisplayMode({ ...props, editProps }, resolvedMode)
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
