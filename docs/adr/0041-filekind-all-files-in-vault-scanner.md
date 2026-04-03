---
type: ADR
id: "0041"
title: "fileKind field — scan all vault files, not just markdown"
status: active
date: 2026-04-02
---

## Context

Laputa vaults often contain non-markdown files alongside notes: images, PDFs, YAML configs, JSON exports, scripts, etc. Previously the vault scanner only indexed `.md` files — all other files were invisible to the app. This made the Folder view incomplete: navigating a folder containing a `config.yml` or `photo.png` showed nothing, even though the file was physically there.

The need arose when adding a Folder tree view that is meant to mirror the actual filesystem structure. Users expect to see all files in a folder, as any file manager would show.

## Decision

**The vault scanner now indexes all files (not just `.md`). Every `VaultEntry` carries a `fileKind` field (`"markdown"`, `"text"`, or `"binary"`) that controls how the frontend renders and opens it.**

- **`"markdown"`**: full Laputa behavior — frontmatter parsing, BlockNote editor, title sync, type system.
- **`"text"`**: filename as title, no frontmatter, opens in raw CodeMirror editor. Covers `.yml`, `.json`, `.ts`, `.py`, `.sh`, etc.
- **`"binary"`**: filename as title, grayed out, non-clickable. Covers images, PDFs, binaries.
- **Hidden files** (starting with `.`) are skipped regardless of extension.
- **Non-folder views** (All Notes, type sections, Custom Views) still show only `"markdown"` entries.
- **Folder view** shows all file kinds.

## Options considered

- **Option A** (chosen): Single `VaultEntry` model with a `fileKind` discriminator. All files go through the same pipeline; rendering is gated by `fileKind`. Simple, incremental — existing code paths untouched for markdown files.
- **Option B**: Separate data model for non-markdown files (e.g. `AssetEntry`). Cleaner type hierarchy, but requires duplicating list/filter/sort logic for two types across the codebase.
- **Option C**: Only scan `.md` + explicitly listed extensions (e.g. `.yml`, `.json`). Simpler initial implementation, but requires ongoing maintenance of an allowlist and still misses user files. Abandoned in favor of a deny-list approach (only `.`-prefixed hidden files are excluded).

## Consequences

- Non-markdown files are visible in Folder view — the app now behaves like a file manager in that context.
- All views except Folder view continue to show only markdown files (the `isMarkdown` guard in `filterEntries`).
- `countByFilter` / `countAllByFilter` exclude non-markdown entries to keep sidebar counters accurate.
- The vault cache version was bumped to `11` to force a full rescan after this change.
- Binary files have no click action — clicking does nothing (no editor opened).
- Re-evaluation trigger: if users need to preview or edit binary files (e.g. images), a dedicated preview pane would need a separate ADR.
