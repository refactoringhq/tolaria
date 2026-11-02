import type {
  MobileNeighborhood,
  MobileNeighborhoodGroup,
} from '../../workspace/mobileNeighborhood'
import type { MobileNote } from '../../workspace/mobileWorkspaceModel'
import type { MobileNoteRowActions } from './MobileSwipeableNoteRow'
import type { MobileNoteListBulkActions } from './useMobileNoteListSelection'

export type MobileNeighborhoodRow =
  | { id: string; kind: 'source'; note: MobileNote }
  | { group: MobileNeighborhoodGroup; id: string; kind: 'header' }
  | { id: string; kind: 'note'; note: MobileNote }

export function mobileNoteListRowActions(
  bulkActions?: MobileNoteListBulkActions,
  onToggleFavorite?: (noteId: string) => void,
): MobileNoteRowActions | undefined {
  if (!bulkActions || !onToggleFavorite) return undefined
  return { ...bulkActions, onToggleFavorite }
}

export function mobileNeighborhoodRows(neighborhood: MobileNeighborhood): MobileNeighborhoodRow[] {
  return [
    {
      id: `source-${neighborhood.source.id}`,
      kind: 'source',
      note: neighborhood.source,
    },
    ...neighborhood.groups.flatMap((group) => [
      { group, id: `group-${group.id}`, kind: 'header' } as const,
      ...group.notes.map((note) => ({
        id: `group-${group.id}-${note.id}`,
        kind: 'note' as const,
        note,
      })),
    ]),
  ]
}
