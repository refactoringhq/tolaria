import { ClockCounterClockwise } from '@phosphor-icons/react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { type AppLocale, translate } from '../../lib/i18n'
import { hasNoteHistory } from '../../lib/noteHistory/noteHistoryClient'
import { openNoteHistory } from '../../lib/noteHistory/noteHistoryDrawerStore'

/** "Version history" in a note's menu, where the vault keeps one (the web app, TOL-421). */
export function NoteHistoryMenuItem({ path, visible, locale }: { path: string; visible: boolean; locale: AppLocale }) {
  if (!visible || !hasNoteHistory()) return null
  return (
    <DropdownMenuItem data-testid="note-history-menu-item" onSelect={() => openNoteHistory(path)}>
      <ClockCounterClockwise size={16} />
      {translate(locale, 'noteHistory.menuItem')}
    </DropdownMenuItem>
  )
}
