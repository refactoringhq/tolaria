import type { CSSProperties } from 'react'

export const PROPERTY_PANEL_GRID_STYLE = {
  gridTemplateColumns: 'fit-content(50%) minmax(0, 1fr)',
} satisfies CSSProperties

export const PROPERTY_PANEL_ROW_STYLE = {
  gridColumn: '1 / -1',
  gridTemplateColumns: 'subgrid',
} satisfies CSSProperties

export const PROPERTY_PANEL_LABEL_CLASS_NAME = 'flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-muted-foreground'

export const PROPERTY_PANEL_PLACEHOLDER_LABEL_CLASS_NAME = 'flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-text-muted'

export const PROPERTY_PANEL_LABEL_ICON_SLOT_CLASS_NAME = 'flex size-5 shrink-0 items-center justify-center'

export const PROPERTY_PANEL_INTERACTIVE_ROW_CLASS_NAME = 'grid h-auto min-h-7 w-full min-w-0 grid-cols-2 items-center gap-2 rounded px-1.5 text-left text-[12px] font-normal shadow-none outline-none transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-primary'

export const PROPERTY_PANEL_PLACEHOLDER_VALUE_CLASS_NAME = 'min-w-0 truncate text-[12px] text-text-muted'
