---
type: ADR
id: "0040"
title: "Custom views as .yml files with client-side filter engine"
status: active
date: 2026-04-02
---

## Context

Users want to save reusable filtered note lists (e.g., "Active Projects", "This Week's Events") as named sidebar items. These views need to persist across sessions, sync via git, and support arbitrary frontmatter conditions.

## Decision

**Custom views are stored as `.yml` files in `.laputa/views/` within the vault root.** Each file defines a named view with filter conditions, optional icon/color, and sort preferences.

### File format

```yaml
name: Active Projects
icon: rocket
color: blue
sort: "modified:desc"
filters:
  all:
    - field: type
      op: equals
      value: Project
    - field: status
      op: not_equals
      value: done
```

### Filter engine

Filters use a tree of AND/OR groups (`all`/`any`) containing conditions. Each condition specifies a `field`, `op` (operator), and optional `value`. Supported operators: `equals`, `not_equals`, `contains`, `not_contains`, `any_of`, `none_of`, `is_empty`, `is_not_empty`, `before`, `after`.

Field resolution: built-in fields (`type`, `status`, `title`, `archived`, `trashed`, `favorite`) map to VaultEntry struct fields. Unknown fields fall back to `entry.properties`, then `entry.relationships`.

Wikilink values like `[[target|Alias]]` are matched by stem (stripping brackets and pipe+alias).

### Architecture

- **Rust backend** (`vault/views.rs`): YAML parsing via `serde_yaml`, filter evaluation, file CRUD. Three Tauri commands: `list_views`, `save_view_cmd`, `delete_view_cmd`.
- **Frontend**: Client-side filter evaluation against the already-loaded `VaultEntry[]` array. The Rust `evaluate_view` exists for MCP/CLI access but is not the primary UI path.
- **Sidebar**: VIEWS section between Favorites and Types, hidden when no views exist.

## Options considered

- **SQLite views table**: Fast queries, but not portable via git and diverges from the file-first data model.
- **Frontmatter on a special `.md` file**: Overloads the note format for a non-note concept.
- **Standalone `.yml` files (chosen)**: Portable (synced via git), editable by hand or UI, naturally separated from note content.

## Consequences

- New dependency: `serde_yaml` crate for YAML parsing.
- `.laputa/views/` directory auto-created on first view save. Already excluded from vault scanning via `HIDDEN_DIRS`.
- Views sync across devices via git. Conflicts resolved by standard git merge (YAML is line-based, merges well).
- Sort persistence: changing sort while a view is selected writes `sort` back to the `.yml` file.
