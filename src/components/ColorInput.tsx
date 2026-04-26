import { useState, useRef, useCallback } from 'react'
import { isValidCssColor, toHexColor } from '../utils/colorUtils'

/**
 * Inline color swatch button that opens a native color picker.
 * Shows nothing if the value is not a valid CSS color.
 */
export function ColorSwatch({ color, onChange }: {
  color: string
  onChange?: (hex: string) => void
}) {
  const hex = toHexColor(color) ?? '#000000'
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }, [])

  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        type="button"
        className="relative size-4 shrink-0 cursor-pointer rounded-[3px] border border-border p-0 transition-shadow hover:ring-1 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
        style={{ background: color }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title="Open color picker"
        aria-label={`Color: ${color}. Click to open color picker`}
        data-testid="color-swatch"
      >
        <input
          ref={inputRef}
          type="color"
          value={hex}
          onChange={handleChange}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="color-picker-input"
        />
      </button>
    </span>
  )
}

/**
 * Editable text field with an inline color swatch.
 * The swatch only appears when the value is a valid CSS color.
 */
export function ColorEditableValue({ value, isEditing, onStartEdit, onSave, onCancel }: {
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onSave: (newValue: string) => void
  onCancel: () => void
}) {
  const [editValue, setEditValue] = useState(value)
  const showSwatch = isValidCssColor(isEditing ? editValue : value)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave(editValue)
    else if (e.key === 'Escape') { setEditValue(value); onCancel() }
  }

  const handlePickerChange = useCallback((hex: string) => {
    if (isEditing) {
      setEditValue(hex)
    }
    onSave(hex)
  }, [isEditing, onSave])

  if (isEditing) {
    return (
      <span className="flex w-full items-center gap-1.5">
        {showSwatch && <ColorSwatch color={editValue} onChange={handlePickerChange} />}
        <input
          className="w-full rounded border border-ring bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onSave(editValue)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          data-testid="color-text-input"
        />
      </span>
    )
  }

  return (
    <span className="inline-flex h-6 min-w-0 items-center gap-1.5">
      {showSwatch && <ColorSwatch color={value} onChange={handlePickerChange} />}
      <span
        className="min-w-0 cursor-pointer truncate rounded px-1 text-left text-[12px] text-secondary-foreground transition-colors hover:bg-muted"
        onClick={onStartEdit}
        title={value || 'Click to edit'}
      >
        {value || '\u2014'}
      </span>
    </span>
  )
}
