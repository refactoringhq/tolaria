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
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5">
      <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
      <div className="min-w-0">
        {onNavigate ? (
          <button
            className="min-w-0 max-w-full truncate border-none cursor-pointer ring-inset hover:ring-1 hover:ring-current"
            style={{ background: getTypeLightColor(isA, customColorKey), color: getTypeColor(isA, customColorKey), borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}
            onClick={() => onNavigate(isA.toLowerCase())} title={isA}
          >{isA}</button>
        ) : (
          <span className="text-[12px] text-secondary-foreground">{isA}</span>
        )}
      </div>
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

  const typeColor = isA ? getTypeColor(isA, typeColorKeys[isA] ?? customColorKey) : undefined
  const typeLightColor = isA ? getTypeLightColor(isA, typeColorKeys[isA] ?? customColorKey) : undefined

  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 px-1.5" data-testid="type-selector">
      <span className="font-mono-overline shrink-0 text-muted-foreground">Type</span>
      <div className="min-w-0">
        <Select value={currentValue} onValueChange={v => onUpdateProperty('type', v === TYPE_NONE ? null : v)}>
          <SelectTrigger
            size="sm"
            className={`h-auto max-w-full gap-1 border-none shadow-none [&_svg]:text-current ring-inset${isA ? ' hover:ring-1 hover:ring-current' : ' bg-muted hover:opacity-80'}`}
            style={{
              background: typeLightColor ?? undefined,
              color: typeColor ?? undefined,
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 500,
            }}
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
    </div>
  )
}
