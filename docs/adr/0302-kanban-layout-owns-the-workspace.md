---
type: ADR
id: "0302"
title: "Non-list layouts own the workspace and declare their header controls"
status: active
date: 2026-11-16
Platform: desktop
---

## Context

ADR 0301 registered List and Kanban as collection layouts. QA of the first Kanban showed that a board squeezed into the note-list column, a separate layout row and native selects did not feel like part of Tolaria. The board needs the whole workspace, the note editor has to stay one click away, and layout controls belong with the existing note-list actions.

## Decision

This ADR extends ADR 0301; the file formats and the registry stay as described there.

- **The layout owns the workspace.** When the selected collection renders a non-list layout, the note-list pane grows over the editor area, and the app editor becomes a right-hand panel that slides in when a card opens a note and closes from a button before the first breadcrumb. The board drives this shell through `data-collection-layout` and `data-kanban-panel` on the note-list root and CSS `:has()`, so `App.tsx` and the editor stay layout-agnostic. Entering Kanban starts with the panel closed.
- **Registrations declare their header controls.** A layout registration in `src/collections/layoutRegistry.tsx` now carries a translated label key, an icon and the list of extra header controls it needs (`groupBy` for Kanban). The note-list header renders one layout menu (shadcn `DropdownMenu`, icon of the current layout) next to the sort, search, visible-properties and create actions, plus the declared controls. A future layout, or a plugin adapter, adds controls by declaring them instead of editing the header.
- **Shared list controls are reused.** In Kanban the visible-properties control edits the card fields, and cards render properties with the note-list `PropertyChips`. Until the board has its own card fields, cards show the list's visible properties.
- **Drags stay presentation-only.** Cards and columns move with dnd-kit. A card dropped in another column writes the group-by property through the normal frontmatter handler and shows in its new column optimistically until the vault entry reports the value; an unconfirmed drop snaps back after five seconds. The write only happens when the group-by key is a single-line key the board's notes already carry. Column moves only change `columnOrder` in the layout config. Within a column, cards follow the list sort.
- **No-op choices do not write.** Choosing the current layout or group-by value leaves the layout file untouched.

## Consequences

- Calendar or Graph layouts get the same full-workspace shell and editor panel without changes to `App.tsx`.
- The header stays one row; the sort trigger is icon-only, with the property in its tooltip and menu.
- Neighborhood and Changes lists keep List because their structure is not a flat collection.

## Alternatives

- A Kanban-specific editor drawer was rejected: the app editor already handles tabs, saving and the inspector.
- Keeping a separate layout row was rejected after QA; it cost vertical space and duplicated the header.
