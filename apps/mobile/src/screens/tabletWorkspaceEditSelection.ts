import type {
  applyMobileWorkspaceEditWithWrites,
  MobileWorkspaceEdit,
  MobileWorkspaceEditResult,
  MobileWorkspaceWrite,
} from '../workspace/mobileWorkspaceEditing'
import {
  mobileFolderName,
  mobileFolderPathContains,
  renamedFolderPath,
} from '../workspace/mobileWorkspaceFolders'
import type {
  MobileSavedView,
  MobileWorkspaceSnapshot,
} from '../workspace/mobileWorkspaceModel'
import { markPristineCreatedNote } from './markPristineCreatedNote'
import {
  notesForSidebarSelection,
  type TabletSidebarSelection,
} from './tabletWorkspaceNavigation'

type FolderEdit = Extract<MobileWorkspaceEdit, { type: 'createFolder' | 'deleteFolder' | 'renameFolder' }>
type PathEdit = Extract<MobileWorkspaceEdit, { type: 'moveNoteToFolder' | 'renameNoteFile' }>
type TypeEdit = Extract<MobileWorkspaceEdit, { type: 'createTypeDefinition' | 'deleteTypeDefinition' | 'renameTypeDefinition' | 'updateTypeDefinition' }>
type RenameTypeEdit = Extract<MobileWorkspaceEdit, { type: 'renameTypeDefinition' }>
type NoteSelectionSetter = (noteId: string | null) => void
type EditSelectionContext = {
  edit: MobileWorkspaceEdit
  navigation: EditSelectionNavigation
  result: MobileWorkspaceEditResult
  setSelectedNoteId: NoteSelectionSetter
}

type EditSelectionNavigation = {
  markPristineNewNote?: (noteId: string) => void
  selectDefaultSidebarItem: (sourceSnapshot: MobileWorkspaceSnapshot) => void
  selectFolder: (selection: { id: string; name: string }, sourceSnapshot?: MobileWorkspaceSnapshot) => void
  selectSavedView: (view: MobileSavedView, sourceSnapshot?: MobileWorkspaceSnapshot) => void
  selectSidebarItem: (selection: { count?: string; id: string; label: string; sectionId: string; typeName?: string; viewId?: string }, sourceSnapshot?: MobileWorkspaceSnapshot) => void
  sidebarSelection: TabletSidebarSelection
}

export function selectAfterWorkspaceEdit({
  edit,
  navigation,
  result,
  setSelectedNoteId,
}: {
  edit: MobileWorkspaceEdit
  navigation: EditSelectionNavigation
  result: ReturnType<typeof applyMobileWorkspaceEditWithWrites>
  setSelectedNoteId: NoteSelectionSetter
}) {
  const context = { edit, navigation, result, setSelectedNoteId }

  if (selectAfterCreatedNote(context)) return
  if (selectAfterInboxOrganized(context)) return
  if (selectAfterViewEdit(context)) return
  if (selectAfterBulkTypeRename(context)) return
  if (selectAfterTypeEdit(context)) return
  if (selectAfterFolderMutation(context)) return
  selectAfterPathMutation(context)
}

function selectAfterCreatedNote({ edit, navigation, result, setSelectedNoteId }: EditSelectionContext) {
  if (edit.type !== 'createNote' && edit.type !== 'createRelationshipTarget') return false
  const createdNoteId = result.snapshot.selectedNoteId
  if (!createdNoteId) return true

  markPristineCreatedNote(edit, result, navigation.markPristineNewNote)

  const visibleNotes = notesForSidebarSelection(result.snapshot, navigation.sidebarSelection)
  if (!visibleNotes.some((note) => note.id === createdNoteId)) {
    navigation.selectDefaultSidebarItem(result.snapshot)
  }
  setSelectedNoteId(createdNoteId)
  return true
}

function selectAfterInboxOrganized({ edit, navigation, result, setSelectedNoteId }: EditSelectionContext) {
  if (!isOrganizedInboxEdit(edit, navigation.sidebarSelection)) return false

  const remainingInboxNotes = notesForSidebarSelection(result.snapshot, navigation.sidebarSelection)
  setSelectedNoteId(remainingInboxNotes[0]?.id ?? null)
  return true
}

function isOrganizedInboxEdit(edit: MobileWorkspaceEdit, selection: TabletSidebarSelection) {
  if (edit.type !== 'setOrganized') return false
  if (!edit.organized) return false
  return isSelectedInbox(selection)
}

function isSelectedInbox(selection: TabletSidebarSelection) {
  return selection.kind === 'item' && selection.sectionId === 'primary' && selection.id === 'inbox'
}

function selectAfterViewEdit({ edit, navigation, result }: EditSelectionContext) {
  if (edit.type === 'createView') selectCreatedView(edit, result.snapshot, navigation)
  else if (edit.type === 'updateView') selectUpdatedView(edit.viewId, result.snapshot, navigation)
  else if (edit.type === 'deleteView') selectAfterDeletedView(edit.viewId, result.snapshot, navigation)
  else return false

  return true
}

function selectAfterTypeEdit({ edit, navigation, result }: EditSelectionContext) {
  if (!isTypeEdit(edit)) return false
  if (edit.type === 'deleteTypeDefinition') selectAfterDeletedType(edit, navigation, result.snapshot)
  else if (edit.type === 'renameTypeDefinition') selectAfterRenamedType(edit, navigation, result.snapshot)
  else if (shouldSelectTypeAfterEdit(edit, navigation.sidebarSelection)) selectTypeSection(edit.typeName, result.snapshot, navigation)
  return true
}

function selectAfterBulkTypeRename({ edit, navigation, result }: EditSelectionContext) {
  if (edit.type !== 'bulkEdit') return false
  const renameEdit = edit.edits.find(isTypeRenameEdit)
  if (!renameEdit || !isSelectedType(navigation.sidebarSelection, renameEdit.typeName)) return false

  selectTypeSection(renameEdit.nextTypeName, result.snapshot, navigation)
  return true
}

function selectAfterFolderMutation({ edit, navigation, result }: EditSelectionContext) {
  if (!isFolderEdit(edit)) return false
  selectAfterFolderEdit(edit, result, navigation)
  return true
}

function selectAfterPathMutation({ edit, result, setSelectedNoteId }: EditSelectionContext) {
  if (!isPathEdit(edit)) return
  setSelectedNoteId(selectedNoteIdAfterPathEdit(edit, result))
}

function isFolderEdit(edit: MobileWorkspaceEdit): edit is FolderEdit {
  return edit.type === 'createFolder' || edit.type === 'deleteFolder' || edit.type === 'renameFolder'
}

function isPathEdit(edit: MobileWorkspaceEdit): edit is PathEdit {
  return edit.type === 'moveNoteToFolder' || edit.type === 'renameNoteFile'
}

function isTypeEdit(edit: MobileWorkspaceEdit): edit is TypeEdit {
  return edit.type === 'createTypeDefinition'
    || edit.type === 'deleteTypeDefinition'
    || edit.type === 'renameTypeDefinition'
    || edit.type === 'updateTypeDefinition'
}

function isTypeRenameEdit(edit: MobileWorkspaceEdit): edit is RenameTypeEdit {
  return edit.type === 'renameTypeDefinition'
}

function selectCreatedView(
  edit: Extract<MobileWorkspaceEdit, { type: 'createView' }>,
  snapshot: MobileWorkspaceSnapshot,
  navigation: EditSelectionNavigation,
) {
  const createdView = snapshot.views?.find((view) => view.definition.name === edit.definition.name)
  if (createdView) navigation.selectSavedView(createdView, snapshot)
}

function selectUpdatedView(
  viewId: string,
  snapshot: MobileWorkspaceSnapshot,
  navigation: EditSelectionNavigation,
) {
  const updatedView = snapshot.views?.find((view) => view.id === viewId)
  if (!updatedView) return
  if (!isSelectedView(navigation.sidebarSelection, viewId)) return

  navigation.selectSavedView(updatedView, snapshot)
}

function selectAfterDeletedView(
  viewId: string,
  snapshot: MobileWorkspaceSnapshot,
  navigation: EditSelectionNavigation,
) {
  if (!isSelectedView(navigation.sidebarSelection, viewId)) return
  navigation.selectDefaultSidebarItem(snapshot)
}

function isSelectedView(selection: TabletSidebarSelection, viewId: string) {
  return selection.kind === 'item' && selection.viewId === viewId
}

function shouldSelectTypeAfterEdit(edit: TypeEdit, selection: TabletSidebarSelection) {
  return edit.type === 'createTypeDefinition' || isSelectedType(selection, edit.typeName)
}

function selectAfterDeletedType(
  edit: Extract<TypeEdit, { type: 'deleteTypeDefinition' }>,
  navigation: EditSelectionNavigation,
  snapshot: MobileWorkspaceSnapshot,
) {
  if (isSelectedType(navigation.sidebarSelection, edit.typeName)) navigation.selectDefaultSidebarItem(snapshot)
}

function selectAfterRenamedType(
  edit: RenameTypeEdit,
  navigation: EditSelectionNavigation,
  snapshot: MobileWorkspaceSnapshot,
) {
  if (isSelectedType(navigation.sidebarSelection, edit.typeName)) selectTypeSection(edit.nextTypeName, snapshot, navigation)
}

function selectTypeSection(
  typeName: string,
  snapshot: MobileWorkspaceSnapshot,
  navigation: EditSelectionNavigation,
) {
  const item = snapshot.sidebarSections
    .find((section) => section.id === 'types')
    ?.items
    ?.find((candidate) => candidate.typeName === typeName)
  if (!item) return

  navigation.selectSidebarItem({
    count: item.count,
    id: item.id,
    label: item.label,
    sectionId: 'types',
    typeName: item.typeName,
  }, snapshot)
}

function isSelectedType(selection: TabletSidebarSelection, typeName: string) {
  if (selection.kind !== 'item' || selection.sectionId !== 'types') return false
  return selection.typeName === typeName || normalizedTypeLabel(selection.label) === normalizedTypeLabel(typeName)
}

function normalizedTypeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '')
}

function selectAfterFolderEdit(
  edit: FolderEdit,
  result: MobileWorkspaceEditResult,
  navigation: EditSelectionNavigation,
) {
  if (edit.type === 'createFolder') return selectCreatedFolder(result, navigation)
  if (edit.type === 'renameFolder') return selectRenamedFolder(result, navigation)
  selectAfterDeletedFolder(result, navigation)
}

function selectCreatedFolder(
  result: MobileWorkspaceEditResult,
  navigation: EditSelectionNavigation,
) {
  const write = result.writes.find((candidate) => candidate.kind === 'createFolder')
  if (write) navigation.selectFolder({ id: write.path, name: mobileFolderName(write.path) }, result.snapshot)
}

function selectRenamedFolder(
  result: MobileWorkspaceEditResult,
  navigation: EditSelectionNavigation,
) {
  const write = result.writes.find((candidate) => candidate.kind === 'renameFolder')
  if (!write) return

  const nextId = selectedFolderPathAfterRename(navigation.sidebarSelection, write.path, write.toPath)
  navigation.selectFolder({ id: nextId, name: mobileFolderName(nextId) }, result.snapshot)
}

function selectedFolderPathAfterRename(
  selection: TabletSidebarSelection,
  previousPath: string,
  nextPath: string,
) {
  if (selection.kind !== 'folder') return nextPath
  if (!mobileFolderPathContains(previousPath, selection.id)) return nextPath
  return renamedFolderPath(selection.id, previousPath, nextPath)
}

function selectAfterDeletedFolder(
  result: MobileWorkspaceEditResult,
  navigation: EditSelectionNavigation,
) {
  const write = result.writes.find((candidate) => candidate.kind === 'deleteFolder')
  if (!write || !deletedFolderWasSelected(navigation.sidebarSelection, write.path)) return
  navigation.selectDefaultSidebarItem(result.snapshot)
}

function deletedFolderWasSelected(selection: TabletSidebarSelection, folderPath: string) {
  return selection.kind === 'folder' && mobileFolderPathContains(folderPath, selection.id)
}

function selectedNoteIdAfterPathEdit(
  edit: PathEdit,
  result: MobileWorkspaceEditResult,
) {
  const notes = result.snapshot.allNotes ?? result.snapshot.notes
  const directNoteId = noteIdByExistingId(notes, edit.noteId)
  if (directNoteId) return directNoteId

  const savedNoteId = noteIdBySavedPath(notes, result.writes)
  if (savedNoteId) return savedNoteId

  return result.snapshot.selectedNoteId ?? null
}

function noteIdByExistingId(notes: MobileWorkspaceSnapshot['notes'], noteId: string): string | null {
  return new Map(notes.map((note) => [note.id, note.id])).get(noteId) || null
}

function noteIdBySavedPath(notes: MobileWorkspaceSnapshot['notes'], writes: MobileWorkspaceWrite[]): string | null {
  const savedPath = savedNotePath(writes)
  if (!savedPath) return null

  for (const note of notes) {
    if (note.path === savedPath || note.id === savedPath) return note.id
  }

  return null
}

function savedNotePath(writes: MobileWorkspaceWrite[]): string | null {
  const moveWrite = writes.find((candidate) => candidate.kind === 'moveNote')
  if (moveWrite) return moveWrite.toPath

  const saveWrite = writes.find((candidate) => candidate.kind === 'saveNote')
  return saveWrite?.path ?? null
}
