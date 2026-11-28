import { describe, expect, it } from 'vitest'
import { mobileNoteDisplayLabels, mobileNoteRowChips, statusTone } from './mobileNoteDisplay'
import type { MobileNote } from './mobileWorkspaceModel'

describe('mobile status tone (TOL-466)', () => {
  it.each([
    ['active', 'Active'],
    ['shipped', 'Shipped'],
    ['ACTIVE', 'Active'],
  ])('gives %s the same tone as %s', (lower, cased) => {
    expect(statusTone(lower)).toBe(statusTone(cased))
  })

  it('keeps the existing known tones', () => {
    expect(statusTone('active')).toBe('blue')
    expect(statusTone('shipped')).toBe('green')
    expect(statusTone('draft')).toBe('orange')
  })
})

describe('mobile note display', () => {
  it('formats configured custom property chips with desktop note-list semantics', () => {
    const candidate = note({
      properties: [
        { key: 'Due Date', label: 'Due Date', value: '2026-06-14' },
        { key: 'URL', label: 'URL', value: 'https://tolaria.app/docs' },
        { key: 'Published', label: 'Published', value: false },
        { key: 'Areas', label: 'Areas', value: ['Design', 'AI'] },
      ],
    })

    expect(mobileNoteDisplayLabels(candidate, ['Due Date', 'URL', 'Published', 'Areas'])).toEqual([
      'Jun 14, 2026',
      'tolaria.app',
      'false',
      'Design',
      'AI',
    ])
    expect(mobileNoteRowChips(candidate, ['URL'])[0]).toMatchObject({
      label: 'tolaria.app',
      tone: 'blue',
    })
  })

  it('honors persisted desktop display modes for note-list chips', () => {
    const candidate = note({
      properties: [
        { key: 'Website', label: 'Website', value: 'tolaria.app/docs' },
        { key: 'Priority', label: 'Priority', value: 'High' },
      ],
    })

    expect(mobileNoteRowChips(candidate, ['Website', 'Priority'], undefined, {
      Priority: 'status',
      Website: 'url',
    })).toEqual([
      { label: 'tolaria.app', tone: 'blue' },
      { label: 'High', tone: 'orange' },
    ])
  })

  it('uses normalized desktop relationship keys for configured relationship chips', () => {
    const candidate = note({
      relationships: [
        {
          kind: 'belongsTo',
          label: 'Belongs to',
          values: [{ title: 'Roadmap', type: 'Project', typeTone: 'green' }],
        },
        {
          key: 'has_part',
          kind: 'has',
          label: 'Has part',
          values: [{ title: 'Milestone', type: 'Note', typeTone: 'purple' }],
        },
      ],
    })

    expect(mobileNoteRowChips(candidate, ['belongs_to'])).toEqual([
      { label: 'Roadmap', tone: 'green' },
    ])
    expect(mobileNoteRowChips(candidate, ['has'])).toEqual([])
    expect(mobileNoteRowChips(candidate, ['has_part'])).toEqual([
      { label: 'Milestone', tone: 'purple' },
    ])
  })
})

function note(overrides: Partial<MobileNote>): MobileNote {
  return {
    created: '-',
    date: '-',
    favorite: false,
    id: 'note',
    links: 0,
    modified: '-',
    relationships: [],
    snippet: '',
    status: '',
    tags: [],
    title: 'Note',
    type: 'Note',
    typeTone: 'gray',
    workspace: 'TV',
    ...overrides,
  }
}
