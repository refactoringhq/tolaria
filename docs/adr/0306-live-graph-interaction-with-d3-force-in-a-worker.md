---
type: ADR
id: "0306"
title: "Live graph interaction: d3-force in a worker, sigma node drag, animated emphasis and zoom-aware labels"
status: active
date: 2026-11-20
Platform: desktop
---

## Context

ADR 0304 built the first Graph layout (TOL-385): ForceAtlas2 ran a fixed number of iterations in a module worker and then stopped, node drag was off, there was no hover state, and labels were capped at the 150 best-connected notes with a greedy overlap test. TOL-394 asks for Obsidian-level interaction behind the same `graph_layout` flag: drag a node and watch the graph react live, hover to grow a title, click to focus on a note's neighbours, labels that fade with zoom, and live force, display, search and color-group settings saved per view, at 60 fps with about 1,000 notes and 3,000 links.

## Decision

This ADR supersedes the "Layout runs in a module worker" and label parts of ADR 0304. The registry, bindings, edge rules, filter persistence, editor panel and the `graph_layout` flag stay as ADR 0304 describes them.

- **The layout is a live d3-force simulation in a module worker.** `d3-force` (link, Barnes-Hut many-body repulsion, and a gentle x/y pull to the origin) replaces `graphology-layout-forceatlas2`. `GraphSimulation` wraps it without its own timer; `SimulationLoop` ticks it, fast-forwards a fresh layout (several ticks per frame until it is roughly in shape) and runs interaction in real time (one tick per frame). It posts positions every frame and schedules nothing once the energy falls below the rest threshold, so an idle graph costs no CPU. The same loop runs inline on timers when workers are unavailable (tests). `createLayoutController` owns one worker per canvas, applies at most one position update per animation frame, and exposes `load`, `hold`, `release` and `setForces`. d3-force was chosen over running ForceAtlas2 continuously because it has the drag model this needs built in (fixed `fx`/`fy` plus an `alphaTarget` that keeps the graph warm while a node is held and lets it settle after release), it is the simulation Obsidian's graph started from, and its decay gives a bounded settle time (about two seconds after a release).
- **Graph coordinates are used as they are.** The renderer runs with `autoRescale: false`, so the graph can grow and shrink while it settles without the view jumping, and a dragged node stays exactly under the pointer. Fit, zoom and reveal are camera moves computed in `graphCamera.ts`; while the first layout settles the camera keeps the whole graph in view until the user presses or scrolls the canvas or the graph comes to rest.
- **Drag uses sigma's own node drag.** `enableNodeDrag` is on; sigma moves the node and suppresses panning, and `nodeDragStart` / `nodeDrag` / `nodeDragEnd` hold the node in the simulation and release it (not pinned). A press that travels more than 4 px never opens a note.
- **Hover and focus are animated node and edge attributes.** `fade` (opacity) and `accent` (blend toward the primary color, plus a slight growth) are graph attributes the sigma styles read. `EmphasisAnimator` eases them over 200 ms, retargeting from wherever the graph is so sliding between nodes never flickers; with reduced motion it jumps. Hover wins over focus. The strong set is the note and its direct neighbours; everything else fades to 12 % (links to 6 %). On graphs with more than 1,000 links, links switch once at the start of a transition while notes ease, because re-processing every link each frame drops frames. Clicking a node opens it and focuses its neighbourhood; the camera eases the neighbourhood into the part of the canvas the editor panel leaves uncovered. A background click, Escape anywhere outside the editor or a text field, or closing the panel ends the focus.
- **Labels: every note is eligible, room decides.** Up to 2,000 notes each get a chip (past that, the best-connected ones plus the forced ones). Each frame `placeLabels` places chips greedily in priority order (hovered, open, focused neighbourhood, then by link count) on a screen grid; an unforced label may not cover a placed label or another note's circle, so a dense centre stays unlabelled until zoom spreads it out. Label opacity follows the camera: full from the fade zoom, gone one halving below it, shifted by the Text fade threshold setting. Hovered, open and focused labels show at every zoom. Unplaced chips are `display: none` and DOM writes are diffed, so placement costs well under a millisecond on 1,000 notes.
- **Graph settings are flat keys saved with the view.** `GraphSettings` gains `search`, `colorGroups` (`{ id, query, color }` with a palette color key, first match wins), `textFadeThreshold`, `nodeSizeScale`, `linkThickness`, `showArrows`, `centerForce`, `repelForce`, `linkForce` and `linkDistance`, read defensively and clamped by `graphSettingsFrom`. `DEFAULT_GRAPH_SETTINGS` is built by the same reader so default and read-back settings serialize identically (layouts that never used a graph still write no graph keys). The settings panel previews sliders and typed queries live (`previewGraph`, in memory) and saves on release or after a 400 ms pause (`changeGraph`). Search and group queries share one syntax (`graphQuery.ts`): title substring, `type:` and `key:value` property terms, all terms must match.
- **Arrows follow link direction.** Each `GraphPair` records whether its links go source → target, target → source or both, and the edge style draws sigma arrow extremities at the matching ends when Arrows is on.

## Consequences

- `d3-force` is a new runtime dependency (with `@types/d3-force` for development), isolated to the lazy graph chunk and the layout worker; `graphology-layout-forceatlas2` is removed.
- Graph positions are now in screen-like units (about one pixel per unit at zoom 1); the Link distance setting is in those units.
- The simulation never runs when nothing moves, but a held node keeps it warm until release.
- `GraphLayoutBindings` and the header graph controls gain `onSettingsPreview` / `onPreview`; the layout registration adds the `graphSettings` header control.
- Analytics: `graph_node_focused` and `graph_node_dragged` events; settings changes reuse `graph_filter_changed` with the changed keys.

## Alternatives

- Running ForceAtlas2 continuously in the worker was rejected: it has no notion of a held node or a target energy, so drag-and-settle would need a hand-made cooling schedule, and it was tuned for a one-shot layout.
- Keeping `autoRescale` and freezing the bounding box only during a drag was rejected: the whole graph would still rescale while it settles, which reads as the camera moving by itself.
- Animating emphasis with per-frame React state or one DOM element per node was rejected for the 1,000-node target; graph attributes keep the work inside sigma's batched refresh.
- Replacing sigma with PixiJS (Obsidian's renderer) was not pursued: there is no measured evidence against sigma. On the GPU-less Linux agent box every canvas redraw is bound by software WebGL (a plain pan costs as much as a drag), so the 60 fps target still needs a measurement on a machine with a GPU.
