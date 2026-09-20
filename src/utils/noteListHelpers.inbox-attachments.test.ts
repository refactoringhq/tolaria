import { describe, expect, it } from 'vitest'

import { makeEntry } from '../test-utils/noteListTestUtils'
import {
  countInboxByPeriod,
  filterInboxEntries,
  isAllNotesEntry,
  isInboxEntry,
} from './noteListHelpers'

describe('Inbox attachment eligibility', () => {
  it('matches All Notes by excluding Markdown anywhere under attachments', () => {
    const createdAt = Math.floor(Date.now() / 1000)
    const rootNote = makeEntry({ path: '/vault/note.md', title: 'Root note', createdAt })
    const nestedAttachment = makeEntry({
      path: '/vault/attachments/transcripts/meeting.md',
      title: 'Meeting transcript',
      createdAt,
    })
    const similarlyNamedFolder = makeEntry({
      path: '/vault/my-attachments/keep.md',
      title: 'Keep this note',
      createdAt,
    })

    expect(isAllNotesEntry(nestedAttachment)).toBe(false)
    expect(isInboxEntry(nestedAttachment)).toBe(false)
    expect(filterInboxEntries([rootNote, nestedAttachment, similarlyNamedFolder], 'all'))
      .toEqual([rootNote, similarlyNamedFolder])
    expect(countInboxByPeriod([rootNote, nestedAttachment, similarlyNamedFolder]).all).toBe(2)
  })
})
