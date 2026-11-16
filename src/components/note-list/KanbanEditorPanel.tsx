import { X } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { type AppLocale, translate } from '../../lib/i18n'

const EDITOR_PANEL_SELECTOR = '.app__editor'

interface KanbanEditorPanelCloseProps {
  open: boolean
  locale: AppLocale
  onClose: () => void
}

/**
 * The Kanban board slides the app editor in as a right-hand panel. Its close button sits in the
 * panel's breadcrumb row, before the first crumb, so the board owns the panel without the editor
 * knowing about layouts.
 */
export function KanbanEditorPanelClose({ open, locale, onClose }: KanbanEditorPanelCloseProps) {
  const panel = open ? document.querySelector<HTMLElement>(EDITOR_PANEL_SELECTOR) : null
  if (!panel) return null
  const label = translate(locale, 'layout.closePanel')
  return createPortal(
    <Button type="button" variant="ghost" size="icon-xs" className="kanban-panel-close text-muted-foreground" onClick={onClose} title={label} aria-label={label} data-testid="kanban-panel-close">
      <X size={16} />
    </Button>,
    panel,
  )
}
