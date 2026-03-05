import { useState, useCallback, useMemo, useRef } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { ColorSwatch } from './ColorInput'
import { getThemeSchema, formatValueForFrontmatter, parseValueFromFrontmatter } from '../utils/themeSchema'
import type { ThemeProperty, ThemeSection, ThemeSubsection } from '../utils/themeSchema'
import type { ThemeManager } from '../hooks/useThemeManager'
import { parseFrontmatter } from '../utils/frontmatter'
import { isValidCssColor } from '../utils/colorUtils'

/** Extract current theme property values from frontmatter content. */
function useThemeValues(content: string | undefined): Record<string, string> {
  return useMemo(() => {
    if (!content) return {}
    const fm = parseFrontmatter(content)
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(fm)) {
      if (typeof value === 'string') result[key] = value
      else if (typeof value === 'number') result[key] = String(value)
      else if (typeof value === 'boolean') result[key] = String(value)
    }
    return result
  }, [content])
}

// --- Individual input components ---

function NumberInput({ property, value, onChange }: {
  property: ThemeProperty
  value: string | number
  onChange: (val: string) => void
}) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '' || raw === '-') return
    const num = parseFloat(raw)
    if (isNaN(num)) return
    if (property.min !== undefined && num < property.min) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange(formatValueForFrontmatter(num, property))
    }, 300)
  }, [onChange, property])

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        defaultValue={numericValue}
        onChange={handleChange}
        min={property.min}
        step={property.unit ? 1 : 0.1}
        className="w-20 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
        data-testid={`theme-input-${property.cssVar}`}
      />
      {property.unit && (
        <span className="text-[11px] text-muted-foreground">{property.unit}</span>
      )}
    </div>
  )
}

function ColorInput({ property, value, onChange }: {
  property: ThemeProperty
  value: string
  onChange: (val: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showSwatch = isValidCssColor(localValue)

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    setLocalValue(newVal)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(newVal), 300)
  }, [onChange])

  const handlePickerChange = useCallback((hex: string) => {
    setLocalValue(hex)
    onChange(hex)
  }, [onChange])

  return (
    <div className="flex items-center gap-1.5">
      {showSwatch && <ColorSwatch color={localValue} onChange={handlePickerChange} />}
      <input
        type="text"
        value={localValue}
        onChange={handleTextChange}
        className="w-28 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
        data-testid={`theme-input-${property.cssVar}`}
      />
    </div>
  )
}

function SelectInput({ property, value, onChange }: {
  property: ThemeProperty
  value: string
  onChange: (val: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-28 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
      data-testid={`theme-input-${property.cssVar}`}
    >
      {property.options?.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  )
}

function TextInput({ property, value, onChange }: {
  property: ThemeProperty
  value: string
  onChange: (val: string) => void
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(newVal), 500)
  }, [onChange])

  return (
    <input
      type="text"
      defaultValue={value}
      onChange={handleChange}
      className="w-40 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
      data-testid={`theme-input-${property.cssVar}`}
    />
  )
}

// --- Property row ---

function PropertyRow({ property, currentValue, onUpdate }: {
  property: ThemeProperty
  currentValue: string | undefined
  onUpdate: (cssVar: string, value: string) => void
}) {
  const displayValue = currentValue !== undefined
    ? parseValueFromFrontmatter(currentValue, property)
    : property.defaultValue
  const isPlaceholder = currentValue === undefined

  const handleChange = useCallback((val: string) => {
    onUpdate(property.cssVar, val)
  }, [property.cssVar, onUpdate])

  return (
    <div
      className="flex items-center justify-between gap-2 py-1"
      style={{ minHeight: 28 }}
    >
      <label
        className="text-xs shrink-0"
        style={{ color: isPlaceholder ? 'var(--muted-foreground)' : 'var(--foreground)', minWidth: 100 }}
      >
        {property.label}
      </label>
      <div className="flex-shrink-0">
        {property.inputType === 'number' && (
          <NumberInput property={property} value={displayValue} onChange={handleChange} />
        )}
        {property.inputType === 'color' && (
          <ColorInput property={property} value={String(displayValue)} onChange={handleChange} />
        )}
        {property.inputType === 'select' && (
          <SelectInput property={property} value={String(displayValue)} onChange={handleChange} />
        )}
        {property.inputType === 'text' && (
          <TextInput property={property} value={String(displayValue)} onChange={handleChange} />
        )}
      </div>
    </div>
  )
}

// --- Collapsible section ---

function CollapsibleSection({ label, defaultOpen, children, testId }: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(prev => !prev)
    }
  }, [])

  return (
    <div data-testid={testId}>
      <button
        type="button"
        className="flex w-full items-center gap-1 border-none bg-transparent p-0 cursor-pointer"
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', padding: '4px 0' }}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <CaretRight
          size={12}
          weight="bold"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
        {label}
      </button>
      {open && (
        <div style={{ paddingLeft: 16 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// --- Section renderers ---

function SubsectionBlock({ subsection, currentValues, onUpdate }: {
  subsection: ThemeSubsection
  currentValues: Record<string, string>
  onUpdate: (cssVar: string, value: string) => void
}) {
  return (
    <CollapsibleSection label={subsection.label} testId={`theme-sub-${subsection.id}`}>
      {subsection.properties.map(prop => (
        <PropertyRow
          key={prop.cssVar}
          property={prop}
          currentValue={currentValues[prop.cssVar]}
          onUpdate={onUpdate}
        />
      ))}
    </CollapsibleSection>
  )
}

function SectionBlock({ section, currentValues, onUpdate }: {
  section: ThemeSection
  currentValues: Record<string, string>
  onUpdate: (cssVar: string, value: string) => void
}) {
  return (
    <CollapsibleSection
      label={section.label}
      defaultOpen={section.id === 'editor'}
      testId={`theme-section-${section.id}`}
    >
      {section.properties.map(prop => (
        <PropertyRow
          key={prop.cssVar}
          property={prop}
          currentValue={currentValues[prop.cssVar]}
          onUpdate={onUpdate}
        />
      ))}
      {section.subsections.map(sub => (
        <SubsectionBlock
          key={sub.id}
          subsection={sub}
          currentValues={currentValues}
          onUpdate={onUpdate}
        />
      ))}
    </CollapsibleSection>
  )
}

// --- Main component ---

export function ThemePropertyEditor({ themeManager }: { themeManager: ThemeManager }) {
  const schema = useMemo(() => getThemeSchema(), [])
  const currentValues = useThemeValues(themeManager.activeThemeContent)

  const handleUpdate = useCallback((cssVar: string, value: string) => {
    themeManager.updateThemeProperty(cssVar, value)
  }, [themeManager])

  if (!themeManager.activeThemeId) {
    return (
      <div className="text-xs text-muted-foreground" style={{ padding: '8px 0' }}>
        Select a theme to customize its properties.
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-1"
      data-testid="theme-property-editor"
      style={{ fontSize: 12 }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
        Editing: <strong>{themeManager.activeTheme?.name ?? 'Theme'}</strong>
      </div>
      {schema.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          currentValues={currentValues}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  )
}
