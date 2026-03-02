import { type ComponentType, useState, useEffect, useRef } from 'react'
import type { VaultEntry, SidebarSelection } from '../types'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { type IconProps } from '@phosphor-icons/react'

export interface SectionGroup {
  label: string
  type: string
  Icon: ComponentType<IconProps>
  customColor?: string | null
}

// eslint-disable-next-line react-refresh/only-export-components -- utility co-located with component
export function isSelectionActive(current: SidebarSelection, check: SidebarSelection): boolean {
  if (current.kind !== check.kind) return false
  switch (check.kind) {
    case 'filter': return (current as typeof check).filter === check.filter
    case 'sectionGroup': return (current as typeof check).type === check.type
    case 'entity':
    case 'topic': return (current as typeof check).entry.path === check.entry.path
    default: return false
  }
}

// --- NavItem ---

export function NavItem({ icon: Icon, label, count, isActive, activeClassName = 'bg-primary/10 text-primary', badgeClassName, badgeStyle, onClick, disabled }: {
  icon: ComponentType<IconProps>
  label: string
  count?: number
  isActive?: boolean
  activeClassName?: string
  badgeClassName?: string
  badgeStyle?: React.CSSProperties
  onClick?: () => void
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="flex select-none items-center gap-2 rounded text-foreground" style={{ padding: '6px 16px', borderRadius: 4, opacity: 0.4, cursor: 'not-allowed' }} title="Coming soon">
        <Icon size={16} />
        <span className="flex-1 text-[13px] font-medium">{label}</span>
      </div>
    )
  }
  return (
    <div
      className={cn("flex cursor-pointer select-none items-center gap-2 rounded transition-colors", isActive ? activeClassName : "text-foreground hover:bg-accent")}
      style={{ padding: '6px 16px', borderRadius: 4 }}
      onClick={onClick}
    >
      <Icon size={16} />
      <span className="flex-1 text-[13px] font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("flex items-center justify-center", badgeClassName)} style={{ height: 20, borderRadius: 9999, padding: '0 6px', fontSize: 10, ...badgeStyle }}>
          {count}
        </span>
      )}
    </div>
  )
}

// --- Section Content ---

export interface SectionContentProps {
  group: SectionGroup
  items: VaultEntry[]
  isCollapsed: boolean
  selection: SidebarSelection
  onSelect: (sel: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onCreateType?: (type: string) => void
  onCreateNewType?: () => void
  onContextMenu: (e: React.MouseEvent, type: string) => void
  onToggle: () => void
  isRenaming?: boolean
  renameInitialValue?: string
  onRenameSubmit?: (value: string) => void
  onRenameCancel?: () => void
}

function childSelection(type: string, entry: VaultEntry): SidebarSelection {
  return type === 'Topic' ? { kind: 'topic', entry } : { kind: 'entity', entry }
}

function resolveCreateHandler(type: string, onCreateType?: (type: string) => void, onCreateNewType?: () => void): (() => void) | undefined {
  const isType = type === 'Type'
  if (!onCreateType && !(isType && onCreateNewType)) return undefined
  return isType ? () => onCreateNewType?.() : () => onCreateType?.(type)
}

export function SectionContent({
  group, items, isCollapsed, selection, onSelect, onSelectNote,
  onCreateType, onCreateNewType, onContextMenu, onToggle,
  isRenaming, renameInitialValue, onRenameSubmit, onRenameCancel,
}: SectionContentProps) {
  const { label, type, Icon, customColor } = group
  const sectionColor = getTypeColor(type, customColor)
  const sectionLightColor = getTypeLightColor(type, customColor)
  const onCreate = resolveCreateHandler(type, onCreateType, onCreateNewType)

  return (
    <>
      <SectionHeader
        label={label} type={type} Icon={Icon}
        sectionColor={sectionColor}
        isCollapsed={isCollapsed}
        isActive={isSelectionActive(selection, { kind: 'sectionGroup', type })}
        showCreate={!!onCreate}
        onSelect={() => onSelect({ kind: 'sectionGroup', type })}
        onContextMenu={(e) => onContextMenu(e, type)}
        onToggle={onToggle}
        onCreate={(e) => { e.stopPropagation(); onCreate?.() }}
        isRenaming={isRenaming}
        renameInitialValue={renameInitialValue}
        onRenameSubmit={onRenameSubmit}
        onRenameCancel={onRenameCancel}
      />
      {!isCollapsed && items.length > 0 && (
        <SectionChildList
          items={items} type={type} selection={selection}
          sectionColor={sectionColor} sectionLightColor={sectionLightColor}
          onSelect={onSelect} onSelectNote={onSelectNote}
        />
      )}
    </>
  )
}

function SectionChildList({ items, type, selection, sectionColor, sectionLightColor, onSelect, onSelectNote }: {
  items: VaultEntry[]; type: string; selection: SidebarSelection
  sectionColor: string; sectionLightColor: string
  onSelect: (sel: SidebarSelection) => void; onSelectNote?: (entry: VaultEntry) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((entry) => {
        const sel = childSelection(type, entry)
        const active = isSelectionActive(selection, sel)
        return (
          <SectionChildItem
            key={entry.path} title={entry.title} isActive={active}
            sectionColor={active ? sectionColor : undefined}
            sectionLightColor={active ? sectionLightColor : undefined}
            onClick={() => { onSelect(sel); onSelectNote?.(entry) }}
          />
        )
      })}
    </div>
  )
}

function InlineRenameInput({ initialValue, onSubmit, onCancel }: {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSubmit(value.trim()) }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel() }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSubmit(value.trim())}
      onClick={(e) => e.stopPropagation()}
      aria-label="Section name"
      className="flex-1 rounded border border-primary bg-background text-[13px] font-medium text-foreground outline-none"
      style={{ padding: '1px 4px' }}
    />
  )
}

function SectionHeader({ label, type, Icon, sectionColor, isCollapsed, isActive, showCreate, onSelect, onContextMenu, onToggle, onCreate, isRenaming, renameInitialValue, onRenameSubmit, onRenameCancel }: {
  label: string; type: string; Icon: ComponentType<IconProps>
  sectionColor: string; isCollapsed: boolean; isActive: boolean; showCreate: boolean
  onSelect: () => void; onContextMenu: (e: React.MouseEvent) => void
  onToggle: () => void; onCreate: (e: React.MouseEvent) => void
  isRenaming?: boolean; renameInitialValue?: string
  onRenameSubmit?: (value: string) => void; onRenameCancel?: () => void
}) {
  return (
    <div
      className={cn("group/section flex cursor-pointer select-none items-center justify-between rounded transition-colors", isActive ? "bg-secondary" : "hover:bg-accent")}
      style={{ padding: '6px 8px 6px 16px', borderRadius: 4, gap: 4 }}
      onClick={() => {
        if (isRenaming) return
        if (isCollapsed) { onToggle(); onSelect() }
        else if (isActive) { onToggle() }
        else { onSelect() }
      }} onContextMenu={isRenaming ? undefined : onContextMenu}
    >
      <div className="flex min-w-0 flex-1 items-center" style={{ gap: 4 }}>
        <Icon size={16} style={{ color: sectionColor, flexShrink: 0 }} />
        {isRenaming && onRenameSubmit && onRenameCancel ? (
          <InlineRenameInput
            key={`rename-${type}`}
            initialValue={renameInitialValue ?? label}
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="text-[13px] font-medium text-foreground" style={{ marginLeft: 4 }}>{label}</span>
        )}
      </div>
      <div className="flex items-center" style={{ gap: 2 }}>
        {showCreate && (
          <button className="flex shrink-0 items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/section:opacity-100 cursor-pointer" style={{ width: 20, height: 20 }} onClick={onCreate} aria-label={type === 'Type' ? 'Create new Type' : `Create new ${type}`} title={type === 'Type' ? 'New Type' : `New ${type}`}>
            <Plus size={14} />
          </button>
        )}
        <button className="flex shrink-0 items-center border-none bg-transparent p-0 text-inherit cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggle() }} aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}>
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
    </div>
  )
}

function SectionChildItem({ title, isActive, sectionColor, sectionLightColor, onClick }: {
  title: string; isActive: boolean
  sectionColor?: string; sectionLightColor?: string
  onClick: () => void
}) {
  return (
    <div
      className={cn("cursor-pointer truncate rounded-md text-[13px] font-normal transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:bg-accent")}
      style={{ padding: '4px 16px 4px 28px', ...(isActive && { backgroundColor: sectionLightColor, color: sectionColor }) }}
      onClick={onClick}
    >
      {title}
    </div>
  )
}

// --- Visibility Popover ---

export function VisibilityPopover({ sections, isSectionVisible, onToggle }: {
  sections: SectionGroup[]
  isSectionVisible: (type: string) => boolean
  onToggle: (type: string) => void
}) {
  return (
    <div
      className="border border-border bg-popover text-popover-foreground"
      style={{ position: 'absolute', top: '100%', left: 6, right: 6, zIndex: 50, borderRadius: 8, padding: '8px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
    >
      <div className="text-[12px] font-semibold text-muted-foreground" style={{ padding: '0 12px 4px' }}>Show in sidebar</div>
      {sections.map(({ label, type, Icon }) => (
        <button key={type} className="flex w-full cursor-pointer items-center border-none bg-transparent transition-colors hover:bg-accent" style={{ padding: '6px 12px', gap: 8 }} onClick={() => onToggle(type)} aria-label={`Toggle ${label}`}>
          <Icon size={14} style={{ color: getTypeColor(type) }} />
          <span className="flex-1 text-left text-[13px] text-foreground">{label}</span>
          <ToggleSwitch on={isSectionVisible(type)} />
        </button>
      ))}
    </div>
  )
}

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div className="flex items-center" style={{ width: 32, height: 18, borderRadius: 9, padding: 2, backgroundColor: on ? 'var(--primary)' : 'var(--muted)', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background-color 150ms' }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'white', transition: 'transform 150ms' }} />
    </div>
  )
}
