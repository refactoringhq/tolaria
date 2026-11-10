import { describe, expect, it, vi } from 'vitest'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import { applyMobileWorkspaceEditWithWrites, type MobileWorkspaceEdit } from '../workspace/mobileWorkspaceEditing'
import type { MobileNote } from '../workspace/mobileWorkspaceModel'
import { selectAfterWorkspaceEdit } from './tabletWorkspaceEditSelection'
import type { TabletSidebarSelection } from './tabletWorkspaceNavigation'

describe('tablet workspace edit selection', () => {
  it('selects the newly created relationship target note', () => {
    const base = workspaceScenarioForId('default')
    const sourceNote = {
      ...base.notes[0],
      rawContent: '# Workflow Orchestration Essay\n\nSource body.\n',
    }
    const snapshot = {
      ...base,
      allNotes: [sourceNote, ...base.notes.slice(1)],
      notes: [sourceNote, ...base.notes.slice(1)],
      selectedNoteId: sourceNote.id,
    }
    const edit: MobileWorkspaceEdit = {
      key: 'related_to',
      sourceNoteId: sourceNote.id,
      targetTitle: 'Brand New Target',
      type: 'createRelationshipTarget',
    }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedNoteIds: Array<string | null> = []

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation(),
      result,
      setSelectedNoteId: (noteId) => selectedNoteIds.push(noteId),
    })

    expect(selectedNoteIds).toEqual(['Tolaria/Mobile UI/brand-new-target.md'])
  })

  it('returns to the default note list when the current section excludes the newly created note', () => {
    const snapshot = workspaceScenarioForId('default')
    const edit: MobileWorkspaceEdit = { title: '', type: 'createNote' }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedNoteIds: Array<string | null> = []
    let selectedDefault = false

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({
        selectDefaultSidebarItem: () => { selectedDefault = true },
        sidebarSelection: {
          count: '0',
          id: 'archive',
          kind: 'item',
          label: 'Archive',
          sectionId: 'primary',
        },
      }),
      result,
      setSelectedNoteId: (noteId) => selectedNoteIds.push(noteId),
    })

    expect(selectedDefault).toBe(true)
    expect(selectedNoteIds).toEqual([result.snapshot.selectedNoteId])
  })

  it('tracks only a newly-created empty-title note as a discardable draft', () => {
    const snapshot = workspaceScenarioForId('default')
    const edit: MobileWorkspaceEdit = { title: '', type: 'createNote' }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const markPristineNewNote = vi.fn()

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({ markPristineNewNote }),
      result,
      setSelectedNoteId: () => {},
    })

    expect(markPristineNewNote).toHaveBeenCalledWith(result.snapshot.selectedNoteId)
  })

  it('selects the next rendered Inbox note after organizing the selected note', () => {
    const base = workspaceScenarioForId('default')
    const first = inboxNote(base.notes[0], {
      id: 'Inbox/first.md',
      title: 'First inbox note',
    })
    const second = inboxNote(base.notes[1], {
      id: 'Inbox/second.md',
      title: 'Second inbox note',
    })
    const snapshot = {
      ...base,
      allNotes: [first, second],
      notes: [first, second],
      selectedNoteId: first.id,
    }
    const edit: MobileWorkspaceEdit = {
      noteId: first.id,
      organized: true,
      type: 'setOrganized',
    }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedNoteIds: Array<string | null> = []

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation(),
      result,
      setSelectedNoteId: (noteId) => selectedNoteIds.push(noteId),
    })

    expect(selectedNoteIds).toEqual([second.id])
  })

  it('keeps non-Inbox organize selection unchanged', () => {
    const base = workspaceScenarioForId('default')
    const first = inboxNote(base.notes[0], {
      id: 'Inbox/first.md',
      title: 'First inbox note',
    })
    const snapshot = {
      ...base,
      allNotes: [first],
      notes: [first],
      selectedNoteId: first.id,
    }
    const edit: MobileWorkspaceEdit = {
      noteId: first.id,
      organized: true,
      type: 'setOrganized',
    }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedNoteIds: Array<string | null> = []

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({
        sidebarSelection: {
          count: '1',
          id: 'all-notes',
          kind: 'item',
          label: 'All Notes',
          sectionId: 'primary',
        },
      }),
      result,
      setSelectedNoteId: (noteId) => selectedNoteIds.push(noteId),
    })

    expect(selectedNoteIds).toEqual([])
  })

  it('selects a newly created Type section', () => {
    const snapshot = workspaceScenarioForId('default')
    const edit: MobileWorkspaceEdit = { type: 'createTypeDefinition', typeName: 'Decision' }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedItems: unknown[] = []

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({ selectSidebarItem: (selection) => { selectedItems.push(selection) } }),
      result,
      setSelectedNoteId: () => {},
    })

    expect(selectedItems).toEqual([expect.objectContaining({
      id: 'type-decision',
      label: 'Decisions',
      sectionId: 'types',
      typeName: 'Decision',
    })])
  })

  it('retargets the selected Type section after a bulk Type rename', () => {
    const snapshot = workspaceScenarioForId('default')
    const edit: MobileWorkspaceEdit = {
      edits: [
        { nextTypeName: 'Playbook', type: 'renameTypeDefinition', typeName: 'Procedure' },
        { patch: { label: null }, type: 'updateTypeDefinition', typeName: 'Playbook' },
      ],
      type: 'bulkEdit',
    }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    const selectedItems: unknown[] = []

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({
        selectSidebarItem: (selection) => { selectedItems.push(selection) },
        sidebarSelection: {
          count: '51',
          id: 'type-procedure',
          kind: 'item',
          label: 'Procedures',
          sectionId: 'types',
          typeName: 'Procedure',
        },
      }),
      result,
      setSelectedNoteId: () => {},
    })

    expect(selectedItems).toEqual([expect.objectContaining({
      id: 'type-playbook',
      label: 'Playbooks',
      sectionId: 'types',
      typeName: 'Playbook',
    })])
  })

  it('returns to the default section when deleting the selected Type document', () => {
    const snapshot = workspaceScenarioForId('default')
    const edit: MobileWorkspaceEdit = { type: 'deleteTypeDefinition', typeName: 'Procedure' }
    const result = applyMobileWorkspaceEditWithWrites(snapshot, edit)
    let selectedDefault = false

    selectAfterWorkspaceEdit({
      edit,
      navigation: inertNavigation({
        selectDefaultSidebarItem: () => { selectedDefault = true },
        sidebarSelection: {
          count: '1',
          id: 'type-procedure',
          kind: 'item',
          label: 'Procedures',
          sectionId: 'types',
          typeName: 'Procedure',
        },
      }),
      result,
      setSelectedNoteId: () => {},
    })

    expect(selectedDefault).toBe(true)
  })
})

function inboxNote(source: MobileNote, overrides: Pick<MobileNote, 'id' | 'title'>): MobileNote {
  return {
    ...source,
    ...overrides,
    archived: false,
    favorite: false,
    organized: false,
    path: overrides.id,
    rawContent: `# ${overrides.title}\n\nInbox body.\n`,
  }
}

type InertNavigationForTest = {
  markPristineNewNote?: (noteId: string) => void
  selectDefaultSidebarItem: () => void
  selectFolder: () => void
  selectSavedView: () => void
  selectSidebarItem: (selection: SidebarItemSelectionForTest) => void
  sidebarSelection: TabletSidebarSelection
}

function inertNavigation(overrides: Partial<InertNavigationForTest> = {}): InertNavigationForTest {
  return {
    ...inertNavigationDefaults(),
    ...overrides,
  }
}

function inertNavigationDefaults(): InertNavigationForTest {
  const sidebarSelection: TabletSidebarSelection = {
    count: '7',
    id: 'inbox',
    kind: 'item',
    label: 'Inbox',
    sectionId: 'primary',
  }

  return {
    selectDefaultSidebarItem: () => {},
    selectFolder: () => {},
    selectSavedView: () => {},
    selectSidebarItem: () => {},
    sidebarSelection,
  }
}

type SidebarItemSelectionForTest = {
  count?: string
  id: string
  label: string
  sectionId: string
  typeName?: string
  viewId?: string
}
