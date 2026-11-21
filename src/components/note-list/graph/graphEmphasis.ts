
/** What the graph is emphasising: the hovered note wins over the focused (clicked) one. */
export interface EmphasisSubject {
  hovered: string | null
  focused: string | null
}

/** Opacity of everything outside the emphasised neighbourhood. */
export const DIM_NODE_OPACITY = 0.12
export const DIM_EDGE_OPACITY = 0.06

/** Who a note links to, either way. */
export type Neighbours = (node: string) => readonly string[]

/** Neighbour lookup over a list of links. */
export function neighboursIn(edges: readonly { source: string; target: string }[]): Neighbours {
  const lookup = new Map<string, string[]>()
  const link = (from: string, to: string) => {
    const list = lookup.get(from)
    if (list) list.push(to)
    else lookup.set(from, [to])
  }
  for (const { source, target } of edges) {
    link(source, target)
    link(target, source)
  }
  return (node) => lookup.get(node) ?? []
}

/** A note and its direct neighbours. */
export function neighbourhood(neighbours: Neighbours, node: string): Set<string> {
  return new Set<string>([node, ...neighbours(node)])
}

/** The notes kept at full strength, or null when nothing is emphasised (everything strong). */
export function strongNodes(neighbours: Neighbours, subject: EmphasisSubject): Set<string> | null {
  const center = subject.hovered ?? subject.focused
  return center ? neighbourhood(neighbours, center) : null
}

export interface EmphasisTarget {
  nodeFade: (node: string) => number
  nodeAccent: (node: string) => number
  edgeFade: (source: string, target: string) => number
}

export function emphasisTarget(strong: ReadonlySet<string> | null, hovered: string | null): EmphasisTarget {
  return {
    nodeFade: (node) => (!strong || strong.has(node) ? 1 : DIM_NODE_OPACITY),
    nodeAccent: (node) => (node === hovered ? 1 : 0),
    edgeFade: (source, target) => (!strong || (strong.has(source) && strong.has(target)) ? 1 : DIM_EDGE_OPACITY),
  }
}
