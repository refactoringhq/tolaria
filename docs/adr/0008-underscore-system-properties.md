---
type: ADR
id: "0008"
title: "Underscore convention for system properties"
status: active
date: 2026-03-24
---

## Context

As Laputa added more features that store configuration in note frontmatter (pinned properties, type icons, colors, sidebar labels, sort order), the Properties panel became cluttered with internal fields that users shouldn't normally edit. A convention was needed to distinguish user-visible properties from system-internal ones.

## Decision

**Any frontmatter field whose name starts with `_` is a system property. It is hidden from the Properties panel, not exposed in search/filters, but remains editable in the raw editor. The frontmatter parser filters out `_*` fields before passing properties to the UI.**

## Options considered

- **Option A** (chosen): Underscore prefix convention (`_icon`, `_color`, `_order`, `_pinned_properties`) — simple, readable in raw files, universal rule. Downside: users must know the convention to access system fields.
- **Option B**: Separate YAML block or nested `_system:` key — cleaner separation. Downside: more complex parsing, breaks flat key-value frontmatter model.
- **Option C**: Store system properties in a separate sidecar file (`.meta.yml`) — complete separation. Downside: doubles the number of files, harder to keep in sync.

## Consequences

- All future system-level frontmatter fields must use the `_field_name` convention.
- Both Rust (`vault/mod.rs`) and TypeScript (`utils/frontmatter.ts`) parsers filter `_*` fields before passing `properties` to the UI.
- Power users can still access and edit system properties via the raw editor.
- Type documents use `_icon`, `_color`, `_order`, `_sidebar_label`, `_pinned_properties`.
- Re-evaluation trigger: if the number of system properties grows large enough to warrant a structured sub-object.

## Normalized system properties

| Canonical key | Old keys (read with fallback) | Written by |
|---|---|---|
| `_archived` | `Archived`, `archived` | Archive action |
| `_trashed` | `Trashed`, `trashed` | Trash action |
| `_trashed_at` | `Trashed at`, `trashed_at` | Trash action |
| `_favorite` | — | Favorite toggle |
| `_favorite_index` | — | Favorite reorder |

**Write rule**: always use the canonical `_`-prefixed key.
**Read rule**: accept both canonical and legacy keys (case-insensitive). Do NOT rewrite on read — migration is a separate concern.
