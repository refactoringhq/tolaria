import type { ComponentProps } from 'react'
import type { useNoteGitUrls } from '../hooks/useNoteGitUrls'
import type { VaultConfig, VaultEntry } from '../types'
import type { LazyEditor } from './LazyEditor'
import type { NoteList } from './NoteList'
import type { PulseView } from './PulseView'

type NoteListProps = ComponentProps<typeof NoteList>
type PulseProps = ComponentProps<typeof PulseView>
type WorkspaceList =
  | { kind: 'notes'; props: NoteListProps }
  | { kind: 'pulse'; props: PulseProps }

type ScopedNoteListProps = Pick<NoteListProps, 'modifiedFiles' | 'modifiedFilesError' | 'onBulkOrganize' | 'onToggleOrganized'>
type NoteListFields = Pick<VaultConfig, 'allNotes' | 'inbox'>

export interface WorkspaceListOptions {
  visible: boolean
  sidebarVisible: boolean
  isChangesSelection: boolean
  explicitOrganizationEnabled: boolean
  notes: Omit<NoteListProps, 'sidebarCollapsed' | 'allNotesNoteListProperties' | 'inboxNoteListProperties'>
  pulse: Omit<PulseProps, 'sidebarCollapsed'>
  vaultConfig: NoteListFields
}

function scopedNoteListProps(options: WorkspaceListOptions): ScopedNoteListProps {
  const { notes, isChangesSelection, explicitOrganizationEnabled } = options
  return {
    modifiedFiles: isChangesSelection ? notes.modifiedFiles : undefined,
    modifiedFilesError: isChangesSelection ? notes.modifiedFilesError : null,
    onBulkOrganize: explicitOrganizationEnabled ? notes.onBulkOrganize : undefined,
    onToggleOrganized: explicitOrganizationEnabled ? notes.onToggleOrganized : undefined,
  }
}

export function createWorkspaceList(options: WorkspaceListOptions): WorkspaceList | false {
  if (!options.visible) return false
  const { notes, pulse, sidebarVisible, vaultConfig } = options
  const { selection } = notes
  const sidebarCollapsed = !sidebarVisible
  if (selection.kind === 'filter' && selection.filter === 'pulse') {
    return { kind: 'pulse', props: { ...pulse, sidebarCollapsed } }
  }
  return {
    kind: 'notes',
    props: {
      ...notes,
      ...scopedNoteListProps(options),
      sidebarCollapsed,
      allNotesNoteListProperties: vaultConfig.allNotes?.noteListProperties ?? null,
      inboxNoteListProperties: vaultConfig.inbox?.noteListProperties ?? null,
    },
  }
}

type OpenNoteActions = Pick<
  ComponentProps<typeof LazyEditor>,
  | 'onChangeWorkspace'
  | 'onToggleFavorite'
  | 'onToggleOrganized'
  | 'onEnterNeighborhood'
  | 'onCopyDeepLink'
  | 'onCopyGitUrl'
  | 'onDeleteNote'
  | 'onArchiveNote'
  | 'onUnarchiveNote'
  | 'onRenameFilename'
>

export interface OpenNoteActionOptions {
  deleted: boolean
  activeEntry: VaultEntry | null
  gitUrls: ReturnType<typeof useNoteGitUrls>
  actions: Omit<OpenNoteActions, 'onCopyGitUrl'>
}

export function editableNoteActions({ deleted, activeEntry, gitUrls, actions }: OpenNoteActionOptions): OpenNoteActions {
  if (deleted) return {}
  return {
    ...actions,
    onCopyGitUrl: activeEntry && gitUrls.canCopyEntryGitUrl(activeEntry) ? gitUrls.copyEntryGitUrl : undefined,
  }
}
