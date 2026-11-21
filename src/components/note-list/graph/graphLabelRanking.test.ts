import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import { forcedLabels, LABEL_DOM_LIMIT, labelledNodes, rankLabels } from './graphLabelRanking'
import type { GraphNodeModel } from './graphModel'

function node(index: number, degree: number): GraphNodeModel {
  const entry = makeEntry({ path: `/v/${index}.md`, title: `N${String(index).padStart(5, '0')}` })
  return { id: entry.path, entry, typeKey: '', degree, size: 5 }
}

describe('graph label eligibility', () => {
  it('ranks by links, then by title', () => {
    expect(rankLabels([node(2, 1), node(1, 1), node(3, 4)]).map((item) => item.id)).toEqual(['/v/3.md', '/v/1.md', '/v/2.md'])
  })

  it('makes every note eligible below the DOM limit', () => {
    const ranked = rankLabels(Array.from({ length: 40 }, (_, index) => node(index, index % 3)))
    expect(labelledNodes(ranked, new Set())).toHaveLength(40)
  })

  it('past the DOM limit keeps the best-connected notes plus the forced ones', () => {
    const ranked = rankLabels(Array.from({ length: LABEL_DOM_LIMIT + 10 }, (_, index) => node(index, index)))
    const weakest = ranked.at(-1)?.id ?? ''
    const labelled = labelledNodes(ranked, new Set([weakest]))
    expect(labelled).toHaveLength(LABEL_DOM_LIMIT + 1)
    expect(labelled.at(-1)?.id).toBe(weakest)
  })

  it('orders forced labels hovered, open, then focused, without repeats', () => {
    expect(forcedLabels({ hovered: 'b', focused: new Set(['a', 'b', 'c']), strong: null }, 'a')).toEqual(['b', 'a', 'c'])
    expect(forcedLabels({ hovered: null, focused: null, strong: null }, null)).toEqual([])
  })
})
