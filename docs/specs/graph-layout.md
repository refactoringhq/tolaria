# Graph layout

Spec and benchmark for the Graph collection layout (TOL-382). Step 1 (TOL-385) builds the first working version behind the `graph_layout` feature flag; step 2 adds motion polish, hover highlight and search; step 3 covers big-vault performance.

## Benchmark notes (2026-11-19)

This is a product interaction benchmark, not a pixel-copy exercise. Public product documentation and published demonstrations were reviewed before implementation. These references are behavioral evidence, not measurements of Tolaria or comparative frame-rate tests.

| Reference | Adopt | Skip |
| -- | -- | -- |
| [Obsidian Graph view](https://obsidian.md/help/Plugins/Graph%2Bview) | Search, orphan toggle, groups/colors, local-neighbor emphasis, and a navigable note graph. Its global graph exposes filters and groups; its local graph has an explicit depth control. | A global-vault-only graph; Tolaria's graph belongs to the selected collection. |
| [Logseq graph documentation](https://docs.logseq.com/#/graph) and [Graph View V2 announcement](https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020) | Treat links as paths between pages, make graph navigation support returning to note content, and keep graph access discoverable. The V2 follow-up calls out neighborhood focus and interaction polish. | Block-level nodes and a separate graph-only workflow; Tolaria's nodes remain notes and use the existing editor panel. The sources do not specify motion timings, so no timing comparison is claimed. |
| [Heptabase whiteboard changelog](https://wiki.heptabase.com/changelog) and [performance troubleshooting](https://support.heptabase.com/en/articles/11430704-troubleshoot-performance-and-lag) | Search/focus should locate a card in a spatial canvas; calm panning and dragging matter on large workspaces. The changelog explicitly calls out large-whiteboard drag performance, and its troubleshooting guide identifies content complexity as a performance factor. | Manual card placement and whiteboards are a different product model from a generated relationship graph. Tolaria derives nodes and edges from note data and keeps positions session-only. |
| [Kumu tour](https://www.help.kumu.io/tour) | Use explicit relationship semantics and progressive presentation of connected structures. | Manual map authoring and hand-positioned layouts; Tolaria derives its graph from note data and positions are session-only. |
| [Sigma.js performance guide](https://www.sigmajs.org/how-to/technical/performance/) and [rendering layers](https://www.sigmajs.org/docs/advanced/layers/) | WebGL rendering and separate rendering layers support avoiding one DOM element per note and adding a small accessible overlay. Low-contrast edges can reduce aliasing visibility. | Main-thread SVG/DOM rendering for the tens-of-thousands target. Sigma's published capability is not a Tolaria benchmark result. |

This benchmark used public product documentation and videos, not live side-by-side interaction recordings. The linked references are the captures available for this pass; comparative frame-rate and motion-easing measurements remain unverified and must not be inferred from the renderer documentation.

## Motion and navigation findings

- Zoom should be centered on the pointer, with a bounded scale and eased fit-to-screen. Labels should fade in only after nodes have enough screen space.
- On first open, show the graph immediately and settle the layout progressively. Do not hold the collection shell behind a full layout calculation.
- Filter changes should update visibility in place with a short opacity transition; avoid rebuilding the camera or restarting a settled force simulation.
- Hover highlights the selected node, its immediate neighbors and incident edges. The rest of the graph dims. Search uses a short camera transition and the same focus treatment.
- Dragging should move a node directly and settle nearby nodes with damped motion; once settled, the graph must stop moving.

The references above describe product behavior. Exact easing and frame-rate comparisons require captured interaction traces on the actual competing applications; no such comparative timing measurement is claimed here. No competitor screenshots are embedded because a live competitor session was not available in this headless Linux run. The linked primary documentation is retained as the benchmark source record.

## Renderer choice

Use **sigma.js + graphology**, with a WebGL renderer, and compute initial positions in a Web Worker (or an incremental worker-backed layout). Sigma's own performance documentation describes WebGL rendering for tens of thousands of nodes and edges. This is a better fit for the updated 30k-node / 100k-edge target than a DOM or SVG graph, while its layer model permits a small accessible HTML overlay for controls and labels. Keep graphology and sigma isolated to the graph layout so other layouts pay no runtime cost. Measure the bundled chunk before release.

## Product decisions

- Nodes are the notes in the active collection. Typed frontmatter relationships are solid edges; body wiki links are dashed, lower-contrast edges. If the same pair has either relationship direction and a wiki link, show only the relationship edge. Merge reciprocal relationships into one edge and retain relationship labels.
- Edges to notes outside the selected list are hidden. This preserves the promise that the graph represents the selected list and avoids an unbounded halo of ghost nodes. The relationship remains in the source note and can appear when the target is included in the collection.
- Type colors come from the existing type-color tokens. Untyped notes use the neutral surface token.
- Positions are transient presentation state. Filters are persisted with the collection's presentation config; graph navigation never changes note data.
- The editor panel follows the Kanban panel behavior and remains closed when Graph first opens.

## Acceptance measurements

Record first-render time, time to interactive, frame rate during pan/zoom/hover, main-thread blocking and memory on a generated 30,000-note / 100,000-edge fixture. The graph renderer must cull off-screen work, keep labels at a low zoom level of detail, and maintain a responsive app while layout settles. Do not claim the target is met without a real app recording and measurements.

## Step 1 implementation notes (TOL-385)

What step 1 built, and where it refines the decisions above (see ADR 0304):

- **Renderer.** sigma.js 4 + graphology, lazy-loaded with the first graph. Both edge kinds go through one sigma dashed edge layer: relationship edges fill their gaps with the edge color, wiki-link edges leave them transparent at a lower alpha. Node labels and icons are a small HTML overlay (the 150 best-connected notes plus the open one), not sigma's own labels, so they can reuse the list's note and type icons.
- **Layout worker.** graphology's bundled ForceAtlas2 worker starts from a blob URL, which the app CSP (`worker-src 'self'`) blocks. Step 1 runs ForceAtlas2 in its own Vite module worker instead and streams positions back every 10 iterations, then stops.
- **Edges.** The vault adds a synthetic `Type` relationship for every typed note; the graph skips it because the node color already shows the type. `belongsTo` / `relatedTo` only add edges when the `relationships` map lacks their keys, so the same link is not counted twice. A pair whose relationship keys are all hidden by the filter falls back to its wiki link.
- **Release gate.** Graph only shows on the alpha channel or with `ff_graph_layout=true`; a saved `type: graph` config opens as List while the flag is off and is not rewritten.
- **Not yet measured.** The 30,000-note / 100,000-edge acceptance measurements belong to step 3. Step 1 only claims that the demo vault and a list of about 1,000 notes render without freezing.
