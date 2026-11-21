import type { ReactNode } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { SIDEBAR_COUNT_PILL_IDLE_CLASS, SidebarCountPill } from '../SidebarParts'
import { SIDEBAR_GROUP_HEADER_PADDING } from './sidebarStyles'

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
      className="flex w-full items-center justify-between text-muted-foreground"
      style={{ padding: count != null ? SIDEBAR_GROUP_HEADER_PADDING.withCount : SIDEBAR_GROUP_HEADER_PADDING.regular }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1 border-none bg-transparent p-0 text-muted-foreground"
        onClick={onToggle}
      >
        {collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
        <span className="text-[10px] font-semibold" style={{ letterSpacing: 0.5 }}>{label}</span>
      </button>
      {children ?? (count != null && (
        <SidebarCountPill count={count} className={SIDEBAR_COUNT_PILL_IDLE_CLASS} compact />
      ))}
    </div>
  )
}
