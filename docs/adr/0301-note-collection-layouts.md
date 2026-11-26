---
type: ADR
id: "0301"
title: "Note collections use registered layouts"
status: accepted
date: 2026-11-15
---

## Context

Collections already separate note selection from presentation. The product already uses View for saved filters, so the user-facing term for a collection renderer is Layout. List remains the default; Kanban is the first additional layout.

## Decision

Each collection layout has a stable `type`, a renderer, a configuration shape, and a function describing the note properties it needs. The in-tree registry in `src/collections/layoutRegistry.tsx` registers List and Kanban. It is an internal extension seam, not a community plugin API.

Saved View YAML stores non-default layout settings in an optional `presentation` mapping. The desktop view model preserves that mapping through reads and writes. Existing files without it remain List and are not rewritten. Other durable collections store one YAML file per collection under the vault-root `layouts/` directory; a record contains the stable collection key and its presentation config. Files are keyed independently inside each vault, so absolute machine paths are not serialized. Writes validate the vault boundary, replace files atomically, and skip byte-identical updates. Kanban consumes resolved collection entries and changes only the configured note property through the ordinary frontmatter update path; it owns no board data store.

The Web build keeps non-View collection layouts in `localStorage` under `tolaria:web-collection-layouts`. `collectionLayoutStorage.ts` selects that store or the desktop vault commands once, and both use the same layout record shape. Saved Views continue to use their YAML files on both platforms.

Future plugin registration can adapt the same registration contract after the host's lifecycle, permissions, and compatibility boundaries are designed. Plugins are not loaded by this registry.

## Consequences

- List rendering remains the default for collections without saved layout settings.
- Layout configuration is portable YAML for saved Views and can be versioned with the vault.
- Built-in, type, and folder collection settings persist under the owning vault’s `layouts/` directory. Saved Views continue to persist within `views/*.yml`.
- Column order is presentation config only and never reorders notes.

## Alternatives

- Extending saved View `kind` was rejected because it conflates selection and rendering.
- A new board data model was rejected because note frontmatter remains the source of truth.
- A public plugin API was deferred until multiple internal renderers establish the host requirements.
