import type { CSSProperties } from 'react'

export type SidebarItemStyle = CSSProperties & {
  '--sidebar-active-bg'?: string
  '--sidebar-active-fg'?: string
}

export const SIDEBAR_ITEM_HOVER_CLASS =
  'sidebar-row hover:bg-[var(--sidebar-active-bg,var(--accent-blue-light))] hover:text-[var(--sidebar-active-fg,var(--accent-blue))]'

export const SIDEBAR_COUNT_ACTIVE_CLASS =
  'bg-transparent text-[var(--sidebar-active-fg,var(--accent-blue))] font-medium'

export const SIDEBAR_COUNT_HOVER_CLASS =
  'group-hover/sidebar-row:bg-transparent group-hover/sidebar-row:text-[var(--sidebar-active-fg,var(--accent-blue))] group-hover/sidebar-row:font-medium'

export const SIDEBAR_ITEM_PADDING = {
  regular: '6px 16px 6px 12px',
  withCount: '6px 8px 6px 12px',
  compact: '4px 16px 4px 12px',
  compactWithCount: '4px 8px 4px 12px',
} as const

/** Section headers: one gray for the hover fill and the count pill, so the pill never changes on hover. */
export const SIDEBAR_GROUP_HEADER_HOVER_CLASS = 'rounded hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-hover-text)]'

export const SIDEBAR_GROUP_HEADER_COUNT_CLASS = 'bg-[var(--sidebar-hover)] text-[var(--sidebar-hover-text)]'

export const SIDEBAR_GROUP_HEADER_PADDING = {
  regular: '8px 14px 8px 12px',
  withCount: '8px 8px 8px 12px',
} as const

export const SIDEBAR_SECTION_CONTENT_PADDING_BOTTOM = 8
