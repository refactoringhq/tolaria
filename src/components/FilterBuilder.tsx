import { Plus, X, CalendarBlank } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FilterCondition, FilterOp, FilterGroup, FilterNode } from '../types'

const OPERATORS: { value: FilterOp; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'before', label: 'before' },
  { value: 'after', label: 'after' },
]

const NO_VALUE_OPS = new Set<FilterOp>(['is_empty', 'is_not_empty'])
const DATE_OPS = new Set<FilterOp>(['before', 'after'])

function isFilterGroup(node: FilterNode): node is FilterGroup {
  return 'all' in node || 'any' in node
}

function getGroupChildren(group: FilterGroup): FilterNode[] {
  return 'all' in group ? group.all : group.any
}

function getGroupMode(group: FilterGroup): 'all' | 'any' {
  return 'all' in group ? 'all' : 'any'
}

function setGroupChildren(mode: 'all' | 'any', children: FilterNode[]): FilterGroup {
  return mode === 'all' ? { all: children } : { any: children }
}

const CONTENT_FIELDS = new Set(['body'])

function FieldSelect({ value, fields, onChange }: {
  value: string
  fields: string[]
  onChange: (v: string) => void
}) {
  const isCustom = value !== '' && !fields.includes(value)
  const propertyFields = fields.filter(f => !CONTENT_FIELDS.has(f))
  const contentFields = fields.filter(f => CONTENT_FIELDS.has(f))
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 min-w-[100px] flex-1 gap-1 border-input bg-background px-2 text-sm shadow-none"
      >
        <SelectValue placeholder="field" />
      </SelectTrigger>
      <SelectContent position="popper">
        {isCustom && <SelectItem value={value}>{value}</SelectItem>}
        {propertyFields.map((f) => (
          <SelectItem key={f} value={f}>{f}</SelectItem>
        ))}
        {contentFields.length > 0 && (
          <>
            <SelectSeparator />
            {contentFields.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  )
}

function OperatorSelect({ value, onChange }: {
  value: FilterOp
  onChange: (v: FilterOp) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FilterOp)}>
      <SelectTrigger
        size="sm"
        className="h-8 shrink-0 gap-1 border-input bg-background px-2 text-sm shadow-none"
        style={{ minWidth: 120 }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {OPERATORS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DateValueInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = value ? parseISO(value) : undefined
  const selected = parsed && !isNaN(parsed.getTime()) ? parsed : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid="date-picker-trigger"
          className="h-8 flex-1 min-w-0 justify-start gap-2 px-2 text-sm font-normal"
        >
          <CalendarBlank size={14} className="shrink-0 text-muted-foreground" />
          {selected ? format(selected, 'MMM d, yyyy') : <span className="text-muted-foreground">Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => onChange(day ? format(day, 'yyyy-MM-dd') : '')}
        />
      </PopoverContent>
    </Popover>
  )
}

function TextValueInput({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Input
      className="h-8 flex-1 min-w-0 text-sm"
      placeholder="value"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="filter-value-input"
    />
  )
}

function FilterRow({ condition, fields, onUpdate, onRemove }: {
  condition: FilterCondition
  fields: string[]
  onUpdate: (c: FilterCondition) => void
  onRemove: () => void
}) {
  const isDateOp = DATE_OPS.has(condition.op)
  return (
    <div className="flex items-center gap-1.5">
      <FieldSelect
        value={condition.field}
        fields={fields}
        onChange={(v) => onUpdate({ ...condition, field: v })}
      />
      <OperatorSelect
        value={condition.op}
        onChange={(op) => onUpdate({ ...condition, op })}
      />
      {!NO_VALUE_OPS.has(condition.op) && (
        isDateOp
          ? <DateValueInput value={String(condition.value ?? '')} onChange={(v) => onUpdate({ ...condition, value: v })} />
          : <TextValueInput value={String(condition.value ?? '')} onChange={(v) => onUpdate({ ...condition, value: v })} />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        title="Remove filter"
      >
        <X size={14} />
      </Button>
    </div>
  )
}

function FilterGroupView({ group, fields, depth, onChange, onRemove }: {
  group: FilterGroup
  fields: string[]
  depth: number
  onChange: (g: FilterGroup) => void
  onRemove?: () => void
}) {
  const mode = getGroupMode(group)
  const children = getGroupChildren(group)

  const toggleMode = () => {
    onChange(setGroupChildren(mode === 'all' ? 'any' : 'all', children))
  }

  const updateChild = (index: number, node: FilterNode) => {
    const next = [...children]
    next[index] = node
    onChange(setGroupChildren(mode, next))
  }

  const removeChild = (index: number) => {
    const next = children.filter((_, i) => i !== index)
    onChange(setGroupChildren(mode, next))
  }

  const addCondition = () => {
    onChange(setGroupChildren(mode, [...children, { field: fields[0] ?? 'type', op: 'equals' as FilterOp, value: '' }]))
  }

  const addGroup = () => {
    const nested: FilterGroup = { all: [{ field: fields[0] ?? 'type', op: 'equals' as FilterOp, value: '' }] }
    onChange(setGroupChildren(mode, [...children, nested]))
  }

  return (
    <div className={depth > 0 ? 'ml-3 border-l-2 border-border pl-3 py-1' : ''}>
      <div className="flex items-center gap-2 mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 rounded-full px-2.5 text-[11px] font-medium"
          onClick={toggleMode}
          title={`Switch to ${mode === 'all' ? 'OR' : 'AND'}`}
        >
          {mode === 'all' ? 'AND' : 'OR'}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {mode === 'all' ? 'Match all conditions' : 'Match any condition'}
        </span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onRemove}
            title="Remove group"
          >
            <X size={12} />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {children.map((child, i) =>
          isFilterGroup(child) ? (
            <FilterGroupView
              key={i}
              group={child}
              fields={fields}
              depth={depth + 1}
              onChange={(g) => updateChild(i, g)}
              onRemove={() => removeChild(i)}
            />
          ) : (
            <FilterRow
              key={i}
              condition={child}
              fields={fields}
              onUpdate={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
            />
          )
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
          <Plus size={12} className="mr-1" /> Add filter
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addGroup}>
          <Plus size={12} className="mr-1" /> Add group
        </Button>
      </div>
    </div>
  )
}

export interface FilterBuilderProps {
  group: FilterGroup
  onChange: (group: FilterGroup) => void
  availableFields: string[]
}

export function FilterBuilder({ group, onChange, availableFields }: FilterBuilderProps) {
  const fields = availableFields.length > 0 ? availableFields : ['type']
  return (
    <FilterGroupView
      group={group}
      fields={fields}
      depth={0}
      onChange={onChange}
    />
  )
}
