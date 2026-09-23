import type { RawEditorAutocompleteState } from '../utils/rawEditorUtils'
import { NoteSearchList } from './NoteSearchList'
import { RAW_EDITOR_DROPDOWN_MAX_HEIGHT } from './rawEditorAutocomplete'

export function RawEditorAutocompleteDropdown({
  autocomplete,
  onItemHover,
  position,
}: {
  autocomplete: RawEditorAutocompleteState | null
  onItemHover: (index: number) => void
  position: { top: number; left: number }
}) {
  if (!autocomplete || autocomplete.items.length === 0) return null

  return (
    <div
      className="fixed z-50 min-w-64 max-w-xs overflow-auto rounded-md border shadow-[0_12px_30px_var(--shadow-dialog)]"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: RAW_EDITOR_DROPDOWN_MAX_HEIGHT,
        background: 'var(--popover)',
        borderColor: 'var(--border)',
      }}
      data-testid="raw-editor-wikilink-dropdown"
    >
      <NoteSearchList
        items={autocomplete.items}
        selectedIndex={autocomplete.selectedIndex}
        getItemKey={(item, index) => `${item.title}-${item.path ?? index}`}
        onItemClick={(item) => item.onItemClick()}
        onItemHover={onItemHover}
      />
    </div>
  )
}
