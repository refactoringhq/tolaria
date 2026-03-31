---
type: ADR
id: "0031"
title: "Full App instance for secondary note windows"
status: active
date: 2026-03-31
---

## Context

Laputa supports opening a note in a secondary window ("Open in New Window"). The original implementation used a dedicated `NoteWindow` component — a thin shell that rendered only the editor, duplicating some App-level logic (vault loading, settings, keyboard shortcuts) in a simplified but diverging form. As the main App gained features (properties editing, zoom, command palette, keyboard shortcuts), the `NoteWindow` shell fell behind, requiring ongoing maintenance to keep parity.

## Decision

**Remove `NoteWindow` and render the full `App` component in secondary note windows.** The window type is detected at startup via URL query parameters (`?window=note&path=...&vault=...`). When in note-window mode, the App initialises with panels hidden (sidebar collapsed, inspector collapsed) and auto-opens the target note once vault entries load. The window title is kept in sync with the active note title via the Tauri window API.

## Options considered

- **Keep `NoteWindow` shell** (status quo): lower initial bundle weight per window, but divergence grows with every main-App feature. Rejected — maintenance cost dominates.
- **Full `App` instance with URL-param mode** (chosen): complete feature parity for free; single code path for all window types. Trade-off: slightly heavier startup for secondary windows (full vault load), acceptable given local filesystem speed.
- **IPC-driven secondary window (no vault reload)**: secondary window subscribes to primary window's vault state via Tauri events. Maximum efficiency, avoids double vault reads. Deferred — requires significant IPC plumbing; can be layered on top later without changing the rendering model.

## Consequences

- Removes ~163 lines (`NoteWindow.tsx` deleted entirely)
- Secondary note windows get full feature parity: all keyboard shortcuts, properties panel, zoom, command palette, diff mode, raw editor
- `useLayoutPanels` gains an `initialInspectorCollapsed` option to support the hidden-panel initial state
- A new `src/utils/windowMode.ts` utility encapsulates URL-param detection — single source of truth for window-type logic
- Vault is loaded independently in each note window (no shared state with the main window); writes go to the same filesystem so eventual consistency is maintained via file-watching
- Triggers re-evaluation if: multiple simultaneous note windows cause measurable vault-read contention, or if IPC-driven shared-state windows become a product requirement
