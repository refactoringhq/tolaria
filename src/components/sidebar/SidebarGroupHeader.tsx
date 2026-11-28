import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SidebarCountPill } from '../SidebarParts'
import { SIDEBAR_GROUP_HEADER_COUNT_CLASS, SIDEBAR_GROUP_HEADER_HOVER_CLASS, SIDEBAR_GROUP_HEADER_PADDING } from './sidebarStyles'

interface SidebarGroupHeaderProps {
  label: string
  collapsed: boolean
  onToggle: () => void
  count?: number
  children?: ReactNode
}

export function SidebarGroupHeader({
  label,
  collapsed,
  onToggle,
  count,
  children,
}: SidebarGroupHeaderProps) {
  return (
    <div
      className={cn('flex w-full items-center justify-between text-muted-foreground transition-colors', SIDEBAR_GROUP_HEADER_HOVER_CLASS)}
      style={{ padding: count != null ? SIDEBAR_GROUP_HEADER_PADDING.withCount : SIDEBAR_GROUP_HEADER_PADDING.regular }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1 border-none bg-transparent p-0 text-inherit"
        onClick={onToggle}
      >
        {collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
        <span className="text-[10px] font-semibold" style={{ letterSpacing: 0.5 }}>{label}</span>
      </button>
      {children ?? (count != null && (
        <SidebarCountPill count={count} className={SIDEBAR_GROUP_HEADER_COUNT_CLASS} compact />
      ))}
    </div>
  )
}
