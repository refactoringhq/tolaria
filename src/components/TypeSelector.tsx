import type { FrontmatterValue } from './Inspector'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { getTypeIcon } from './NoteItem'

const TYPE_NONE = '__none__'

function TypeSelectorItem({ type, typeColorKeys, typeIconKeys }: {
  type: string; typeColorKeys: Record<string, string | null>; typeIconKeys: Record<string, string | null>
}) {
  const Icon = getTypeIcon(type, typeIconKeys[type])
  const color = getTypeColor(type, typeColorKeys[type])
  return (
    <>
      {/* eslint-disable-next-line react-hooks/static-components -- icon from static map lookup */}
      <Icon width={14} height={14} style={{ color }} />
      {type}
    </>
  )
}

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

export function TypeSelector({ isA, customColorKey, availableTypes, typeColorKeys, typeIconKeys, onUpdateProperty, onNavigate }: {
  isA?: string | null; customColorKey?: string | null; availableTypes: string[]
  typeColorKeys: Record<string, string | null>
  typeIconKeys: Record<string, string | null>
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
              <TypeSelectorItem type={type} typeColorKeys={typeColorKeys} typeIconKeys={typeIconKeys} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
