---
type: ADR
id: "0308"
title: "Graph settings without search and color groups; saved values stay inert in the view"
status: active
date: 2026-11-23
Platform: desktop
---

## Context

ADR 0306 added live search and color-group settings to the Graph settings panel (TOL-394). Reviewing the panel, the owner asked to simplify it to the Display and Forces sections and to drop the Graph-only eye button in the note-list header, which duplicated the Labels toggle in the Graph filter menu (TOL-434). Some views already store a `search` query and `colorGroups` in their presentation config.

## Decision

This ADR supersedes the search and color-group parts of ADR 0306. Everything else in ADR 0306 is unchanged.

- **The Graph settings panel shows only Display and Forces.** The search input, the color-group editor and their query syntax (`graphQuery.ts`) are removed.
- **Saved `search` and `colorGroups` are kept but inert.** `graphSettingsFrom` still reads them and the view writes them back unchanged, so a vault file keeps whatever it had. `visibleGraph` no longer filters by `search` and the palette colors nodes by type only, because the user would have no control to see or edit those values. "Show everything" no longer resets `search`, so it does not strip the saved value either.
- **Graph has no header eye button.** Node titles are shown and hidden only through Labels in the Graph filter menu. The eye-style property controls of the other layouts are unaffected.

## Consequences

- If search or color groups come back, the saved values are still in the vault files and can be honoured again.
- Views with a saved search now show every note of the collection in Graph, which is what the visible controls describe.
