export type NoteListPropertiesScope = 'type' | 'inbox'

export interface OpenListPropertiesEventDetail {
  scope: NoteListPropertiesScope
}

export const OPEN_NOTE_LIST_PROPERTIES_EVENT = 'laputa:open-note-list-properties'

export function openNoteListPropertiesPicker(scope: NoteListPropertiesScope): void {
  window.dispatchEvent(new CustomEvent<OpenListPropertiesEventDetail>(OPEN_NOTE_LIST_PROPERTIES_EVENT, {
    detail: { scope },
  }))
}
