import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { translate, type AppLocale, type TranslationKey } from '../lib/i18n'
import { type SortOption, type SortDirection, getDefaultDirection, SORT_OPTIONS } from '../utils/noteListHelpers'
import { getAnchoredDropdownStyle, useAnchoredDropdownPosition } from './anchoredDropdown'

interface SortItem {
  value: SortOption
  label: string
}

const SORT_LABEL_KEYS = {
  modified: 'noteList.sort.modified',
  created: 'noteList.sort.created',
  title: 'noteList.sort.title',
  status: 'noteList.sort.status',
} satisfies Record<string, TranslationKey>
const SORT_LABEL_KEYS_BY_OPTION = new Map<string, TranslationKey>(Object.entries(SORT_LABEL_KEYS))
const SORT_MENU_WIDTH = 170
const SORT_MENU_MAX_HEIGHT = 280
const SORT_MENU_MIN_HEIGHT = 160
const SORT_MENU_OFFSET = 4
const SORT_MENU_VIEWPORT_PADDING = 8

type SortMenuAction = { type: 'close' } | { type: 'focus'; index: number }

function getLocalizedSortOptionLabel(option: SortOption, locale: AppLocale): string {
  if (option.startsWith('property:')) return option.slice('property:'.length)
  return translate(locale, SORT_LABEL_KEYS_BY_OPTION.get(option) ?? 'noteList.sort.modified')
}

function buildSortItems(locale: AppLocale, customProperties?: string[]): SortItem[] {
  const builtInItems = SORT_OPTIONS.map(({ value }) => ({
    value,
    label: getLocalizedSortOptionLabel(value, locale),
  }))
  const customItems = (customProperties ?? []).map((key) => ({
    value: `property:${key}` as SortOption,
    label: key,
  }))
  return [...builtInItems, ...customItems]
}

function resolveFocusedIndex(groupLabel: string, current: SortOption, sortItems: SortItem[]) {
  const activeHTMLElement = document.activeElement
  if (activeHTMLElement instanceof HTMLElement) {
    const activeIndexText = activeHTMLElement.dataset.sortItemIndex
    const activeIndex = activeIndexText === undefined ? -1 : Number(activeIndexText)
    if (activeHTMLElement.dataset.sortGroupLabel === groupLabel && activeIndex >= 0) return activeIndex
  }

  const currentIndex = sortItems.findIndex((item) => item.value === current)
  return currentIndex >= 0 ? currentIndex : 0
}

function focusSortItem(sortButtonRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>, index: number) {
  sortButtonRefs.current.at(index)?.focus()
}

function resolveSortMenuAction(key: string, focusIndex: number, itemCount: number): SortMenuAction | null {
  const lastIndex = itemCount - 1

  switch (key) {
    case 'Escape':
      return { type: 'close' }
    case 'ArrowDown':
      return { type: 'focus', index: Math.min(lastIndex, focusIndex + 1) }
    case 'ArrowUp':
      return { type: 'focus', index: Math.max(0, focusIndex - 1) }
    case 'Home':
      return { type: 'focus', index: 0 }
    case 'End':
      return { type: 'focus', index: lastIndex }
    default:
      return null
  }
}

function selectOnKeyboard(
  event: React.KeyboardEvent<HTMLButtonElement>,
  value: SortOption,
  direction: SortDirection,
  onSelect: (opt: SortOption, dir: SortDirection) => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onSelect(value, direction)
}

function getDirectionButtonClass(isActive: boolean, activeDirection: SortDirection, buttonDirection: SortDirection) {
  return cn(
    'flex items-center rounded p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive && activeDirection === buttonDirection ? 'text-foreground' : 'text-muted-foreground opacity-40',
  )
}

function useSortMenuDismissal({
  open,
  containerRef,
  menuRef,
  onDismiss,
}: {
  open: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  menuRef: React.RefObject<HTMLDivElement | null>
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      onDismiss()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [containerRef, menuRef, onDismiss, open])
}

function useSortDropdownState({
  groupLabel,
  current,
  sortItems,
  onChange,
}: {
  groupLabel: string
  current: SortOption
  sortItems: SortItem[]
  onChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sortButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const closeMenu = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  const dismissMenu = useCallback(() => setOpen(false), [])
  useAnchoredDropdownPosition({
    open,
    anchorRef: triggerRef,
    dropdownRef: menuRef,
    width: SORT_MENU_WIDTH,
    maxHeight: SORT_MENU_MAX_HEIGHT,
    minHeight: SORT_MENU_MIN_HEIGHT,
    offset: SORT_MENU_OFFSET,
    viewportPadding: SORT_MENU_VIEWPORT_PADDING,
  })

  useSortMenuDismissal({ open, containerRef, menuRef, onDismiss: dismissMenu })

  useEffect(() => {
    if (!open) return
    focusSortItem(sortButtonRefs, resolveFocusedIndex(groupLabel, current, sortItems))
  }, [current, groupLabel, open, sortItems])

  const handleSelect = useCallback(
    (option: SortOption, nextDirection: SortDirection) => {
    onChange(groupLabel, option, nextDirection)
    closeMenu()
    },
    [closeMenu, groupLabel, onChange],
  )

  const handleMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
    const action = resolveSortMenuAction(
      event.key,
      resolveFocusedIndex(groupLabel, current, sortItems),
      sortItems.length,
    )
    if (!action) return

    event.preventDefault()
    if (action.type === 'close') {
      closeMenu()
      return
    }

    focusSortItem(sortButtonRefs, action.index)
    },
    [closeMenu, current, groupLabel, sortItems],
  )
  const toggleMenu = useCallback(() => {
    if (open) {
      setOpen(false)
      return
    }

    setOpen(true)
  }, [open])

  return {
    open,
    toggleMenu,
    containerRef,
    menuRef,
    triggerRef,
    sortButtonRefs,
    handleSelect,
    handleMenuKeyDown,
  }
}

const LABELED_SORT_TRIGGER_CLASSNAME = 'h-auto gap-0.5 rounded px-1 py-0.5 has-[>svg]:px-1 text-muted-foreground transition-colors hover:bg-accent dark:hover:bg-accent hover:text-foreground'

/** Icon-only triggers take the note-list header's shared button class; labeled ones keep the compact group-header pill. */
function sortTriggerClassName(open: boolean, iconButtonClassName: string | undefined) {
  if (iconButtonClassName !== undefined) return iconButtonClassName
  return cn(LABELED_SORT_TRIGGER_CLASSNAME, open && 'bg-accent text-foreground')
}

function SortDropdownTrigger(options: {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  current: SortOption
  groupLabel: string
  direction: SortDirection
  locale: AppLocale
  iconButtonClassName?: string
  onToggle: () => void
}) {
  const { triggerRef, open, current, groupLabel, direction, locale, iconButtonClassName, onToggle } = options
  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown
  const currentLabel = getLocalizedSortOptionLabel(current, locale)
  const title = translate(locale, 'noteList.sort.by', { label: currentLabel })
  const iconOnly = iconButtonClassName !== undefined

  return (
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon-xs' : 'xs'}
      className={sortTriggerClassName(open, iconButtonClassName)}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      title={title}
      aria-label={iconOnly ? title : undefined}
      aria-haspopup="menu"
      aria-expanded={open}
      data-testid={`sort-button-${groupLabel}`}
    >
      <DirectionIcon size={iconOnly ? 16 : 12} data-testid={`sort-direction-icon-${groupLabel}`} />
      {!iconOnly && <span className="text-[10px] font-medium">{currentLabel}</span>}
    </Button>
  )
}

function SortDropdownMenu(options: {
  open: boolean
  groupLabel: string
  current: SortOption
  direction: SortDirection
  sortItems: SortItem[]
  sortButtonRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>
  menuRef: React.RefObject<HTMLDivElement | null>
  locale: AppLocale
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onSelect: (option: SortOption, nextDirection: SortDirection) => void
}) {
  const { open, groupLabel, current, direction, sortItems, sortButtonRefs, menuRef, locale, onKeyDown, onSelect } =
    options
  if (!open) return null

  const hasCustom = sortItems.length > SORT_OPTIONS.length
  const builtInOptionCount = SORT_OPTIONS.length

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={translate(locale, 'noteList.sort.menu', {
        label: groupLabel,
      })}
      className="fixed z-[12000] rounded-md border border-border bg-popover p-1 shadow-md"
      style={{
        ...getAnchoredDropdownStyle(null, SORT_MENU_WIDTH),
        maxHeight: SORT_MENU_MAX_HEIGHT,
        overflowY: 'auto',
      }}
      onKeyDown={onKeyDown}
      data-testid={`sort-menu-${groupLabel}`}
    >
      {sortItems.map((item, index) => (
        <SortRow
          key={item.value}
          index={index}
          groupLabel={groupLabel}
          value={item.value}
          label={item.label}
          current={current}
          direction={direction}
          buttonRef={(node) => {
            Reflect.set(sortButtonRefs.current, index, node)
          }}
          showSeparator={hasCustom && index === builtInOptionCount}
          locale={locale}
          onSelect={onSelect}
        />
      ))}
    </div>,
    document.body,
  )
}

interface SortDropdownProps {
  groupLabel: string
  current: SortOption
  direction: SortDirection
  customProperties?: string[]
  locale?: AppLocale
  /** Renders the trigger as an icon-only header Button with this class; the sort property stays in the tooltip and menu. */
  iconButtonClassName?: string
  onChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
}

export function SortDropdown(options: SortDropdownProps) {
  const { groupLabel, current, direction, customProperties, locale = 'en', iconButtonClassName, onChange } = options
  const sortItems = useMemo(() => buildSortItems(locale, customProperties), [customProperties, locale])
  const { open, toggleMenu, containerRef, menuRef, triggerRef, sortButtonRefs, handleSelect, handleMenuKeyDown } =
    useSortDropdownState({
    groupLabel,
    current,
    sortItems,
    onChange,
  })

  return (
    <div ref={containerRef} className="relative" style={{ zIndex: open ? 10 : 0 }}>
      <SortDropdownTrigger
        triggerRef={triggerRef}
        open={open}
        current={current}
        groupLabel={groupLabel}
        direction={direction}
        locale={locale}
        iconButtonClassName={iconButtonClassName}
        onToggle={toggleMenu}
      />
      <SortDropdownMenu
        open={open}
        groupLabel={groupLabel}
        current={current}
        direction={direction}
        sortItems={sortItems}
        sortButtonRefs={sortButtonRefs}
        menuRef={menuRef}
        locale={locale}
        onKeyDown={handleMenuKeyDown}
        onSelect={handleSelect}
      />
    </div>
  )
}

function SortRow(options: {
  index: number
  groupLabel: string
  value: SortOption
  label: string
  current: SortOption
  direction: SortDirection
  buttonRef: (node: HTMLButtonElement | null) => void
  showSeparator: boolean
  locale: AppLocale
  onSelect: (opt: SortOption, dir: SortDirection) => void
}) {
  const { index, groupLabel, value, label, current, direction, buttonRef, showSeparator, locale, onSelect } = options
  const isActive = value === current
  const defaultDirection = isActive ? direction : getDefaultDirection(value)
  const itemData = {
    'data-sort-group-label': groupLabel,
    'data-sort-item-index': String(index),
  }

  return (
    <>
      {showSeparator && <div className="mx-2 my-1 border-t border-border" data-testid="sort-separator" />}
      <div
        className={cn(
          'flex items-center justify-between gap-1 rounded px-1 text-[12px] text-popover-foreground hover:bg-accent',
          isActive && 'bg-accent font-medium',
        )}
        style={{ minHeight: 28 }}
      >
        <button
          ref={buttonRef}
          type="button"
          role="menuitemradio"
          aria-checked={isActive}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-inherit hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(value, defaultDirection)
          }}
          onKeyDown={(event) => selectOnKeyboard(event, value, defaultDirection, onSelect)}
          data-testid={`sort-option-${value}`}
          {...itemData}
        >
          <span className="truncate">{label}</span>
        </button>
        <span className="flex items-center gap-0.5">
          <SortDirectionButton
            value={value}
            direction="asc"
            activeDirection={direction}
            isActive={isActive}
            onSelect={onSelect}
            icon={<ArrowUp size={12} />}
            itemData={itemData}
            locale={locale}
          />
          <SortDirectionButton
            value={value}
            direction="desc"
            activeDirection={direction}
            isActive={isActive}
            onSelect={onSelect}
            icon={<ArrowDown size={12} />}
            itemData={itemData}
            locale={locale}
          />
        </span>
      </div>
    </>
  )
}

function SortDirectionButton(options: {
  value: SortOption
  direction: SortDirection
  activeDirection: SortDirection
  isActive: boolean
  onSelect: (opt: SortOption, dir: SortDirection) => void
  icon: React.ReactNode
  itemData: Record<string, string>
  locale: AppLocale
}) {
  const { value, direction, activeDirection, isActive, onSelect, icon, itemData, locale } = options
  return (
    <button
      type="button"
      className={getDirectionButtonClass(isActive, activeDirection, direction)}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(value, direction)
      }}
      data-testid={`sort-dir-${direction}-${value}`}
      title={translate(locale, direction === 'asc' ? 'noteList.sort.ascending' : 'noteList.sort.descending')}
      {...itemData}
    >
      {icon}
    </button>
  )
}
