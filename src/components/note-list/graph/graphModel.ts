import type { GraphSettings } from '../../../collections/collectionTypes'
import type { VaultEntry } from '../../../types'
import { resolveEntry } from '../../../utils/wikilink'
import { matchesGraphQuery, parseGraphQuery } from './graphQuery'

/** Type key for notes without a type, used by the type filter. */
export const UNTYPED_GRAPH_KEY = ''

/** The synthetic `Type` relationship the vault adds from `type:`; the node color already shows it. */
const TYPE_RELATIONSHIP_KEY = 'Type'

type LegacyRelationship = readonly [(entry: VaultEntry) => string[] | undefined, string, string]

const LEGACY_RELATIONSHIP_KEYS: readonly LegacyRelationship[] = [
  [(entry) => entry.belongsTo, 'belongs_to', 'Belongs to'],
  [(entry) => entry.relatedTo, 'related_to', 'Related to'],
]

export const MIN_NODE_SIZE = 5
export const MAX_NODE_SIZE = 16

export type GraphEdgeKind = 'relationship' | 'wikilink'

/** Which way the links of a pair point, relative to its (sorted) source and target. */
export type GraphEdgeDirection = 'forward' | 'backward' | 'both'

/** One unordered pair of notes in the list and everything that links them. */
export interface GraphPair {
  id: string
  source: string
  target: string
  relationships: string[]
  wikiLink: boolean
  /** A link goes from `source` to `target`. */
  forward: boolean
  /** A link goes from `target` to `source`. */
  backward: boolean
}

export interface GraphData {
  entries: VaultEntry[]
  pairs: GraphPair[]
  relationshipKeys: string[]
  typeKeys: string[]
}

export interface GraphNodeModel {
  id: string
  entry: VaultEntry
  typeKey: string
  degree: number
  size: number
}

export interface GraphEdgeModel {
  id: string
  source: string
  target: string
  kind: GraphEdgeKind
  labels: string[]
  direction: GraphEdgeDirection
}

export interface VisibleGraph {
  nodes: GraphNodeModel[]
  edges: GraphEdgeModel[]
}

interface LinkSource {
  entry: VaultEntry
  allEntries: VaultEntry[]
  listPaths: ReadonlySet<string>
}

interface PairCollector {
  pairs: Map<string, GraphPair>
  relationshipKeys: Set<string>
}

/** `[[target|alias]]` or `target#heading` → `target`. */
export function linkTarget(reference: string): string {
  const inner = reference.trim().replace(/^\[\[/, '').replace(/\]\]$/, '')
  return inner.split('|')[0].split('#')[0].trim()
}

export function graphTypeKey(entry: VaultEntry): string {
  return entry.isA ?? UNTYPED_GRAPH_KEY
}

function legacyReferences(entry: VaultEntry, keys: ReadonlySet<string>): Array<[string, string[]]> {
  return LEGACY_RELATIONSHIP_KEYS
    .filter(([, canonical, legacy]) => !keys.has(canonical) && !keys.has(legacy))
    .map(([read, canonical]): [string, string[]] => [canonical, read(entry) ?? []])
    .filter(([, values]) => values.length > 0)
}

/** The relationship references a note carries, by key; the legacy list fields fill in keys the map lacks. */
export function relationshipReferences(entry: VaultEntry): Array<[string, string[]]> {
  const references = Object.entries(entry.relationships ?? {}).filter(([key]) => key !== TYPE_RELATIONSHIP_KEY)
  return [...references, ...legacyReferences(entry, new Set(references.map(([key]) => key)))]
}

function resolveListTarget({ entry, allEntries, listPaths }: LinkSource, reference: string): string | null {
  const target = linkTarget(reference)
  if (!target) return null
  const resolved = resolveEntry(allEntries, target, entry)
  if (!resolved || resolved.path === entry.path || !listPaths.has(resolved.path)) return null
  return resolved.path
}

function pairFor(collector: PairCollector, from: string, to: string): GraphPair {
  const [source, target] = from < to ? [from, to] : [to, from]
  const id = `${source}\n${target}`
  const pair = collector.pairs.get(id) ?? { id, source, target, relationships: [], wikiLink: false, forward: false, backward: false }
  collector.pairs.set(id, pair)
  if (from === source) pair.forward = true
  else pair.backward = true
  return pair
}

function collectRelationships(collector: PairCollector, link: LinkSource) {
  for (const [key, references] of relationshipReferences(link.entry)) {
    for (const reference of references) {
      const target = resolveListTarget(link, reference)
      if (!target) continue
      const pair = pairFor(collector, link.entry.path, target)
      if (!pair.relationships.includes(key)) pair.relationships.push(key)
      collector.relationshipKeys.add(key)
    }
  }
}

function collectWikiLinks(collector: PairCollector, link: LinkSource) {
  for (const reference of link.entry.outgoingLinks ?? []) {
    const target = resolveListTarget(link, reference)
    if (target) pairFor(collector, link.entry.path, target).wikiLink = true
  }
}

function sortedKeys(keys: Iterable<string>): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right))
}

/**
 * Every link between two notes of the list, one pair per note pair. Links resolve against the whole vault
 * (aliases included) and are kept only when both notes are in the list.
 */
export function buildGraphData(entries: VaultEntry[], allEntries: VaultEntry[]): GraphData {
  const listPaths = new Set(entries.map((entry) => entry.path))
  const collector: PairCollector = { pairs: new Map(), relationshipKeys: new Set() }
  for (const entry of entries) {
    const link = { entry, allEntries, listPaths }
    collectRelationships(collector, link)
    collectWikiLinks(collector, link)
  }
  return {
    entries,
    pairs: [...collector.pairs.values()],
    relationshipKeys: sortedKeys(collector.relationshipKeys),
    typeKeys: sortedKeys(new Set(entries.map(graphTypeKey))),
  }
}

function pairDirection(pair: GraphPair): GraphEdgeDirection {
  if (pair.forward && pair.backward) return 'both'
  return pair.backward ? 'backward' : 'forward'
}

/** A relationship wins over a wiki link for the same pair; hidden relationship keys fall back to the wiki link. */
function visibleEdge(pair: GraphPair, settings: GraphSettings): GraphEdgeModel | null {
  const labels = pair.relationships.filter((key) => !settings.hiddenRelationships.includes(key))
  const base = { id: pair.id, source: pair.source, target: pair.target, direction: pairDirection(pair) }
  if (labels.length > 0) return { ...base, kind: 'relationship', labels }
  if (pair.wikiLink && settings.showWikiLinks) return { ...base, kind: 'wikilink', labels: [] }
  return null
}

/** Lists bigger than this draw smaller nodes, so a dense graph stays readable at fit. */
const FULL_SIZE_NODE_COUNT = 150
const MIN_SIZE_SCALE = 0.45

export function nodeSize(degree: number, nodeCount = 0): number {
  const scale = Math.min(1, Math.max(MIN_SIZE_SCALE, Math.sqrt(FULL_SIZE_NODE_COUNT / Math.max(nodeCount, 1))))
  return Math.min(MAX_NODE_SIZE, MIN_NODE_SIZE + Math.sqrt(degree) * 3) * scale
}

function countDegrees(edges: readonly GraphEdgeModel[]): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const { source, target } of edges) {
    degrees.set(source, (degrees.get(source) ?? 0) + 1)
    degrees.set(target, (degrees.get(target) ?? 0) + 1)
  }
  return degrees
}

/** Applies the legend filters: the search and hidden types drop their notes, then edges, then (optionally) orphans. */
export function visibleGraph(data: GraphData, settings: GraphSettings): VisibleGraph {
  const terms = parseGraphQuery(settings.search)
  const shown = data.entries.filter((entry) => !settings.hiddenTypes.includes(graphTypeKey(entry)) && matchesGraphQuery(entry, terms))
  const shownPaths = new Set(shown.map((entry) => entry.path))
  const edges: GraphEdgeModel[] = []
  for (const pair of data.pairs) {
    if (!shownPaths.has(pair.source) || !shownPaths.has(pair.target)) continue
    const edge = visibleEdge(pair, settings)
    if (edge) edges.push(edge)
  }
  const degrees = countDegrees(edges)
  const kept = shown.filter((entry) => settings.showOrphans || degrees.has(entry.path))
  const nodes = kept.map((entry) => {
    const degree = degrees.get(entry.path) ?? 0
    return { id: entry.path, entry, typeKey: graphTypeKey(entry), degree, size: nodeSize(degree, kept.length) }
  })
  return { nodes, edges }
}

/** True when no two notes of the list are linked at all, before any filter. */
export function hasNoConnections(data: GraphData): boolean {
  return data.pairs.length === 0
}
