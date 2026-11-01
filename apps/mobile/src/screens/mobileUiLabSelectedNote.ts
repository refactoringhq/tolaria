import type { MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'

export function requestedSelectedNoteId(searchParams: URLSearchParams) {
  const value = searchParams.get('selectedNoteId') ?? searchParams.get('noteId')
  const trimmed = value?.trim()
  return trimmed || null
}

export function mobileSnapshotWithRequestedSelectedNote(
  snapshot: MobileWorkspaceSnapshot,
  noteId: string | null,
): MobileWorkspaceSnapshot {
  if (!noteId) return snapshot
  if (!mobileSnapshotHasNote(snapshot, noteId)) return snapshot

  return {
    ...snapshot,
    selectedNoteId: noteId,
  }
}

function mobileSnapshotHasNote(snapshot: MobileWorkspaceSnapshot, noteId: string) {
  return [...snapshot.notes, ...(snapshot.allNotes ?? [])].some((note) => note.id === noteId)
}
