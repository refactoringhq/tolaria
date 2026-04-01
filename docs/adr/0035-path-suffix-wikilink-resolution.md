---
type: ADR
id: "0035"
title: "Path-suffix wikilink resolution for subfolder vaults"
status: active
date: 2026-04-01
---

## Context

ADR-0006 stated that wikilink resolution was "simplified to multi-pass title/filename matching — no path-based matching needed" because the vault was flat. ADR-0033 relaxed the flat-vault constraint by adding subfolder scanning. As a result, wikilinks like `[[docs/adr/0031-foo]]` or `[[adr/0031-foo]]` could not resolve to entries in subdirectories: the resolver only matched on `title` and `filename` stem, never on the vault-relative path.

The backlink detection in the Inspector also used a hardcoded `/Laputa/` path regex, which was wrong for any vault that isn't named "Laputa".

## Decision

**Add path-suffix matching as Pass 1 of wikilink resolution: a link target resolves to a `VaultEntry` if the entry's vault-relative path ends with the link string (with or without `.md`). Filename-stem matching (the previous Pass 1) becomes Pass 2. Inspector backlinks replace the hardcoded `/Laputa/` regex with a generic `targetMatchesEntry` path-suffix helper. Autocomplete pre-filter also matches against the full vault-relative path so subfolder names surface results.**

## Options considered

- **Option A** (chosen): Path-suffix as Pass 1, then filename match as Pass 2 — consistent with how Obsidian resolves links in multi-folder vaults, zero config. Downside: if two notes share the same filename in different folders, only the first (path-suffix) match wins.
- **Option B**: Strict full-path matching only (disable title-stem resolution) — unambiguous, but breaks the majority of existing short-form `[[note-title]]` links.
- **Option C**: Keep title-only matching, require full paths for subfolder notes — backwards-compatible, but forces users to always type full paths for subfolders, defeating the purpose of wikilinks.

## Consequences

- Supersedes the "no path-based matching needed" clause from ADR-0006 (that assumption was contingent on the flat vault invariant, which ADR-0033 relaxed).
- `relativePathStem` utility added in `wikilink.ts` to extract the vault-relative path stem from a full `VaultEntry`.
- The Inspector's `targetMatchesEntry` helper is now the canonical way to test if a link resolves to an entry — use it everywhere instead of ad-hoc regex.
- Wikilink autocomplete suggestions now surface notes in subfolders when users type a folder prefix (e.g. `[[adr/`).
- Re-evaluate if path-suffix ambiguity (two files with the same name in different folders) becomes a user complaint.
