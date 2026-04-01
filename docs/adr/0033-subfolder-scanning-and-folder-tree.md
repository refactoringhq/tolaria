---
type: ADR
id: "0033"
title: "Subfolder scanning and folder tree navigation"
status: active
date: 2026-03-31
---
## Context

[[0032 Status Bar For Git Actions]]

Supersedes the scanning constraint in [ADR-0006](0006-flat-vault-structure.md) which limited vault indexing to root-level `.md` files plus protected folders (`attachments/`, `assets/`).

Users with folder-based workflows (PARA, Zettelkasten with folders, project directories) could not see or filter notes by directory. The vault scanner silently ignored all subdirectory `.md` files, making Laputa unsuitable for vaults with any folder structure.

## Decision

**Extend the Rust vault scanner to index&#x20;**`.md`**&#x20;files in all visible subdirectories, and expose the vault's folder tree via a new&#x20;**`list_vault_folders`**&#x20;Tauri command so the sidebar can render a collapsible FOLDERS section.**

Hidden directories (names starting with `.`, plus `.git` and `.laputa`) are excluded from both scanning and the folder tree.

## Options considered

* **Option A** (chosen): Scan all subdirectories with `walkdir`, expose separate `list_vault_folders` command — simple, no schema changes to VaultEntry, folder tree is lightweight and independent of the entry cache.
* **Option B**: Add a `folder` field to VaultEntry and derive the tree on the frontend — couples folder metadata to the entry cache, complicates cache invalidation when folders are created/deleted without file changes.
* **Option C**: Keep flat scanning, add a "virtual folders" feature that groups by path prefix from frontmatter — doesn't solve the core problem of missing notes in subdirectories.

## Consequences

* All `.md` files in the vault are now indexed regardless of depth — vaults with many non-note `.md` files (e.g. node_modules) will see spurious entries. Mitigation: hidden directories are already excluded; users can add a `.laputaignore` in the future if needed.
* The git-based cache in `cache.rs` already uses `walkdir` for change detection, so this change aligns scanning with caching.
* `SidebarSelection` gains a new `{ kind: 'folder'; path: string }` variant — all exhaustive switches on selection kind must handle it.
* ADR-0006's "flat vault" principle is relaxed: notes can now live in subdirectories. Type definitions still live in `type/` at the root.
* Re-evaluate if users request recursive folder filtering (currently only direct children are shown when a folder is selected).
