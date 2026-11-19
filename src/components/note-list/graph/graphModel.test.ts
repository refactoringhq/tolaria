import { describe, expect, it } from 'vitest'
import type { GraphSettings } from '../../../collections/collectionTypes'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import {
  buildGraphData,
  hasNoConnections,
  linkTarget,
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
  nodeSize,
  relationshipReferences,
  UNTYPED_GRAPH_KEY,
  visibleGraph,
} from './graphModel'

const ALL: GraphSettings = { showWikiLinks: true, hiddenRelationships: [], hiddenTypes: [], showOrphans: true, showLabels: true }

const project = makeEntry({
  path: '/v/project.md', filename: 'project.md', title: 'Launch Project', isA: 'Project',
  relationships: { owner: ['[[person-ada]]'], Type: ['[[project]]'] },
  belongsTo: ['[[q4]]'],
  outgoingLinks: ['person-ada', 'Writing Guide'],
})
const person = makeEntry({
  path: '/v/person-ada.md', filename: 'person-ada.md', title: 'Ada', isA: 'Person',
  relationships: { projects: ['[[Launch Project]]'] },
})
const quarter = makeEntry({ path: '/v/q4.md', filename: 'q4.md', title: 'Q4', isA: 'Quarter' })
const guide = makeEntry({
  path: '/v/guide.md', filename: 'guide.md', title: 'Guide', isA: null, aliases: ['Writing Guide'],
  outgoingLinks: ['[[q4|the quarter]]', 'missing-note', 'outside'],
})
const outside = makeEntry({ path: '/v/outside.md', filename: 'outside.md', title: 'Outside', isA: 'Note' })
const lonely = makeEntry({ path: '/v/lonely.md', filename: 'lonely.md', title: 'Lonely', isA: 'Note' })

const list = [project, person, quarter, guide, lonely]
const vault = [...list, outside]

function edgeSummary(settings: GraphSettings = ALL) {
  return visibleGraph(buildGraphData(list, vault), settings).edges
    .map((edge) => `${edge.source.slice(3, -3)}-${edge.target.slice(3, -3)}:${edge.kind}:${edge.labels.join('+')}`)
    .sort()
}

describe('graphModel', () => {
  it('reads link targets out of wikilink syntax, aliases and headings', () => {
    expect(linkTarget('[[person-ada]]')).toBe('person-ada')
    expect(linkTarget('[[q4|the quarter]]')).toBe('q4')
    expect(linkTarget('guide#Intro')).toBe('guide')
  })

  it('takes relationships from the map, skips the synthetic Type key and fills legacy list fields', () => {
    expect(relationshipReferences(project)).toEqual([['owner', ['[[person-ada]]']], ['belongs_to', ['[[q4]]']]])
    const mapped = makeEntry({ relationships: { belongs_to: ['[[q4]]'] }, belongsTo: ['[[q4]]'] })
    expect(relationshipReferences(mapped)).toEqual([['belongs_to', ['[[q4]]']]])
  })

  it('builds one edge per pair: reciprocal relationships merge, a relationship beats a wiki link', () => {
    expect(edgeSummary()).toEqual([
      'guide-project:wikilink:',
      'guide-q4:wikilink:',
      'person-ada-project:relationship:owner+projects',
      'project-q4:relationship:belongs_to',
    ])
  })

  it('resolves aliases and drops links to notes outside the list, missing notes and self links', () => {
    const data = buildGraphData(list, vault)
    expect(data.pairs.some((pair) => pair.target === outside.path || pair.source === outside.path)).toBe(false)
    expect(data.pairs.find((pair) => pair.source === guide.path && pair.target === project.path)?.wikiLink).toBe(true)
    const selfLinked = makeEntry({ path: '/v/self.md', filename: 'self.md', outgoingLinks: ['self'] })
    expect(buildGraphData([selfLinked], [selfLinked]).pairs).toEqual([])
  })

  it('lists the relationship keys and types the legend can filter', () => {
    const data = buildGraphData(list, vault)
    expect(data.relationshipKeys).toEqual(['belongs_to', 'owner', 'projects'])
    expect(data.typeKeys).toEqual([UNTYPED_GRAPH_KEY, 'Note', 'Person', 'Project', 'Quarter'])
  })

  it('hides wiki-link edges when they are off', () => {
    expect(edgeSummary({ ...ALL, showWikiLinks: false })).toEqual([
      'person-ada-project:relationship:owner+projects',
      'project-q4:relationship:belongs_to',
    ])
  })

  it('hides one relationship key, keeping other keys of the same pair', () => {
    expect(edgeSummary({ ...ALL, hiddenRelationships: ['owner', 'belongs_to'] })).toEqual([
      'guide-project:wikilink:',
      'guide-q4:wikilink:',
      'person-ada-project:relationship:projects',
    ])
  })

  it('falls back to the wiki link when every relationship of a pair is hidden', () => {
    expect(edgeSummary({ ...ALL, hiddenRelationships: ['owner', 'projects'] })).toContain('person-ada-project:wikilink:')
  })

  it('hides a type with its notes and their edges, untyped notes included', () => {
    const graph = visibleGraph(buildGraphData(list, vault), { ...ALL, hiddenTypes: ['Person', UNTYPED_GRAPH_KEY] })
    expect(graph.nodes.map((node) => node.entry.title)).toEqual(['Launch Project', 'Q4', 'Lonely'])
    expect(graph.edges.map((edge) => edge.labels.join('+'))).toEqual(['belongs_to'])
  })

  it('shows or hides orphans', () => {
    const data = buildGraphData(list, vault)
    expect(visibleGraph(data, ALL).nodes.map((node) => node.entry.title)).toContain('Lonely')
    expect(visibleGraph(data, { ...ALL, showOrphans: false }).nodes.map((node) => node.entry.title)).not.toContain('Lonely')
  })

  it('sizes nodes by connection count within bounds', () => {
    const nodes = visibleGraph(buildGraphData(list, vault), ALL).nodes
    expect(nodes.find((node) => node.entry.title === 'Launch Project')?.degree).toBe(3)
    expect(nodeSize(0)).toBe(MIN_NODE_SIZE)
    expect(nodeSize(3)).toBeGreaterThan(nodeSize(1))
    expect(nodeSize(10_000)).toBe(MAX_NODE_SIZE)
  })

  it('reports a list without any connection', () => {
    expect(hasNoConnections(buildGraphData([lonely, outside], vault))).toBe(true)
    expect(hasNoConnections(buildGraphData(list, vault))).toBe(false)
  })
})
