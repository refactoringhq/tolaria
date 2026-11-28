import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { SIDEBAR_COUNT_ACTIVE_CLASS, SIDEBAR_COUNT_HOVER_CLASS, SIDEBAR_ITEM_HOVER_CLASS, SIDEBAR_ITEM_PADDING } from './sidebarStyles'

interface SidebarNavIconProps {
  Icon: ComponentType<IconProps>
  emoji?: string | null
  iconSize: number
  isActive?: boolean
}

interface SidebarCountPillProps {
  count: number
  className?: string
  style?: React.CSSProperties
  compact?: boolean
  testId?: string
}

interface SidebarLoadingCountPillProps {
  compact?: boolean
  testId?: string
}

interface NavItemLabelProps {
  label: string
  compact?: boolean
}

interface NavItemCountProps {
  count?: number
  countLoading?: boolean
  className?: string
  style?: React.CSSProperties
  compact?: boolean
}

interface DisabledNavItemProps {
  Icon: ComponentType<IconProps>
  emoji?: string | null
  label: string
  compact?: boolean
  disabledTooltip?: string
  padding: ReturnType<typeof getNavItemPadding>
}

interface ClickableNavItemProps {
  Icon: ComponentType<IconProps>
  emoji?: string | null
  label: string
  count?: number
  countLoading?: boolean
  isActive?: boolean
  activeClassName: string
  badgeClassName?: string
  badgeStyle?: React.CSSProperties
  activeBadgeClassName?: string
  activeBadgeStyle?: React.CSSProperties
  onClick?: () => void
  compact?: boolean
  padding: ReturnType<typeof getNavItemPadding>
}

interface NavItemProps {
  icon: ComponentType<IconProps>
  emoji?: string | null
  label: string
  count?: number
  countLoading?: boolean
  isActive?: boolean
  activeClassName?: string
  badgeClassName?: string
  badgeStyle?: React.CSSProperties
  activeBadgeClassName?: string
  activeBadgeStyle?: React.CSSProperties
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  compact?: boolean
}

const SIDEBAR_COUNT_PILL_STYLE = {
  borderRadius: 9999,
  padding: '0 6px',
  fontSize: 10,
  fontVariantNumeric: 'tabular-nums',
} as const

/** Count backgrounds stay transparent in every row state. */
export const SIDEBAR_COUNT_PILL_IDLE_CLASS = 'bg-transparent text-count-pill-text'

// --- NavItem ---

function hasSidebarCount(count?: number): count is number {
  return count !== undefined && count > 0
}

function getNavItemPadding(compact: boolean | undefined, hasCount: boolean) {
  if (compact) return hasCount ? SIDEBAR_ITEM_PADDING.compactWithCount : SIDEBAR_ITEM_PADDING.compact
  return hasCount ? SIDEBAR_ITEM_PADDING.withCount : SIDEBAR_ITEM_PADDING.regular
}

function getNavItemIconSize(compact?: boolean) {
  return compact ? 14 : 16
}

function getNavItemTextClass(compact?: boolean) {
  return compact ? 'text-[12px]' : 'text-[13px]'
}

function resolveBadgeClassName(
  isActive: boolean | undefined,
  activeBadgeClassName: string | undefined,
  badgeClassName: string | undefined,
) {
  if (isActive && activeBadgeClassName) return activeBadgeClassName
  return badgeClassName
}

function resolveBadgeStyle(
  isActive: boolean | undefined,
  activeBadgeClassName: string | undefined,
  activeBadgeStyle: React.CSSProperties | undefined,
  badgeStyle: React.CSSProperties | undefined,
) {
  if (isActive && activeBadgeClassName) return activeBadgeStyle
  return badgeStyle
}

function SidebarNavIcon({
  Icon,
  emoji,
  iconSize,
  isActive,
}: SidebarNavIconProps) {
  if (emoji)
    return (
      <span
        style={{
          fontSize: iconSize,
          lineHeight: 1,
          width: iconSize,
          textAlign: 'center',
        }}
      >
        {emoji}
      </span>
    )
  return <Icon size={iconSize} weight={isActive ? 'fill' : 'regular'} />
}

export function SidebarCountPill({
  count,
  className,
  style,
  compact,
  testId = 'sidebar-count-chip',
}: SidebarCountPillProps) {
  return (
    <span
      data-testid={testId}
      className={cn('flex items-center justify-center', className)}
      style={{
        height: compact ? 18 : 20,
        ...SIDEBAR_COUNT_PILL_STYLE,
        ...style,
      }}
    >
      {count}
    </span>
  )
}

export function SidebarLoadingCountPill({
  compact,
  testId = 'sidebar-count-skeleton',
}: SidebarLoadingCountPillProps) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="inline-flex animate-pulse rounded-full bg-muted"
      style={{ width: compact ? 22 : 28, height: compact ? 18 : 20 }}
    />
  )
}

function NavItemLabel({ label, compact }: NavItemLabelProps) {
  return (
    <span className={cn('min-w-0 flex-1 truncate text-left font-medium', getNavItemTextClass(compact))}>{label}</span>
  )
}

function NavItemCount({
  count,
  countLoading,
  className,
  style,
  compact,
}: NavItemCountProps) {
  if (countLoading) return <SidebarLoadingCountPill compact={compact} />
  if (!hasSidebarCount(count)) return null
  return <SidebarCountPill count={count} className={className} style={style} compact={compact} />
}

function DisabledNavItem({
  Icon,
  emoji,
  label,
  compact,
  disabledTooltip,
  padding,
}: DisabledNavItemProps) {
  return (
    <div
      className="flex select-none items-center gap-2 rounded text-foreground"
      style={{ padding, borderRadius: 4, opacity: 0.4, cursor: 'not-allowed' }}
      title={disabledTooltip ?? 'Coming soon'}
    >
      <SidebarNavIcon Icon={Icon} emoji={emoji} iconSize={getNavItemIconSize(compact)} />
      <NavItemLabel label={label} compact={compact} />
    </div>
  )
}

function ClickableNavItem(options: ClickableNavItemProps) {
  const {
    Icon,
    emoji,
    label,
    count,
    countLoading,
    isActive,
    activeClassName,
    badgeClassName,
    badgeStyle,
    activeBadgeClassName,
    activeBadgeStyle,
    onClick,
    compact,
    padding,
  } = options
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'group/sidebar-row h-auto w-full cursor-pointer select-none justify-start rounded text-left transition-colors',
        isActive ? activeClassName : 'text-foreground',
        SIDEBAR_ITEM_HOVER_CLASS,
      )}
      style={{ padding, borderRadius: 4 }}
      onClick={onClick}
    >
      <SidebarNavIcon Icon={Icon} emoji={emoji} iconSize={getNavItemIconSize(compact)} isActive={isActive} />
      <NavItemLabel label={label} compact={compact} />
      <NavItemCount
        count={count}
        countLoading={countLoading}
        className={cn(resolveBadgeClassName(isActive, activeBadgeClassName, badgeClassName), isActive && SIDEBAR_COUNT_ACTIVE_CLASS, SIDEBAR_COUNT_HOVER_CLASS)}
        style={resolveBadgeStyle(isActive, activeBadgeClassName, activeBadgeStyle, badgeStyle)}
        compact={compact}
      />
    </Button>
  )
}

export function NavItem(options: NavItemProps) {
  const {
    icon: Icon,
    disabled,
    disabledTooltip,
    activeClassName = 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)]',
    ...props
  } = options
  const padding = getNavItemPadding(props.compact, props.countLoading || hasSidebarCount(props.count))
  if (disabled) {
    return <DisabledNavItem {...props} Icon={Icon} disabledTooltip={disabledTooltip} padding={padding} />
  }
  return <ClickableNavItem {...props} Icon={Icon} activeClassName={activeClassName} padding={padding} />
}
