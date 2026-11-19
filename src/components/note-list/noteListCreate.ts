import type { ImmediateCreateOptions } from '../../hooks/useNoteCreation'
import type { SidebarSelection } from '../../types'

export type CreateNoteForList = (type?: string, options?: ImmediateCreateOptions) => void

/** Frontmatter a new note starts with, for example the calendar day it was created on. */
export type InitialNoteProperties = Record<string, string>

interface CreateNoteRequest {
  options?: ImmediateCreateOptions
  type?: string
}

function createNoteRequestForSelection(selection: SidebarSelection): CreateNoteRequest {
  if (selection.kind === 'sectionGroup') return { type: selection.type }
  if (selection.kind === 'folder') {
    return {
      options: {
        creationPath: 'folder_header',
        folderPath: selection.path,
        vaultPath: selection.rootPath,
      },
    }
  }
  return {}
}

function withInitialProperties(request: CreateNoteRequest, properties: InitialNoteProperties): CreateNoteRequest {
  return { ...request, options: { ...request.options, creationPath: 'calendar_day', properties } }
}

/** Creates a note that belongs to the selected list: its type, its folder, and any prefilled properties. */
export function createNoteForSelection(
  onCreateNote: CreateNoteForList,
  selection: SidebarSelection,
  properties?: InitialNoteProperties,
): void {
  const base = createNoteRequestForSelection(selection)
  const request = properties ? withInitialProperties(base, properties) : base
  if (request.options) {
    onCreateNote(request.type, request.options)
    return
  }
  onCreateNote(request.type)
}
