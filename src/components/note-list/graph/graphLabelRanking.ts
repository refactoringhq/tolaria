import type { GraphNodeModel } from './graphModel'

/** Labels are DOM: above this many notes only the best-connected ones (plus forced ones) get a chip. */
export const LABEL_DOM_LIMIT = 2000

/** What the labels emphasise: the hovered note grows, notes outside the strong set dim. */
export interface LabelEmphasis {
  hovered: string | null
  /** The focused (clicked) note and its neighbours; their labels show at any zoom. */
  focused: ReadonlySet<string> | null
  /** Notes kept at full strength by the hover or focus; null when nothing is emphasised. */
  strong: ReadonlySet<string> | null
}

/** Most links first, then by title: the order labels claim room in. */
export function rankLabels(nodes: readonly GraphNodeModel[]): GraphNodeModel[] {
  return [...nodes].sort((left, right) => right.degree - left.degree || left.entry.title.localeCompare(right.entry.title))
}

/** Every note is eligible for a label; past the DOM limit, the best-connected ones plus the forced ones. */
export function labelledNodes(ranked: readonly GraphNodeModel[], forced: ReadonlySet<string>): GraphNodeModel[] {
  if (ranked.length <= LABEL_DOM_LIMIT) return [...ranked]
  const labelled = ranked.slice(0, LABEL_DOM_LIMIT)
  return [...labelled, ...ranked.slice(LABEL_DOM_LIMIT).filter((node) => forced.has(node.id))]
}

/** Priority: the hovered note, then the open note, then the focused neighbourhood, then by rank. */
export function forcedLabels(emphasis: LabelEmphasis, selectedNotePath: string | null): string[] {
  const forced = [emphasis.hovered, selectedNotePath, ...(emphasis.focused ?? [])].filter((id): id is string => Boolean(id))
  return [...new Set(forced)]
}
