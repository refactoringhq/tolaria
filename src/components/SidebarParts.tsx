import { useEffect, useRef, type ComponentType, type MouseEvent as ReactMouseEvent } from 'react'
import type { SidebarSelection } from '../types'
import { cn } from '@/lib/utils'
import { isSelectionActive } from '../utils/sidebarSelection'
import { getTypeColor } from '../utils/typeColors'
import type { IconProps } from '@phosphor-icons/react'
import { SIDEBAR_COUNT_ACTIVE_CLASS, SIDEBAR_COUNT_HOVER_CLASS, SIDEBAR_ITEM_HOVER_CLASS, SIDEBAR_ITEM_PADDING, type SidebarItemStyle } from './sidebar/sidebarStyles'
import { useSidebarInlineRenameInput } from './sidebar/sidebarHooks'
import { SidebarCountPill, SIDEBAR_COUNT_PILL_IDLE_CLASS } from './sidebar/SidebarNavItem'
import { Input } from './ui/input'
import { translate, type AppLocale } from '../lib/i18n'

export { NavItem, SidebarCountPill, SidebarLoadingCountPill, SIDEBAR_COUNT_PILL_IDLE_CLASS } from './sidebar/SidebarNavItem'
export { VisibilityPopover } from './sidebar/SidebarVisibilityPopover'

export interface SectionGroup {
  label: string
  type: string
  Icon: ComponentType<IconProps>
  customColor?: string | null
}

export interface SectionContentProps {
  group: SectionGroup
  itemCount: number
  selection: SidebarSelection
  onSelect: (sel: SidebarSelection) => void
  onContextMenu: (e: React.MouseEvent, type: string) => void
  dragHandleProps?: Record<string, unknown>
  isRenaming?: boolean
  renameInitialValue?: string
  onRenameSubmit?: (value: string) => void
  onRenameCancel?: () => void
  onStartRename?: (type: string) => void
  onSelectTypeNote?: (type: string) => void
  locale?: AppLocale
}

interface InlineRenameInputProps {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
  locale?: AppLocale
}

interface SectionHeaderLabelProps {
  type: string
  label: string
  isRenaming?: boolean
  renameInitialValue?: string
  onRenameSubmit?: (value: string) => void
  onRenameCancel?: () => void
  onStartRename?: () => void
  locale?: AppLocale
}

interface SectionHeaderCountPillProps {
  itemCount: number
  isActive: boolean
}

interface SectionHeaderProps {
  label: string
  type: string
  Icon: ComponentType<IconProps>
  sectionColor: string
  itemCount: number
  isActive: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  dragHandleProps?: Record<string, unknown>
  isRenaming?: boolean
  renameInitialValue?: string
  onRenameSubmit?: (value: string) => void
  onRenameCancel?: () => void
  onStartRename?: () => void
  onSelectTypeNote?: () => void
  locale?: AppLocale
}

interface InlineRenameOptions {
  isRenaming?: boolean
  onRenameCancel?: () => void
  onRenameSubmit?: (value: string) => void
}

interface InlineRenameHandlers {
  onRenameCancel: () => void
  onRenameSubmit: (value: string) => void
}

// --- Section Content ---

export function SectionContent(options: SectionContentProps) {
  const {
    group,
    itemCount,
    selection,
    onSelect,
    onContextMenu,
    dragHandleProps,
    isRenaming,
    renameInitialValue,
    onRenameSubmit,
    onRenameCancel,
    locale,
    onStartRename,
    onSelectTypeNote,
  } = options
  const { label, type, Icon, customColor } = group
  const sectionColor = getTypeColor(type, customColor)

  return (
    <SectionHeader
      label={label}
      type={type}
      Icon={Icon}
      sectionColor={sectionColor}
      itemCount={itemCount}
      isActive={isSelectionActive(selection, { kind: 'sectionGroup', type })}
      onSelect={() => onSelect({ kind: 'sectionGroup', type })}
      onContextMenu={(e) => onContextMenu(e, type)}
      dragHandleProps={dragHandleProps}
      isRenaming={isRenaming}
      renameInitialValue={renameInitialValue}
      onRenameSubmit={onRenameSubmit}
      onRenameCancel={onRenameCancel}
      onStartRename={onStartRename ? () => onStartRename(type) : undefined}
      onSelectTypeNote={onSelectTypeNote ? () => onSelectTypeNote(type) : undefined}
      locale={locale}
    />
  )
}

function getSectionHeaderBackground(isActive: boolean) {
  if (!isActive) return undefined
  return { background: 'var(--sidebar-item-highlight)', boxShadow: 'var(--shadow-sidebar)' }
}

function getSectionHeaderIconWeight(isActive: boolean): IconProps['weight'] {
  return isActive ? 'fill' : 'regular'
}

function getSectionSelectHandler(isRenaming: boolean | undefined, onSelect: () => void) {
  if (isRenaming) return undefined
  return onSelect
}

function getSectionContextMenuHandler(isRenaming: boolean | undefined, onContextMenu: (e: React.MouseEvent) => void) {
  if (isRenaming) return undefined
  return onContextMenu
}

function resolveInlineRenameHandlers({
  isRenaming,
  onRenameCancel,
  onRenameSubmit,
}: InlineRenameOptions): InlineRenameHandlers | null {
  if (!isRenaming || !onRenameSubmit || !onRenameCancel) return null
  return { onRenameCancel, onRenameSubmit }
}

function SectionHeaderLabel(options: SectionHeaderLabelProps) {
  const {
    type,
    label,
    isRenaming,
    renameInitialValue,
    onRenameSubmit,
    onRenameCancel,
    onStartRename,
    locale,
  } = options
  const inlineRenameHandlers = resolveInlineRenameHandlers({
    isRenaming,
    onRenameCancel,
    onRenameSubmit,
  })

  if (inlineRenameHandlers) {
    return (
      <InlineRenameInput
        key={`rename-${type}`}
        initialValue={renameInitialValue ?? label}
        onSubmit={inlineRenameHandlers.onRenameSubmit}
        onCancel={inlineRenameHandlers.onRenameCancel}
        locale={locale}
      />
    )
  }

  return (
    <button
      type="button"
      className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[13px] font-medium text-foreground"
      style={{
        marginLeft: 4,
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onStartRename?.()
      }}
    >
      {label}
    </button>
  )
}

function SectionHeaderCountPill({
  itemCount,
  isActive,
}: SectionHeaderCountPillProps) {
  if (itemCount <= 0) return null
  return (
    <SidebarCountPill
      count={itemCount}
      className={cn(isActive ? SIDEBAR_COUNT_ACTIVE_CLASS : SIDEBAR_COUNT_PILL_IDLE_CLASS, SIDEBAR_COUNT_HOVER_CLASS)}
    />
  )
}

function SectionHeader(options: SectionHeaderProps) {
  const {
    label,
    type,
    Icon,
    sectionColor,
    itemCount,
    isActive,
    onSelect,
    onContextMenu,
    dragHandleProps,
    isRenaming,
    renameInitialValue,
    onRenameSubmit,
    onRenameCancel,
    onStartRename,
    onSelectTypeNote,
    locale,
  } = options
  const headerRef = useRef<HTMLDivElement>(null)
  const selectHandler = getSectionSelectHandler(isRenaming, onSelect)
  const contextMenuHandler = getSectionContextMenuHandler(isRenaming, onContextMenu)
  const doubleClickHandler = !isRenaming ? onSelectTypeNote : undefined
  const rowStyle: SidebarItemStyle = {
    padding: SIDEBAR_ITEM_PADDING.withCount,
    borderRadius: 'var(--radius-xl)',
    gap: 4,
    ...getSectionHeaderBackground(isActive),
  }

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const handleClick = () => selectHandler?.()
    const handleContextMenu = (event: MouseEvent) => contextMenuHandler?.(event as unknown as ReactMouseEvent)
    const handleDoubleClick = () => doubleClickHandler?.()

    header.addEventListener('click', handleClick)
    header.addEventListener('contextmenu', handleContextMenu)
    header.addEventListener('dblclick', handleDoubleClick)
    return () => {
      header.removeEventListener('click', handleClick)
      header.removeEventListener('contextmenu', handleContextMenu)
      header.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [contextMenuHandler, doubleClickHandler, selectHandler])

  return (
    <div
      ref={headerRef}
      className={cn(
        'group/section group/sidebar-row flex cursor-pointer select-none items-center justify-between rounded transition-colors',
        SIDEBAR_ITEM_HOVER_CLASS,
      )}
      style={rowStyle}
      {...dragHandleProps}
    >
      <div className="flex min-w-0 flex-1 items-center" style={{ gap: 4 }}>
        <Icon size={16} weight={getSectionHeaderIconWeight(isActive)} style={{ color: sectionColor, flexShrink: 0 }} />
        <SectionHeaderLabel
          type={type}
          label={label}
          isRenaming={isRenaming}
          renameInitialValue={renameInitialValue}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          onStartRename={onStartRename}
          locale={locale}
        />
      </div>
      {!isRenaming && <SectionHeaderCountPill itemCount={itemCount} isActive={isActive} />}
    </div>
  )
}

function InlineRenameInput({
  initialValue,
  onSubmit,
  onCancel,
  locale,
}: InlineRenameInputProps) {
  const { handleKeyDown, inputRef, setValue, submitValue, value } = useSidebarInlineRenameInput({
    initialValue,
    onCancel,
    onSubmit: (nextValue) => {
      onSubmit(nextValue.trim())
      return true
    },
  })

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        void submitValue()
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label={translate(locale ?? 'en', 'sidebar.section.name')}
      className="h-auto min-h-0 flex-1 rounded border-primary bg-background px-1 py-px text-[13px] font-medium text-foreground"
    />
  )
}
