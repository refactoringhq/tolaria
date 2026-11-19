---
type: ADR
id: "0304"
title: "Graph collection layout on sigma.js, released behind the graph_layout flag"
status: active
date: 2026-11-19
Platform: desktop
---

## Context

TOL-382 adds a Graph layout to every note list: notes as nodes, typed relationships and wiki links as edges. It is built in three step cards (TOL-385 first version, then motion polish, then big-vault performance), and nothing about Graph may reach stable or beta users until all three are done. Kanban (ADR 0301/0302) and Calendar (ADR 0303) each shipped in a single card, so neither needed a release gate. The graph target is 30,000 notes and 100,000 edges, which a DOM or SVG renderer cannot draw. The benchmark and renderer choice are recorded in `docs/specs/graph-layout.md`.

## Decision

This ADR extends ADRs 0301, 0302 and 0303; the shell, the registry, the panel and the file formats stay as described there.

- **Graph is a registered layout with its own bindings.** Label key `layout.graph`, Phosphor `Graph`, header control `graphFilters` (legend and filters), no required property. `CollectionLayoutRendererProps.graph` is a `GraphLayoutBindings` object: the filters, the list's link data (`GraphData`, computed by `useCollectionLayout` only while the list shows as a graph), `onSettingsChange`, `onBackgroundClick` (closes the editor panel) and `onUseList`.
- **Edges come from vault data only.** `buildGraphData` reads the `relationships` map (minus the synthetic `Type` key, which the node color already shows) plus `belongsTo` / `relatedTo` when the map lacks their keys, and `outgoingLinks`. Targets resolve with `resolveEntry` against every vault note, so aliases and titles work like in the editor, and are kept only when both notes are in the list. One edge per note pair: relationships win over a wiki link, reciprocal relationships merge into one edge whose labels list every key, and a pair whose relationship keys are all hidden falls back to its wiki link.
- **Filters persist like the other layouts.** `GraphCollectionPresentationConfig` is `type: graph` with `showWikiLinks`, `hiddenRelationships`, `hiddenTypes` (an empty string stands for untyped notes), `showOrphans` and `showLabels`. Saved Views store it under `presentation:` in `views/*.yml`; other lists store the same flat keys in `layouts/*.yml`. The keys are written only once the list has used or configured a graph, and stay in the presentation while it shows another layout. Node positions and the camera are session state.
- **Rendering is sigma.js 4 + graphology on WebGL, lazy-loaded.** `GraphLayout` (always bundled) lazy-imports `GraphCanvas`, so sigma and graphology load with the first graph only. One sigma dashed edge layer draws both edge kinds: relationship edges fill their gaps with the edge color (solid), wiki-link edges leave them transparent (dashed, lower contrast). Theme tokens are resolved to rgba once per theme and the renderer is rebuilt on a theme change. Node size follows the visible connection count (5 to 16 px). Labels and note icons are a pointer-transparent HTML overlay positioned after every sigma frame, capped at the 150 best-connected notes plus the open one; the open note is drawn larger with a primary-colored ring.
- **Layout runs in a module worker.** ForceAtlas2 (`graphology-layout-forceatlas2`, strong gravity) runs in `graphLayout.worker.ts` and streams positions back every 10 iterations, then stops; the graph shows immediately and settles progressively. Live updates keep positions of notes that stay, place new notes next to a linked neighbor and re-settle briefly. The worker is a Vite module worker served from `'self'`, which the app CSP (`worker-src 'self'`) allows; graphology's own blob-URL worker would not be.
- **The editor panel is shared, not forked.** `LayoutEditorPanelClose` and `useLayoutPanelOutsideClose` (renamed from the Kanban names) serve every non-list layout. Graph marks its canvas `data-layout-panel-keep` and tells node clicks (open the note with the real click event) from empty-canvas clicks (close the panel) itself; a press that travels more than 4 px is a pan.
- **`graph_layout` gates the release.** `FeatureFlagName` gains `graph_layout`, with no PostHog rule and no `FEATURE_DEFAULTS` entry: it is on for the alpha channel and with the `ff_graph_layout=true` localStorage override, off on beta and stable. `readFeatureFlag` reads a flag outside React; `getCollectionLayouts()` and the command palette leave flagged-off layouts out, and `getCollectionLayout()` falls back to List, so a saved `type: graph` config opens as List without being rewritten. Turning the flag on for stable is an owner decision after step 3.

## Consequences

- Kanban and Calendar keep their bindings and tests; the panel files are renamed, not changed in behavior.
- A layout still in development declares `featureFlag` on its registration (and command) instead of being hidden by hand.
- sigma, graphology and the ForceAtlas2 package are new runtime dependencies, isolated to the lazy graph chunk and the layout worker.
- WebGL is required for the Graph layout; JSDOM tests stub the canvas or the renderer, and Chromium Playwright covers the real canvas.

## Alternatives

- A DOM/SVG renderer (React Flow, D3 SVG) was rejected for the 30k-node target, as recorded in the benchmark.
- graphology's bundled FA2 supervisor was rejected because it starts its worker from a blob URL, which the CSP forbids.
- Releasing Graph from a long-lived branch instead of a flag was rejected: the card asks for normal direct-to-main delivery with the flag as the release gate.
