import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { SidebarCountPill } from '../SidebarParts'
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
      className="sidebar-group-header flex w-full items-center justify-between text-muted-foreground"
      style={{ padding: count != null ? SIDEBAR_GROUP_HEADER_PADDING.withCount : SIDEBAR_GROUP_HEADER_PADDING.regular }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1 border-none bg-transparent p-0 text-muted-foreground"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span className="text-[10px] font-semibold" style={{ letterSpacing: 0.5 }}>{label}</span>
        {collapsed ? <CaretRight size={12} aria-hidden="true" /> : <CaretDown size={12} aria-hidden="true" />}
      </button>
      {children != null ? (
        <div className="sidebar-group-actions flex items-center">{children}</div>
      ) : (count != null && (
        <SidebarCountPill count={count} className="bg-transparent text-muted-foreground" compact />
      ))}
    </div>
  )
}
