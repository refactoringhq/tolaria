import { useDraggable } from '@dnd-kit/core'
import { type CSSProperties, type MouseEvent, memo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../../types'
import { getTypeColor } from '../../../utils/typeColors'
import { NoteTitleIcon } from '../../NoteTitleIcon'
import { PropertyChips } from '../../note-item/PropertyChips'
import { cardDisplayProperties } from '../kanbanModel'
import type { CalendarItem } from './calendarModel'

/** A ghost Button reset to a block slot, so an item is one native, focusable control like a Kanban card. */
const CALENDAR_ITEM_SLOT_CLASSNAME = 'calendar-item-slot block h-full w-full min-w-0 whitespace-normal rounded-md p-0 text-left font-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring [&_svg]:!size-[11px]'

export interface CalendarItemContext {
  cardProperties: string[]
  allEntries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
  /** Localized screen-reader role description for an item. */
  itemRole: string
  draggable: boolean
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
}

export interface CalendarItemFaceProps {
  entry: VaultEntry
  context: CalendarItemContext
  className?: string
  continuesBefore?: boolean
  continuesAfter?: boolean
}

function typeAccent(entry: VaultEntry, typeEntryMap: Record<string, VaultEntry>): CSSProperties {
  const color = getTypeColor(entry.isA ?? 'Note', typeEntryMap[entry.isA ?? '']?.color)
  return { '--calendar-item-accent': color } as CSSProperties
}

/** The visual item, shared by the grid, the "+N more" popover, the tray and the drag preview. */
export function CalendarItemFace({ entry, context, className, continuesBefore, continuesAfter }: CalendarItemFaceProps) {
  const displayProps = cardDisplayProperties(entry, context.cardProperties, context.typeEntryMap, context.displayPropsOverride)
  return (
    <span
      className={cn(
        'calendar-item flex h-full min-w-0 flex-col justify-center gap-0.5 px-2 py-0.5',
        continuesBefore && 'calendar-item--continues-before',
        continuesAfter && 'calendar-item--continues-after',
        className,
      )}
      style={typeAccent(entry, context.typeEntryMap)}
    >
      <span className="flex min-w-0 items-center gap-1 text-[12px] font-medium leading-5 text-foreground" data-testid="calendar-item-title">
        <NoteTitleIcon icon={entry.icon} size={13} testId="calendar-item-icon" />
        <span className="truncate">{entry.title}</span>
      </span>
      {displayProps.length > 0 && (
        <span className="calendar-item__fields block min-w-0 overflow-hidden whitespace-nowrap">
          <PropertyChips entry={entry} displayProps={displayProps} allEntries={context.allEntries} typeEntryMap={context.typeEntryMap} onOpenNote={context.onOpen} />
        </span>
      )}
    </span>
  )
}

export interface CalendarItemButtonProps {
  dragId: string
  item: CalendarItem
  context: CalendarItemContext
  selected: boolean
  justDropped: boolean
  style?: CSSProperties
  continuesBefore?: boolean
  continuesAfter?: boolean
}

/** An item in the grid, the tray or a popover: click opens the note, drag reschedules it. */
export const CalendarItemButton = memo(function CalendarItemButton(props: CalendarItemButtonProps) {
  const { dragId, item, context, selected, justDropped, style } = props
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: { item }, disabled: !context.draggable })
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="ghost"
      {...attributes}
      {...listeners}
      aria-roledescription={context.itemRole}
      aria-label={item.entry.title}
      className={cn(CALENDAR_ITEM_SLOT_CLASSNAME, isDragging && 'calendar-item-slot--placeholder')}
      style={style}
      onClick={(event) => context.onOpen(item.entry, event)}
      data-testid="calendar-item"
      data-path={item.entry.path}
      data-selected={selected ? 'true' : undefined}
    >
      <CalendarItemFace
        entry={item.entry}
        context={context}
        continuesBefore={props.continuesBefore}
        continuesAfter={props.continuesAfter}
        className={cn(selected && 'calendar-item--selected', justDropped && 'calendar-item--dropped')}
      />
    </Button>
  )
})
