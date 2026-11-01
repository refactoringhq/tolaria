import { describe, expect, it } from 'vitest'
import { requiredFixture } from '../fixtures/requiredFixture'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import { requestedActionSheetQaTarget } from './mobileActionSheetQaTarget'
import {
  mobileSnapshotWithRequestedSelectedNote,
  requestedSelectedNoteId,
} from './mobileUiLabSelectedNote'
import { tabletTransitionProbeMode } from './tabletTransitionProbeMode'

describe('requestedSelectedNoteId', () => {
  it('reads selectedNoteId and the shorter noteId alias from URL params', () => {
    expect(requestedSelectedNoteId(new URLSearchParams('selectedNoteId=note-a.md'))).toBe('note-a.md')
    expect(requestedSelectedNoteId(new URLSearchParams('noteId=note-b.md'))).toBe('note-b.md')
    expect(requestedSelectedNoteId(new URLSearchParams('selectedNoteId=%20'))).toBeNull()
  })
})

describe('requestedActionSheetQaTarget', () => {
  it('allows deterministic native QA entry points for workspace sheets', () => {
    expect(requestedActionSheetQaTarget(new URLSearchParams('actionSheet=editView'))).toBe('editView')
    expect(requestedActionSheetQaTarget(new URLSearchParams('actionSheet=editTypeSection'))).toBe('editTypeSection')
    expect(requestedActionSheetQaTarget(new URLSearchParams('actionSheet=addProperty'))).toBe('addProperty')
    expect(requestedActionSheetQaTarget(new URLSearchParams('actionSheet=editProperty'))).toBe('editProperty')
  })

  it('ignores unknown action sheet targets', () => {
    expect(requestedActionSheetQaTarget(new URLSearchParams('actionSheet=deleteEverything'))).toBeUndefined()
    expect(requestedActionSheetQaTarget(new URLSearchParams(''))).toBeUndefined()
  })
})

describe('mobileSnapshotWithRequestedSelectedNote', () => {
  it('selects a requested note that exists in the visible snapshot', () => {
    const snapshot = workspaceScenarioForId('default')
    const noteId = requiredFixture(snapshot.notes[1]).id

    expect(mobileSnapshotWithRequestedSelectedNote(snapshot, noteId).selectedNoteId).toBe(noteId)
  })

  it('selects a requested note that only exists in allNotes', () => {
    const snapshot = workspaceScenarioForId('default')
    const hiddenNote = {
      ...requiredFixture(snapshot.notes[0]),
      id: 'hidden-relationship-note.md',
      title: 'Hidden relationship note',
    }

    expect(mobileSnapshotWithRequestedSelectedNote({
      ...snapshot,
      allNotes: [...snapshot.notes, hiddenNote],
    }, hiddenNote.id).selectedNoteId).toBe(hiddenNote.id)
  })

  it('still selects a visible note when the indexed note list is stale', () => {
    const snapshot = workspaceScenarioForId('default')
    const visibleNote = {
      ...requiredFixture(snapshot.notes[0]),
      id: 'visible-only.md',
    }
    expect(mobileSnapshotWithRequestedSelectedNote({
      ...snapshot,
      allNotes: snapshot.notes.filter((note) => note.id !== visibleNote.id),
      notes: [visibleNote],
    }, visibleNote.id).selectedNoteId).toBe(visibleNote.id)
  })

  it('ignores blank or missing requested note IDs', () => {
    const snapshot = workspaceScenarioForId('default')

    expect(mobileSnapshotWithRequestedSelectedNote(snapshot, null)).toBe(snapshot)
    expect(mobileSnapshotWithRequestedSelectedNote(snapshot, 'missing.md')).toBe(snapshot)
  })
})

describe('tabletTransitionProbeMode', () => {
  it('lets the simulator environment override a stale Expo deep-link query', () => {
    expect(tabletTransitionProbeMode({
      envProbe: 'properties',
      queryProbe: '1',
    })).toBe('properties')
  })

  it('keeps URL-driven all-panel transition probes available', () => {
    expect(tabletTransitionProbeMode({
      envProbe: undefined,
      queryProbe: 'all',
    })).toBe('all')
  })

  it('disables unknown probe modes', () => {
    expect(tabletTransitionProbeMode({
      envProbe: undefined,
      queryProbe: 'left',
    })).toBe(false)
  })
})
