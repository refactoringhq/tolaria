import { describe, expect, it } from 'vitest'
import { isWritableGroupKey, readStoredLayout } from './collectionLayoutConfig'

describe('collectionLayoutConfig', () => {
  it('only writes Kanban drops to single-line keys the board notes already carry', () => {
    expect(isWritableGroupKey('status', ['status', 'owner'])).toBe(true)
    expect(isWritableGroupKey('priority', ['status'])).toBe(false)
    expect(isWritableGroupKey('', [''])).toBe(false)
    expect(isWritableGroupKey(' status', [' status'])).toBe(false)
    expect(isWritableGroupKey('status\nowner: x', ['status\nowner: x'])).toBe(false)
    expect(isWritableGroupKey('Due date', ['Due date'])).toBe(true)
    expect(isWritableGroupKey('belongs_to', ['belongs_to'])).toBe(true)
    for (const yamlSyntax of ['owner: x', '[status]', '{status}', '#status', 'status # note', '&anchor', '*alias', "'status'", '"status"', 'a|b', 'a>b', '-status']) {
      expect(isWritableGroupKey(yamlSyntax, [yamlSyntax])).toBe(false)
    }
    for (const lineBreak of ['\u0085', '\u2028', '\u2029']) {
      const key = `status${lineBreak}owner: x`
      expect(isWritableGroupKey(key, [key])).toBe(false)
    }
  })

  it('reads stored layout files defensively', () => {
    expect(readStoredLayout({ type: 'kanban', groupBy: 7, properties: ['owner', 3], columnOrder: 'Done' })).toEqual({
      layout: 'kanban', groupBy: 'status', properties: ['owner'], columnOrder: [], collapsedColumns: [], hiddenColumns: [],
      calendar: { dateProperty: null, endDateProperty: null, view: 'month', showWeekends: true },
      graph: { showWikiLinks: true, hiddenRelationships: [], hiddenTypes: [], showOrphans: true, showLabels: true },
    })
    expect(readStoredLayout({ type: 'kanban', collapsedColumns: ['Done', 4, ''], hiddenColumns: 'Doing' })).toMatchObject({
      collapsedColumns: ['Done', ''], hiddenColumns: [],
    })
    expect(readStoredLayout({ type: 'calendar', dateProperty: 'due', view: 'year', showWeekends: 'no' })).toMatchObject({
      layout: 'calendar', calendar: { dateProperty: 'due', endDateProperty: null, view: 'month', showWeekends: true },
    })
    expect(readStoredLayout({ type: 'graph', showWikiLinks: false, hiddenRelationships: ['owner', 2], showOrphans: 'no', showLabels: false })).toMatchObject({
      layout: 'graph', graph: { showWikiLinks: false, hiddenRelationships: ['owner'], hiddenTypes: [], showOrphans: true, showLabels: false },
    })
    expect(readStoredLayout({ type: 'timeline' })).toBeUndefined()
    expect(readStoredLayout(['kanban'])).toBeUndefined()
  })
})
