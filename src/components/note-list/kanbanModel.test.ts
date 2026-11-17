import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import {
  cardDisplayProperties,
  cardId,
  columnFromId,
  columnId,
  groupEntries,
  groupValueFor,
  hiddenColumnSummaries,
  isCardId,
  moveColumn,
  orderColumns,
  settlePendingMoves,
  toggleColumnValue,
  visibleColumns,
} from './kanbanModel'

const alpha = makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing', properties: { owner: 'Ada', tags: ['x', 'y'] } })
const beta = makeEntry({ path: '/vault/b.md', title: 'Beta', status: null })
const gamma = makeEntry({ path: '/vault/c.md', title: 'Gamma', status: 'Done' })

describe('kanbanModel', () => {
  it('groups entries by property, keeps missing values, and lets pending drops win', () => {
    expect(groupValueFor(alpha, 'tags')).toBe('x, y')
    expect(groupValueFor(alpha, 'missing')).toBe('')
    const grouped = groupEntries([alpha, beta, gamma], 'status', new Map([['/vault/c.md', 'Doing']]))
    expect(grouped.get('Doing')?.map((entry) => entry.title)).toEqual(['Alpha', 'Gamma'])
    expect(grouped.get('')?.map((entry) => entry.title)).toEqual(['Beta'])
    expect(grouped.has('Done')).toBe(false)
  })

  it('orders saved columns first, new values alphabetically, and "No value" last by default', () => {
    expect(orderColumns(['Doing', '', 'Backlog'], [])).toEqual(['Backlog', 'Doing', ''])
    expect(orderColumns(['Doing', 'Backlog'], ['Doing', 'Gone', ''])).toEqual(['Doing', '', 'Backlog'])
  })

  it('moves a column to the drop target position', () => {
    expect(moveColumn(['A', 'B', 'C'], 'A', 'C')).toEqual(['B', 'C', 'A'])
    expect(moveColumn(['A', 'B', 'C'], 'C', 'A')).toEqual(['C', 'A', 'B'])
    const unchanged = ['A', 'B']
    expect(moveColumn(unchanged, 'A', 'missing')).toBe(unchanged)
  })

  it('settles pending drops once the entry carries the new value or leaves the list', () => {
    const pending = new Map([['/vault/a.md', 'Done'], ['/vault/b.md', 'Doing'], ['/vault/z.md', 'Done']])
    const settled = settlePendingMoves(pending, [{ ...alpha, status: 'Done' }, beta], 'status')
    expect([...settled.entries()]).toEqual([['/vault/b.md', 'Doing']])
    const empty = new Map<string, string>()
    expect(settlePendingMoves(empty, [alpha], 'status')).toBe(empty)
    const stillPending = new Map([['/vault/b.md', 'Doing']])
    expect(settlePendingMoves(stillPending, [beta], 'status')).toBe(stillPending)
  })

  it('uses card fields, then the list properties, then the type defaults', () => {
    const typeEntryMap = { Project: makeEntry({ title: 'Project', listPropertiesDisplay: ['owner'] }) }
    const project = { ...alpha, isA: 'Project' }
    expect(cardDisplayProperties(project, ['status'], typeEntryMap, ['tags'])).toEqual(['status'])
    expect(cardDisplayProperties(project, [], typeEntryMap, ['tags'])).toEqual(['tags'])
    expect(cardDisplayProperties(project, [], typeEntryMap, null)).toEqual(['owner'])
    expect(cardDisplayProperties(beta, [], typeEntryMap)).toEqual([])
  })

  it('encodes drag ids for cards and columns', () => {
    expect(columnFromId(columnId(''))).toBe('')
    expect(columnFromId(cardId('/vault/a.md'))).toBeUndefined()
    expect(columnFromId(42)).toBeUndefined()
    expect(isCardId(cardId('/vault/a.md'))).toBe(true)
    expect(isCardId(columnId('Doing'))).toBe(false)
  })

  it('toggles a column value in a collapsed or hidden list, including the "No value" column', () => {
    expect(toggleColumnValue(['Doing'], 'Done')).toEqual(['Doing', 'Done'])
    expect(toggleColumnValue(['Doing', 'Done'], 'Doing')).toEqual(['Done'])
    expect(toggleColumnValue([], '')).toEqual([''])
    expect(toggleColumnValue([''], '')).toEqual([])
  })

  it('leaves hidden columns out of the board and lists them in board order with their counts', () => {
    const grouped = groupEntries([alpha, beta, gamma], 'status')
    const columns = orderColumns(grouped.keys(), ['Done'])
    expect(visibleColumns(columns, ['Doing', 'Archived'])).toEqual(['Done', ''])
    expect(hiddenColumnSummaries(columns, ['', 'Done', 'Archived'], grouped)).toEqual([
      { group: 'Done', count: 1 },
      { group: '', count: 1 },
    ])
    expect(hiddenColumnSummaries(columns, [], grouped)).toEqual([])
  })
})
