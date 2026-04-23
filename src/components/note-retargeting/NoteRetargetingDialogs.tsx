import type { VaultEntry } from '../../types'
import type { RetargetOption } from './RetargetNoteDialog'
import { RetargetNoteDialog } from './RetargetNoteDialog'

interface NoteRetargetingDialogsProps {
  dialogState: { kind: 'type' | 'folder'; notePath: string } | null
  dialogEntry: VaultEntry | null
  typeOptions: RetargetOption[]
  folderOptions: RetargetOption[]
  onClose: () => void
  onSelectType: (type: string) => boolean | Promise<boolean>
  onSelectFolder: (folderPath: string) => boolean | Promise<boolean>
}

function typeDialogDescription(entry: VaultEntry | null): string {
  return entry
    ? `Set a new type for "${entry.title}".`
    : 'Select a type for the active note.'
}

function folderDialogDescription(entry: VaultEntry | null): string {
  return entry
    ? `Choose a destination folder for "${entry.title}".`
    : 'Select a destination folder for the active note.'
}

export function NoteRetargetingDialogs({
  dialogState,
  dialogEntry,
  typeOptions,
  folderOptions,
  onClose,
  onSelectType,
  onSelectFolder,
}: NoteRetargetingDialogsProps) {
  return (
    <>
      <RetargetNoteDialog
        open={dialogState?.kind === 'type'}
        title="Change Note Type"
        description={typeDialogDescription(dialogEntry)}
        searchPlaceholder="Search types"
        emptyMessage="No other note types available."
        options={typeOptions}
        onClose={onClose}
        onSelect={onSelectType}
        testIdPrefix="retarget-note-type"
      />
      <RetargetNoteDialog
        open={dialogState?.kind === 'folder'}
        title="Move Note to Folder"
        description={folderDialogDescription(dialogEntry)}
        searchPlaceholder="Search folders"
        emptyMessage="No other folders available."
        options={folderOptions}
        onClose={onClose}
        onSelect={onSelectFolder}
        testIdPrefix="retarget-note-folder"
      />
    </>
  )
}
