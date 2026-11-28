import { describe, expect, it } from 'vitest'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import { frontmatterProperties, parseLocalVaultDocument } from './localVaultFrontmatter'
import { writeMobileFrontmatterContentValue } from './mobileFrontmatterWrites'
import { applyMobileWorkspaceEditWithWrites } from './mobileWorkspaceEditing'
import type { MobileNote, MobileWorkspaceSnapshot } from './mobileWorkspaceModel'

describe('mobile frontmatter writes', () => {
  it('canonicalizes desktop system metadata aliases during note edits', () => {
    const snapshot = snapshotWithLegacyMetadataNote()
    const typed = applyMobileWorkspaceEditWithWrites(snapshot, {
      noteId: 'legacy-metadata',
      type: 'changeNoteType',
      value: 'Project',
    })
    const archived = applyMobileWorkspaceEditWithWrites(typed.snapshot, {
      archived: true,
      noteId: 'legacy-metadata',
      type: 'setArchived',
    })
    const iconed = applyMobileWorkspaceEditWithWrites(archived.snapshot, {
      key: 'icon',
      noteId: 'legacy-metadata',
      type: 'updateProperty',
      value: 'star',
    })
    const sorted = applyMobileWorkspaceEditWithWrites(iconed.snapshot, {
      key: '_sort',
      noteId: 'legacy-metadata',
      type: 'deleteProperty',
    })
    const favorited = applyMobileWorkspaceEditWithWrites(sorted.snapshot, {
      noteId: 'legacy-metadata',
      type: 'toggleFavorite',
    })
    const note = noteById(favorited.snapshot, 'legacy-metadata')

    expect(note).toMatchObject({
      archived: true,
      favorite: true,
      type: 'Project',
    })
    expect(note.rawContent).toContain('type: Project')
    expect(note.rawContent).toContain('_archived: true')
    expect(note.rawContent).toContain('_favorite: true')
    expect(note.rawContent).toContain('_favorite_index:')
    expect(note.rawContent).toContain('_icon: star')
    expect(note.rawContent).not.toContain('"Is A":')
    expect(note.rawContent).not.toContain('archived: false')
    expect(note.rawContent).not.toContain('\nfavorite:')
    expect(note.rawContent).not.toContain('\nfavorite_index:')
    expect(note.rawContent).not.toContain('\nicon:')
    expect(note.rawContent).not.toContain('\nsort:')
    expect(note.rawContent).not.toContain('\n_sort:')
  })

  it('quotes desktop frontmatter keys with special characters during direct writes', () => {
    const content = writeMobileFrontmatterContentValue(
      '---\ntype: Note\n---\n# Note\n',
      'key:value',
      'kept',
    )

    expect(content).toContain('"key:value": kept')
    expect(frontmatterProperties(parseLocalVaultDocument(content).frontmatter)).toMatchObject({
      'key:value': 'kept',
    })
  })

  it('keeps an existing old-cased Status key when only its value changes (TOL-466)', () => {
    const content = writeMobileFrontmatterContentValue(
      '---\ntype: Project\nStatus: Draft\nBelongs to: "[[Q1]]"\n---\n# Note\n',
      'status',
      'active',
    )

    expect(content).toBe('---\ntype: Project\nStatus: active\nBelongs to: "[[Q1]]"\n---\n# Note\n')
  })

  it('writes a lowercase status key when the note has none (TOL-466)', () => {
    const content = writeMobileFrontmatterContentValue('---\ntype: Note\n---\n# Note\n', 'Status', 'done')

    expect(content).toContain('\nstatus: done')
    expect(content).not.toContain('Status:')
  })

  it('keeps an existing Tags key and lowercase tag values (TOL-466)', () => {
    const content = writeMobileFrontmatterContentValue(
      '---\nTags:\n  - old\n---\n# Note\n',
      'tags',
      ['design', 'ai'],
    )

    expect(content).toContain('\nTags:\n  - design\n  - ai')
    expect(content).not.toContain('\ntags:')
  })

  it('leaves a single status key when the note has duplicate status aliases', () => {
    const content = writeMobileFrontmatterContentValue(
      '---\nStatus: Draft\nstatus: draft\n---\n# Note\n',
      'status',
      'done',
    )

    expect(content.match(/^status: done$/gimu)).toHaveLength(1)
  })

  it('canonicalizes title aliases during direct writes', () => {
    const content = writeMobileFrontmatterContentValue(
      '---\nTitle: Old title\n---\n# Note\n',
      'title',
      'New title',
    )

    expect(content).toContain('\ntitle: New title')
    expect(content).not.toContain('\nTitle:')
  })
})

function snapshotWithLegacyMetadataNote(): MobileWorkspaceSnapshot {
  const base = workspaceScenarioForId('default')
  const legacyNote: MobileNote = {
    ...base.notes[0],
    archived: false,
    id: 'legacy-metadata',
    path: 'legacy-metadata.md',
    rawContent: `---
"Is A": Note
archived: false
favorite: false
favorite_index: 3
icon: rocket
sort: modified:desc
_sort: title:asc
---
# Legacy Metadata

Body.
`,
    title: 'Legacy Metadata',
    type: 'Note',
  }
  return {
    ...base,
    allNotes: [legacyNote, ...base.notes.slice(1)],
    notes: [legacyNote, ...base.notes.slice(1)],
    selectedNoteId: legacyNote.id,
  }
}

function noteById(snapshot: MobileWorkspaceSnapshot, noteId: string): MobileNote {
  const note = snapshot.notes.find((candidate) => candidate.id === noteId)
  expect(note).toBeDefined()
  return note as MobileNote
}
